---
title: Architecture
description: Reference documentation of the ResiVote clean architecture layers, technology stack, and request flow.
---

import { FileTree, Aside, Steps, LinkCard } from '@astrojs/starlight/components';

ResiVote follows a clean architecture structure with four layers: **Domain**, **Application**, **Infrastructure**, and **Interfaces**. Each layer depends only inward — the domain layer has no external dependencies.

## Directory Structure

<FileTree>
- `internal/`
  - `domain/`
    - `entity/` — 31 entity definitions (data model, no business logic)
    - `repository/` — Repository interfaces (`repositories.go`, ports for data access)
    - `service/` — Domain services (`state_machine`, `quorum_engine`, `live_quorum`, `vote_validator`, `cost_calculator`)
  - `application/` — Service implementations and use-case interfaces (`services.go`, DI container)
  - `infrastructure/`
    - `persistence/` — GORM repositories, DB connection, tenant-scoped DB, migrations
    - `auth/` — ZITADEL OIDC validation, admin client, dev bootstrap
    - `encryption/` — Per-tenant DEK, document encryption (AES-GCM, HKDF-SHA256)
    - `ai/` — LLM providers (Mistral, Ollama, llama.cpp, Mock, Disabled)
    - `conversion/` — LibreOffice document-to-PDF conversion
    - `email/` — Resend and log email senders
    - `notification/` — Web push sender (webpush-go, VAPID)
    - `pdf/` — PDF text extraction
    - `storage/` — Blob storage (local filesystem or S3/MinIO)
    - `websocket/` — WebSocket hub and client (`gorilla/websocket`)
  - `interfaces/`
    - `http/`
      - `handler/` — HTTP handlers per resource
      - `middleware/` — Auth, tenant, DB transaction, RBAC, security headers, community access, CORS, portal
      - `dto/` — Request/Response DTOs
      - `router.go` — Echo router with all route groups and middleware chains
- `cmd/`
  - `server/main.go` — DI wiring and server bootstrap
  - `openapi-gen/main.go` — OpenAPI schema generation
- `frontend/` — Angular frontend (embedded via `embed.go`)
- `migrations/` — 43 SQL migrations (golang-migrate)
</FileTree>

## Technology Stack

| Component | Technology | Version |
|---|---|---|
| Language | Go | 1.26.3 |
| HTTP Framework | Echo | v4.15.4 |
| ORM | GORM (postgres + sqlite) | v1.31.2 |
| PostgreSQL Driver | pgx/v5 | v5.6.0 |
| OIDC / Auth | ZITADEL (zitadel-go) | v3.29.1 |
| WebSocket | gorilla/websocket | v1.5.3 |
| Web Push | webpush-go | v1.4.0 |
| S3/MinIO | minio-go | v7.2.1 |
| PDF Generation | gofpdf | v1.16.2 |
| HTML Sanitizing | bluemonday | v1.0.27 |
| Excel Import | excelize/v2 | v2.11.0 |
| Env Configuration | godotenv | v1.5.1 |
| Rate Limiting | golang.org/x/time | v0.15.0 |

### Frontend

The Angular frontend is located in the `frontend/` directory and embedded into the Go binary via `frontend/embed.go` with `//go:embed all:dist/browser`. The frontend uses Angular Material and Angular-Spartan components. Authentication is done via OIDC against ZITADEL.

## Dependency Injection

DI wiring is centralized in `cmd/server/main.go`. The process:

<Steps>
1. **Load configuration** — `config.Load()` reads environment variables; `config.Validate()` enforces production-critical keys.
2. **Connect database** — `persistence.NewDB()` opens the PostgreSQL connection (GORM).
3. **ZITADEL bootstrap** — `auth.EnsureDevZITADELSetup()` creates project, OIDC client, and users idempotently in dev environments.
4. **Instantiate domain services** — `StateMachine`, `QuorumEngine`, `LiveQuorumEngine`, `VoteValidator`, `CostCalculator`.
5. **Create repositories** — All GORM repositories are created with the DB instance.
6. **Wire application services** — Each service receives its repositories and domain services via constructor injection.
7. **Create handlers** — Each handler receives its application services.
8. **Configure router** — `appHttp.NewRouter()` connects middleware, route groups, and handlers.
</Steps>

The service interfaces are defined in `internal/application/services.go` (e.g. `TenantService`, `MeetingService`, `VoteService`, `OwnerService`). The concrete implementations live in the same package.

## Request Flow

A typical API request goes through the following middleware chain:

<Steps>
1. **Recover** — Panic recovery (`middleware.Recover`)
2. **SecurityHeaders** — CSP, HSTS, X-Frame-Options, X-Content-Type-Options (`SecurityHeadersMiddleware`)
3. **BodyLimit** — Request body limit, default 50M (`middleware.BodyLimit`)
4. **CORS** — Origin validation with configured origins (`CORSMiddleware`)
5. **Audit** — Audit logging for significant actions (`AuditMiddleware`)
6. **Auth** — JWT validation against ZITADEL JWKS (`AuthMiddleware`)
7. **Tenant** — Tenant resolution from header/path/query, membership check (`TenantMiddleware`)
8. **DBTransaction** — Request-scoped transaction with `SET LOCAL app.current_tenant_id` for RLS (`DBTransactionMiddleware`)
9. **CommunityAccess** — Owner access restricted to own communities/units (`CommunityAccessMiddleware`)
10. **Handler → Service → Repository** — Request is processed
</Steps>

Super admin routes (`/api/v1/tenants`, `/api/v1/admin/*`) bypass TenantMiddleware and CommunityAccessMiddleware, but use `RequireSuperAdmin` and `DBTransactionMiddleware`.

Feature-gate middleware controls optional modules:

- `MeetingEnabledMiddleware` — checks `tenant.meeting_enabled` for all digital meeting routes
- `PortalEnabledMiddleware` — checks `tenant.portal_enabled` for all customer portal routes

## WebSocket Live Updates

WebSocket connections are handled via `gorilla/websocket`. The `Hub` structure (`internal/infrastructure/websocket/hub.go`) manages connected clients and broadcasts messages. The `WebSocketHandler` registers at `/ws/meetings/:meetingId` and uses token-based authentication via query parameter.

Live updates cover:

- Live quorum and attendance during a meeting
- Voting results in real time
- Presentation slide changes and timer status
- Minutes changes

## Background Workers

Four background workers run as goroutines with a cancellable context:

| Worker | Configuration | Function |
|---|---|---|
| Audit verification | `AUDIT_VERIFY_INTERVAL` (default 5m) | Periodic hash chain integrity check |
| Scheduled email | `EMAIL_PROCESS_INTERVAL` (default 1m) | Sends due scheduled emails |
| Billing | `BILLING_WORKER_INTERVAL` (default 1h) | Creates monthly invoices per tenant |
| Demo reset | Daily at 00:00 UTC + offset | Rotates the demo tenant and re-seeds sample data |

Additionally, the startup flow checks audit chain integrity and immutability enforcement triggers. With `FailClosed=true` and detected tampering, the server refuses to start (`os.Exit(1)`).

## OpenAPI Generation

The `cmd/openapi-gen/` directory contains a standalone Go program that generates the OpenAPI schema from handler annotations and DTO structures. The result is an `openapi.json` containing the complete API specification.

<Aside type="note" title="Related Pages">
- [API Reference](/reference/api/) — Endpoint documentation
- [Security and Compliance](/reference/sicherheit/) — Auth, RLS, encryption, audit
- [Configuration](/reference/konfiguration/) — Environment variables and config struct
</Aside>
