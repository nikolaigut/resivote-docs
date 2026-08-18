---
title: Security and Compliance
description: Reference documentation of the ResiVote security architecture — authentication, multi-tenant isolation, encryption, audit log, and compliance.
---

import { Aside, Steps, LinkCard } from '@astrojs/starlight/components';

ResiVote implements defense-in-depth across multiple layers: OIDC authentication, PostgreSQL Row-Level Security, per-tenant document encryption, immutable audit log hash chain, and production-critical configuration guards.

## Authentication

### ZITADEL OIDC

Authentication is handled via ZITADEL OIDC. The `ZITADELValidator` (`internal/infrastructure/auth/zitadel.go`) validates JWT access tokens:

1. **Signature validation** — RSA signature against JWKS (`{BaseURL}/oauth/v2/keys`), cached with 5-minute TTL and retry with exponential backoff (100ms, 500ms, 2s).
2. **Issuer validation** — `iss` claim must match `ExpectedIssuer` (default: `BaseURL`).
3. **Audience validation** — `aud` claim must contain `ExpectedAudience` (default: `ProjectID`).
4. **Userinfo enrichment** — If email is not included in the access token, the ZITADEL userinfo endpoint (`{BaseURL}/oidc/v1/userinfo`) is queried and cached for 5 minutes.

The `AuthMiddleware` (`internal/interfaces/http/middleware/auth.go`) extracts the token from the `Authorization` header or the `token` query parameter (for WebSocket).

<Aside type="warning" title="JWT Bypass Only in Non-Production">
In non-production builds (without `-tags production`), a fallback exists that parses claims without signature validation when JWKS is unreachable. In production builds (`-tags production`), this code is **completely absent** — it is not compiled into the binary. The startup check in `main.go` refuses to start if `APP_ENV=production` but the build tag is missing.
</Aside>

### ZITADEL Bootstrap and Admin Client

In dev environments, `EnsureDevZITADELSetup` (`zitadel_bootstrap.go`) idempotently bootstraps project, OIDC client, users, and action script. The bootstrap uses a PAT (Personal Access Token) for machine authentication.

The `ZITADELAdminClient` (`zitadel_admin.go`) manages users via the ZITADEL Management API. Two backends:

- **gRPC** — when `ZITADEL_KEY_PATH` points to a machine key JSON file (production).
- **REST** — when `ZITADEL_PAT` is set and no machine key is available (dev).
- **No-Op** — when neither key nor PAT is configured (dev without ZITADEL integration).

## Multi-Tenant Isolation

### PostgreSQL Row Level Security (RLS)

Every tenant-scoped table has a `tenant_isolation_policy` RLS policy. The policy compares `tenant_id` with the session variable `app.current_tenant_id`:

```sql
USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
```

Migration `000004` adds `WITH CHECK` clauses to all policies, which also validate write access (INSERT/UPDATE). Tables without a direct `tenant_id` column (`proxy_instructions`, `signature_units`) use EXISTS subqueries on the parent table.

### DBTransactionMiddleware

The `DBTransactionMiddleware` (`internal/interfaces/http/middleware/db_tx.go`) opens a GORM transaction per request and sets `SET LOCAL app.current_tenant_id`. The transaction is committed on handler success, rolled back on error. Without a tenant ID in the context (super admin routes), `SET LOCAL` is skipped — RLS policies fail closed (no rows).

### TenantScopedDB

The `TenantScopedDB` (`internal/infrastructure/persistence/tenant_scoped_db.go`) is a restricted interface over `*gorm.DB` that does not expose `Exec`. This prevents callers from calling `SetTenantContext` mid-transaction and switching the RLS tenant scope. The primary protection is the fail-closed RLS policies; the interface is defense-in-depth.

## Document Encryption

### Per-Tenant DEK

Each tenant receives its own Data Encryption Key (DEK), generated as a 32-byte CSPRNG value. The DEK is wrapped with the master key using AES-GCM and stored as `encrypted_dek` in the `tenants` table (`tenant_key.go`).

Generation is atomic: `UpdateIfDEKMissing` sets the DEK only when `encrypted_dek IS NULL`, so concurrent first-time calls do not overwrite each other.

### Per-Document Key

The document key is derived via HKDF-SHA256 from the tenant DEK and the document ID (`document_encryption.go`):

```
HKDF-SHA256(dek, salt=documentID[:], info="resivote-doc-v1") → 32-byte key
```

Encryption uses AES-GCM with a fresh nonce per document. The format is `nonce || ciphertext+tag`.

<Aside type="warning" title="DOCUMENT_ENCRYPTION_MASTER_KEY">
The environment variable `DOCUMENT_ENCRYPTION_MASTER_KEY` must be a base64-encoded 32-byte key. Without this key, document encryption is disabled. Generation: `openssl rand -base64 32`.
</Aside>

## Audit Log

### Immutable Hash Chain

Every `AuditEntry` contains `PreviousHash` and `Hash`, forming a chained hash chain. Three hash versions:

| Version | Algorithm | Fields |
|---|---|---|
| v1 | Plain SHA-256 (deprecated) | Core fields, without IP/UserAgent |
| v2 | SHA-256 or HMAC-SHA-256 | All fields incl. IP/UserAgent |
| v3 | SHA-256 or HMAC-SHA-256 | v2 + `ImpersonatedByID` |

`ComputeHashWith` dispatches based on `HashVersion`. In production, `AUDIT_HASH_KEY` (≥32 bytes) is required — without it, the chain degrades to plain SHA-256, which cannot detect database-level manipulation (ZertES/nDSG violation).

### DB-Level Immutability

PostgreSQL triggers block `UPDATE`, `DELETE`, and `TRUNCATE` on `audit_entries`, `signatures`, and `signature_units` (Migration `000001`). An event trigger (`audit_entries_ddl_guard`) blocks DDL on `audit_entries`, except in maintenance mode (`app.maintenance=on`), which is logged in `audit_maintenance_events`.

### Fail-Closed and Verification

| Mechanism | Configuration | Default |
|---|---|---|
| `FailClosed` | `AUDIT_FAIL_CLOSED` | `true` |
| `FailClosedThreshold` | `AUDIT_FAIL_CLOSED_THRESHOLD` | 3 |
| `VerifyInterval` | `AUDIT_VERIFY_INTERVAL` | 5 minutes |

With `FailClosed=true`, startup verification failure leads to `os.Exit(1)`. Periodic verification requires `FailClosedThreshold` consecutive tamper detections before the server is shut down (DoS mitigation: a single corrupt entry does not immediately crash the service). Startup verification always has threshold=1.

The startup flow additionally checks the immutability enforcement triggers and the non-superuser status of the DB role.

## Check-in Token Security

QR check-in tokens are signed with HMAC-SHA-256 (`CheckInTokenService`). The signing key is `CHECKIN_TOKEN_SIGNING_KEY`.

<Aside type="warning" title="Production-Critical Environment Variables">
In production (`APP_ENV=production`), the following environment variables are **mandatory** — the server refuses to start if missing or too short:

- **`AUDIT_HASH_KEY`** — ≥32 bytes, HMAC-SHA-256 for audit hash chain (ZertES/nDSG)
- **`CHECKIN_TOKEN_SIGNING_KEY`** — ≥32 bytes, HMAC-SHA-256 for QR check-in tokens
- **`APP_ENV`** — must be explicitly set (no default)
- **`DOCUMENT_ENCRYPTION_MASTER_KEY`** — base64-encoded 32-byte AES key

Generation: `openssl rand -base64 32`
</Aside>

The token validity period is `CHECKIN_TOKEN_EXPIRY` (default 30 minutes). Token generation is rate-limited (5 req/s, burst 10) per user+tenant. Token validation is rate-limited (10 req/s, burst 20) per IP.

## Security Headers

The `SecurityHeadersMiddleware` (`internal/interfaces/http/middleware/security.go`) sets the following headers:

| Header | Value |
|---|---|
| `Content-Security-Policy` | `default-src 'self'`; OIDC issuer in `connect-src` |
| `Strict-Transport-Security` | `max-age=31536000` (HTTPS only) |
| `X-Frame-Options` | `SAMEORIGIN` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `accelerometer=(), camera=(), geolocation=(), ...` |

The CSP allows `style-src 'unsafe-inline'` (Angular inline styles) but not `script-src 'unsafe-inline'`. The OIDC issuer URL is sanitized before being included in the CSP (schema validation, CSP metacharacter rejection).

## Body Limit and Rate Limiting

- **Body limit** — Global `SERVER_BODY_LIMIT` (default 50M). Upload routes use `STORAGE_MAX_UPLOAD_SIZE` (default 50M). Owner import: 10M. Signature check-in: 5M.
- **Rate limiting** — `golang.org/x/time/rate` with in-memory store:
  - `/auth/config`: 10 req/s, burst 20 (per IP)
  - `/api/v1/me`: 10 req/s, burst 20 (per IP)
  - Super admin routes: 0.5 req/s, burst 30 (per user)
  - QR token generation: 5 req/s, burst 10 (per user+tenant)
  - Audit export/evidence package: 10 req/s, burst 20 (per user+tenant)
  - Contact form: 0.083 req/s, burst 2 (per IP)

## APP_ENV Enforcement

- `APP_ENV` must be explicitly set as an environment variable — `config.Load()` returns `ErrAppEnvNotSet` if missing.
- In production, `.env` is **never** loaded — all configuration must come from the container/process environment.
- In non-production, `.env` is loaded for convenience; explicit env vars take precedence.
- Unicode homograph attacks on `APP_ENV` are mitigated (`isASCII` check).

## Vote Immutability

Votes are immutable (`vote.go`). When changed, the old vote is marked as `IsSuperseded=true` and a new vote is created. `IsActive()` returns `!IsSuperseded`. The quorum engine and result calculation only consider active votes.

## Signature Tamper Evidence

Signatures are stored in a separate table (`signatures`), not embedded in `Attendance`. DB triggers block `UPDATE`, `DELETE`, and `TRUNCATE`. The signature image data (`image_data`, `bytea`) is thus independently auditable and tamper-proof.

## CORS

The `CORSMiddleware` (`internal/interfaces/http/middleware/cors.go`) validates origins against a configured list. Default origins (`defaultCORSOrigins` in `config.go`):

- Production: `https://app.resivote.ch`, `https://resivote.ch`, `https://www.resivote.ch`
- Non-production: additionally `http://localhost:4200`, `http://localhost:8081`, `http://localhost:4321`

With an empty origin list, cross-origin requests are rejected fail-closed. `AllowCredentials` is disabled for wildcard origins.

## Swiss Legal References

The code references the following Swiss legal bases:

| Reference | Context |
|---|---|
| Art. 647b/d/e ZGB | Qualified majority quorum (head and value votes) |
| Art. 647e ZGB | Unanimous quorum (absences as implicit NO) |
| Art. 712g ZGB | Voting rights cap, qualified majority for STWEG |
| Art. 712m para. 2 ZGB | Circular resolution |
| Art. 712o ZGB | One unit, one head vote |
| ZertES | Audit hash chain with HMAC-SHA-256 (integrity proof) |
| nDSG | Data integrity and tamper protection |

<LinkCard title="Configuration" description="All environment variables and config structs" href="/reference/konfiguration/" />
<LinkCard title="Check-in" description="QR code and signature check-in guide" href="/guides/checkin/" />
<LinkCard title="Minutes" description="Minutes and audit trail" href="/guides/protokoll/" />
