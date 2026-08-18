---
title: Sicherheit und Compliance
description: Referenzdokumentation der ResiVote-Sicherheitsarchitektur — Authentifizierung, Multi-Tenant-Isolation, Verschlüsselung, Audit-Log und Compliance.
---

import { Aside, Steps, LinkCard } from '@astrojs/starlight/components';

ResiVote implementiert Defense-in-Depth auf mehreren Schichten: OIDC-Authentifizierung, PostgreSQL Row-Level Security, Per-Tenant-Dokumentenverschlüsselung, immutable Audit-Log-Hash-Chain und produktionskritische Konfigurations-Guards.

## Authentifizierung

### ZITADEL OIDC

Die Authentifizierung erfolgt über ZITADEL OIDC. Der `ZITADELValidator` (`internal/infrastructure/auth/zitadel.go`) validiert JWT-Access-Tokens:

1. **Signaturvalidierung** — RSA-Signatur gegen JWKS (`{BaseURL}/oauth/v2/keys`), gecacht mit 5-Minuten-TTL und Retry mit exponentiellem Backoff (100ms, 500ms, 2s).
2. **Issuer-Validierung** — `iss`-Claim muss `ExpectedIssuer` entsprechen (Standard: `BaseURL`).
3. **Audience-Validierung** — `aud`-Claim muss `ExpectedAudience` enthalten (Standard: `ProjectID`).
4. **Userinfo-Enrichment** — Wenn Email nicht im Access-Token enthalten ist, wird die ZITADEL-Userinfo-Endpoint (`{BaseURL}/oidc/v1/userinfo`) abgefragt und 5 Minuten gecacht.

Die `AuthMiddleware` (`internal/interfaces/http/middleware/auth.go`) extrahiert den Token aus dem `Authorization`-Header oder dem `token`-Query-Parameter (für WebSocket).

<Aside type="warning" title="JWT-Bypass nur in Non-Production">
In Non-Production-Builds (ohne `-tags production`) existiert ein Fallback, der Claims ohne Signaturvalidierung parst, wenn JWKS unerreichbar ist. In Production-Builds (`-tags production`) ist dieser Code **komplett absent** — er wird nicht in das Binary kompiliert. Der Startup-Check in `main.go` verweigert den Start, wenn `APP_ENV=production` aber der Build-Tag fehlt.
</Aside>

### ZITADEL Bootstrap und Admin-Client

In Dev-Umgebungen bootstrapt `EnsureDevZITADELSetup` (`zitadel_bootstrap.go`) idempotent Projekt, OIDC-Client, Benutzer und Action-Script. Der Bootstrap nutzt einen PAT (Personal Access Token) für die Maschinen-Authentifizierung.

Der `ZITADELAdminClient` (`zitadel_admin.go`) verwalten Benutzer über die ZITADEL Management API. Zwei Backends:

- **gRPC** — wenn `ZITADEL_KEY_PATH` auf eine Machine-Key-JSON-Datei zeigt (Produktion).
- **REST** — wenn `ZITADEL_PAT` gesetzt ist und kein Machine-Key verfügbar ist (Dev).
- **No-Op** — wenn weder Key noch PAT konfiguriert sind (Dev ohne ZITADEL-Integration).

## Multi-Tenant-Isolation

### PostgreSQL Row Level Security (RLS)

Jede tenant-scoped Tabelle hat eine `tenant_isolation_policy`-RLS-Policy. Die Policy vergleicht `tenant_id` mit der Session-Variable `app.current_tenant_id`:

```sql
USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
```

Migration `000004` ergänzt alle Policies um `WITH CHECK`-Klauseln, die auch Schreibzugriff (INSERT/UPDATE) validieren. Tabellen ohne direkte `tenant_id`-Spalte (`proxy_instructions`, `signature_units`) nutzen EXISTS-Subqueries auf die Parent-Tabelle.

### DBTransactionMiddleware

Die `DBTransactionMiddleware` (`internal/interfaces/http/middleware/db_tx.go`) öffnet pro Request eine GORM-Transaktion und setzt `SET LOCAL app.current_tenant_id`. Die Transaktion wird bei Handler-Erfolg committet, bei Fehler zurückgerollt. Ohne Tenant-ID im Context (Super-Admin-Routen) wird `SET LOCAL` übersprungen — RLS-Policies failen closed (keine Zeilen).

### TenantScopedDB

Die `TenantScopedDB` (`internal/infrastructure/persistence/tenant_scoped_db.go`) ist ein eingeschränktes Interface über `*gorm.DB`, das `Exec` nicht exponiert. Das verhindert, dass Aufrufer `SetTenantContext` mid-Transaktion aufrufen und den RLS-Tenant-Scope wechseln. Der primäre Schutz sind die fail-closed RLS-Policies; das Interface ist Defense-in-Depth.

## Dokumentenverschlüsselung

### Per-Tenant DEK

Jeder Tenant erhält einen eigenen Data Encryption Key (DEK), generiert als 32-Byte-CSPRNG-Wert. Der DEK wird mit dem Master-Key per AES-GCM gewrapped und als `encrypted_dek` in der `tenants`-Tabelle gespeichert (`tenant_key.go`).

Die Generierung ist atomar: `UpdateIfDEKMissing` setzt den DEK nur, wenn `encrypted_dek IS NULL`, sodass konkurrierende First-Time-Calls sich nicht überschreiben.

### Per-Document Key

Der Dokument-Schlüssel wird per HKDF-SHA256 aus dem Tenant-DEK und der Document-ID abgeleitet (`document_encryption.go`):

```
HKDF-SHA256(dek, salt=documentID[:], info="resivote-doc-v1") → 32-byte key
```

Die Verschlüsselung nutzt AES-GCM mit frischem Nonce pro Dokument. Das Format ist `nonce || ciphertext+tag`.

<Aside type="warning" title="DOCUMENT_ENCRYPTION_MASTER_KEY">
Die Umgebungsvariable `DOCUMENT_ENCRYPTION_MASTER_KEY` muss ein base64-kodierter 32-Byte-Schlüssel sein. Ohne diesen Key ist die Dokumentenverschlüsselung deaktiviert. Generierung: `openssl rand -base64 32`.
</Aside>

## Audit-Log

### Immutable Hash-Chain

Jeder `AuditEntry` enthält `PreviousHash` und `Hash`, die eine verkettete Hash-Chain bilden. Drei Hash-Versionen:

| Version | Algorithmus | Felder |
|---|---|---|
| v1 | Plain SHA-256 (deprecated) | Kernfelder, ohne IP/UserAgent |
| v2 | SHA-256 oder HMAC-SHA-256 | Alle Felder inkl. IP/UserAgent |
| v3 | SHA-256 oder HMAC-SHA-256 | v2 + `ImpersonatedByID` |

`ComputeHashWith` dispatcht basierend auf `HashVersion`. In Produktion ist `AUDIT_HASH_KEY` (≥32 Bytes) erforderlich — ohne ihn degradiert die Chain zu plain SHA-256, was Manipulation auf Datenbankebene nicht nachweisbar macht (ZertES/nDSG-Verletzung).

### DB-Level Immutability

PostgreSQL-Trigger blocken `UPDATE`, `DELETE` und `TRUNCATE` auf `audit_entries`, `signatures` und `signature_units` (Migration `000001`). Ein Event-Trigger (`audit_entries_ddl_guard`) blockt DDL auf `audit_entries`, außer im Wartungsmodus (`app.maintenance=on`), der in `audit_maintenance_events` protokolliert wird.

### Fail-Closed und Verifikation

| Mechanismus | Konfiguration | Standard |
|---|---|---|
| `FailClosed` | `AUDIT_FAIL_CLOSED` | `true` |
| `FailClosedThreshold` | `AUDIT_FAIL_CLOSED_THRESHOLD` | 3 |
| `VerifyInterval` | `AUDIT_VERIFY_INTERVAL` | 5 Minuten |

Bei `FailClosed=true` führt Startup-Verifikationsversagen zu `os.Exit(1)`. Periodische Verifikation benötigt `FailClosedThreshold` konsekutive Manipulationserkennungen, bevor der Server beendet wird (DoS-Mitigation: ein einzelner korrupter Eintrag crasht den Service nicht sofort). Startup-Verifikation hat immer Threshold=1.

Der Startup-Flow prüft zusätzlich die Immutability-Enforcement-Trigger und den Non-Superuser-Status der DB-Rolle.

## Check-in-Token-Sicherheit

QR-Check-in-Tokens werden mit HMAC-SHA-256 signiert (`CheckInTokenService`). Der Signing-Key ist `CHECKIN_TOKEN_SIGNING_KEY`.

<Aside type="warning" title="Produktionskritische Umgebungsvariablen">
In Produktion (`APP_ENV=production`) sind folgende Umgebungsvariablen **zwingend erforderlich** — der Server verweigert den Start bei Fehlen oder zu kurzem Wert:

- **`AUDIT_HASH_KEY`** — ≥32 Bytes, HMAC-SHA-256 für Audit-Hash-Chain (ZertES/nDSG)
- **`CHECKIN_TOKEN_SIGNING_KEY`** — ≥32 Bytes, HMAC-SHA-256 für QR-Check-in-Tokens
- **`APP_ENV`** — muss explizit gesetzt sein (kein Default)
- **`DOCUMENT_ENCRYPTION_MASTER_KEY`** — base64-kodierter 32-Byte AES-Key

Generierung: `openssl rand -base64 32`
</Aside>

Die Token-Gültigkeitsdauer ist `CHECKIN_TOKEN_EXPIRY` (Standard 30 Minuten). Die Token-Generierung ist rate-limited (5 req/s, Burst 10) pro User+Tenant. Die Token-Validierung ist rate-limited (10 req/s, Burst 20) pro IP.

## Security-Headers

Die `SecurityHeadersMiddleware` (`internal/interfaces/http/middleware/security.go`) setzt folgende Headers:

| Header | Wert |
|---|---|
| `Content-Security-Policy` | `default-src 'self'`; OIDC-Issuer in `connect-src` |
| `Strict-Transport-Security` | `max-age=31536000` (nur HTTPS) |
| `X-Frame-Options` | `SAMEORIGIN` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `accelerometer=(), camera=(), geolocation=(), ...` |

Die CSP erlaubt `style-src 'unsafe-inline'` (Angular-Inline-Styles) aber nicht `script-src 'unsafe-inline'`. Der OIDC-Issuer-URL wird vor dem Einbau in die CSP sanitisiert (Schema-Validierung, CSP-Metacharacter-Reject).

## Body-Limit und Rate-Limiting

- **Body-Limit** — Global `SERVER_BODY_LIMIT` (Standard 50M). Upload-Routen nutzen `STORAGE_MAX_UPLOAD_SIZE` (Standard 50M). Owner-Import: 10M. Signatur-Check-in: 5M.
- **Rate-Limiting** — `golang.org/x/time/rate` mit In-Memory-Store:
  - `/auth/config`: 10 req/s, Burst 20 (per IP)
  - `/api/v1/me`: 10 req/s, Burst 20 (per IP)
  - Super-Admin-Routen: 0.5 req/s, Burst 30 (per User)
  - QR-Token-Generierung: 5 req/s, Burst 10 (per User+Tenant)
  - Audit-Export/Evidence-Package: 10 req/s, Burst 20 (per User+Tenant)
  - Kontaktformular: 0.083 req/s, Burst 2 (per IP)

## APP_ENV-Enforcement

- `APP_ENV` muss explizit als Umgebungsvariable gesetzt sein — `config.Load()` returniert `ErrAppEnvNotSet` bei Fehlen.
- In Produktion wird `.env` **nie** geladen — alle Konfiguration muss aus dem Container/Process-Environment kommen.
- In Non-Production wird `.env` für Convenience geladen; explizite Env-Vars haben Vorrang.
- Unicode-Homograph-Attacken auf `APP_ENV` werden abgewehrt (`isASCII`-Check).

## Vote-Immutability

Stimmen sind immutable (`vote.go`). Bei Änderung wird die alte Stimme als `IsSuperseded=true` markiert und eine neue Stimme erstellt. `IsActive()` gibt `!IsSuperseded` zurück. Die Quorum-Engine und Ergebnisberechnung berücksichtigen nur aktive Stimmen.

## Signature-Tamper-Evidence

Signaturen werden in einer separaten Tabelle (`signatures`) gespeichert, nicht in `Attendance` eingebettet. DB-Trigger blocken `UPDATE`, `DELETE` und `TRUNCATE`. Die Signatur-Bilddaten (`image_data`, `bytea`) sind damit unabhängig auditerbar und manipulationssicher.

## CORS

Die `CORSMiddleware` (`internal/interfaces/http/middleware/cors.go`) validiert Origins gegen eine konfigurierte Liste. Standard-Origins (`defaultCORSOrigins` in `config.go`):

- Produktion: `https://app.resivote.ch`, `https://resivote.ch`, `https://www.resivote.ch`
- Non-Production: zusätzlich `http://localhost:4200`, `http://localhost:8081`, `http://localhost:4321`

Bei leerer Origin-Liste werden Cross-Origin-Requests fail-closed abgelehnt. `AllowCredentials` ist für Wildcard-Origins deaktiviert.

## Schweizer Rechtsreferenzen

Der Code referenziert folgende Schweizer Rechtsgrundlagen:

| Referenz | Kontext |
|---|---|
| Art. 647b/d/e ZGB | Qualified Majority Quorum (Kopf- und Wertstimmen) |
| Art. 647e ZGB | Unanimous Quorum (Abwesenheiten als implizites NEIN) |
| Art. 712g ZGB | Stimmrechtsbegrenzung, Qualified Majority bei STWEG |
| Art. 712m Abs. 2 ZGB | Zirkularbeschluss (Circular Resolution) |
| Art. 712o ZGB | Eine Unit, eine Kopfstimme |
| ZertES | Audit-Hash-Chain mit HMAC-SHA-256 (Integritätsnachweis) |
| nDSG | Datenintegrität und Manipulationsschutz |

<LinkCard title="Konfiguration" description="Alle Umgebungsvariablen und Config-Structs" href="/reference/konfiguration/" />
<LinkCard title="Check-in" description="QR-Code- und Signatur-Check-in-Anleitung" href="/guides/checkin/" />
<LinkCard title="Protokoll" description="Protokollführung und Audit-Trail" href="/guides/protokoll/" />
