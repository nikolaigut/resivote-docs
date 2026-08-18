---
title: Architektur
description: Referenzdokumentation der ResiVote Clean-Architecture-Schichten, des Technologie-Stacks und des Request-Flows.
---

import { FileTree, Aside, Steps, LinkCard } from '@astrojs/starlight/components';

ResiVote folgt einer Clean-Architecture-Struktur mit vier Schichten: **Domain**, **Application**, **Infrastructure** und **Interfaces**. Jede Schicht hängt nur nach innen ab — die Domain-Schicht kennt keine externen Abhängigkeiten.

## Verzeichnisstruktur

<FileTree>
- `internal/`
  - `domain/`
    - `entity/` — 31 Entitätsdefinitionen (Datenmodell, keine Geschäftslogik)
    - `repository/` — Repository-Interfaces (`repositories.go`, Ports für Data Access)
    - `service/` — Domänen-Services (`state_machine`, `quorum_engine`, `live_quorum`, `vote_validator`, `cost_calculator`)
  - `application/` — Service-Implementierungen und Use-Case-Interfaces (`services.go`, DI-Container)
  - `infrastructure/`
    - `persistence/` — GORM-Repositories, DB-Verbindung, Tenant-Scoped-DB, Migrationen
    - `auth/` — ZITADEL OIDC-Validierung, Admin-Client, Dev-Bootstrap
    - `encryption/` — Per-Tenant-DEK, Dokumentenverschlüsselung (AES-GCM, HKDF-SHA256)
    - `ai/` — LLM-Provider (Mistral, Ollama, llama.cpp, Mock, Disabled)
    - `conversion/` — LibreOffice-Dokument-zu-PDF-Konvertierung
    - `email/` — Resend- und Log-Email-Sender
    - `notification/` — Web-Push-Sender (webpush-go, VAPID)
    - `pdf/` — PDF-Text-Extraktion
    - `storage/` — Blob-Storage (lokales Dateisystem oder S3/MinIO)
    - `websocket/` — WebSocket-Hub und Client (`gorilla/websocket`)
  - `interfaces/`
    - `http/`
      - `handler/` — HTTP-Handler pro Ressource
      - `middleware/` — Auth, Tenant, DB-Transaktion, RBAC, Security-Headers, Community-Access, CORS, Portal
      - `dto/` — Request/Response-DTOs
      - `router.go` — Echo-Router mit allen Routengruppen und Middleware-Ketten
- `cmd/`
  - `server/main.go` — DI-Wiring und Server-Bootstrap
  - `openapi-gen/main.go` — OpenAPI-Schema-Generierung
- `frontend/` — Angular-Frontend (eingebettet via `embed.go`)
- `migrations/` — 43 SQL-Migrationen (golang-migrate)
</FileTree>

## Technologie-Stack

| Komponente | Technologie | Version |
|---|---|---|
| Sprache | Go | 1.26.3 |
| HTTP-Framework | Echo | v4.15.4 |
| ORM | GORM (postgres + sqlite) | v1.31.2 |
| PostgreSQL-Treiber | pgx/v5 | v5.6.0 |
| OIDC / Auth | ZITADEL (zitadel-go) | v3.29.1 |
| WebSocket | gorilla/websocket | v1.5.3 |
| Web-Push | webpush-go | v1.4.0 |
| S3/MinIO | minio-go | v7.2.1 |
| PDF-Generierung | gofpdf | v1.16.2 |
| HTML-Sanitizing | bluemonday | v1.0.27 |
| Excel-Import | excelize/v2 | v2.11.0 |
| Env-Konfiguration | godotenv | v1.5.1 |
| Rate-Limiting | golang.org/x/time | v0.15.0 |

### Frontend

Das Angular-Frontend liegt im Verzeichnis `frontend/` und wird über `frontend/embed.go` mit `//go:embed all:dist/browser` in das Go-Binary eingebettet. Das Frontend nutzt Angular Material und Angular-Spartan-Komponenten. Die Authentifizierung erfolgt über OIDC gegen ZITADEL.

## Dependency Injection

Die DI-Wiring erfolgt zentral in `cmd/server/main.go`. Der Ablauf:

<Steps>
1. **Konfiguration laden** — `config.Load()` liest Umgebungsvariablen; `config.Validate()` erzwingt produktionskritische Keys.
2. **Datenbank verbinden** — `persistence.NewDB()` öffnet die PostgreSQL-Verbindung (GORM).
3. **ZITADEL bootstrap** — `auth.EnsureDevZITADELSetup()` erstellt in Dev-Umgebungen Projekt, OIDC-Client und Benutzer idempotent.
4. **Domain-Services instanziieren** — `StateMachine`, `QuorumEngine`, `LiveQuorumEngine`, `VoteValidator`, `CostCalculator`.
5. **Repositories erstellen** — Alle GORM-Repositories werden mit der DB-Instanz erzeugt.
6. **Application-Services verdrahten** — Jeder Service erhält seine Repositories und Domänen-Services via Konstruktor-Injektion.
7. **Handler erstellen** — Jeder Handler erhält seine Application-Services.
8. **Router konfigurieren** — `appHttp.NewRouter()` verbindet Middleware, Routengruppen und Handler.
</Steps>

Die Service-Interfaces sind in `internal/application/services.go` definiert (z. B. `TenantService`, `MeetingService`, `VoteService`, `OwnerService`). Die konkreten Implementierungen leben im selben Package.

## Request-Flow

Eine typische API-Anfrage durchläuft folgende Middleware-Kette:

<Steps>
1. **Recover** — Panic-Recovery (`middleware.Recover`)
2. **SecurityHeaders** — CSP, HSTS, X-Frame-Options, X-Content-Type-Options (`SecurityHeadersMiddleware`)
3. **BodyLimit** — Request-Body-Limit, Standard 50M (`middleware.BodyLimit`)
4. **CORS** — Origin-Validierung mit konfigurierten Origins (`CORSMiddleware`)
5. **Audit** — Audit-Logging für signifikante Aktionen (`AuditMiddleware`)
6. **Auth** — JWT-Validierung gegen ZITADEL-JWKS (`AuthMiddleware`)
7. **Tenant** — Tenant-Auflösung aus Header/Path/Query, Membership-Check (`TenantMiddleware`)
8. **DBTransaction** — Request-scoped Transaktion mit `SET LOCAL app.current_tenant_id` für RLS (`DBTransactionMiddleware`)
9. **CommunityAccess** — Owner-Zugriff auf eigene Communities/Units beschränkt (`CommunityAccessMiddleware`)
10. **Handler → Service → Repository** — Request wird verarbeitet
</Steps>

Super-Admin-Routen (`/api/v1/tenants`, `/api/v1/admin/*`) umgehen TenantMiddleware und CommunityAccessMiddleware, nutzen aber `RequireSuperAdmin` und `DBTransactionMiddleware`.

Feature-Gate-Middleware steuert optionale Module:

- `MeetingEnabledMiddleware` — prüft `tenant.meeting_enabled` für alle Digital-Meeting-Routen
- `PortalEnabledMiddleware` — prüft `tenant.portal_enabled` für alle Customer-Portal-Routen

## WebSocket-Live-Updates

WebSocket-Verbindungen werden über `gorilla/websocket` abgewickelt. Die `Hub`-Struktur (`internal/infrastructure/websocket/hub.go`) verwaltet verbundene Clients und broadcastet Nachrichten. Der `WebSocketHandler` registriert sich unter `/ws/meetings/:meetingId` und nutzt Token-basierte Authentifizierung via Query-Parameter.

Live-Updates betreffen:

- Live-Quorum und Anwesenheit während einer Versammlung
- Abstimmungsergebnisse in Echtzeit
- Präsentations-Slide-Wechsel und Timer-Status
- Protokoll-Änderungen

## Background-Worker

Vier Background-Worker laufen als Goroutinen mit kancellablem Context:

| Worker | Konfiguration | Funktion |
|---|---|---|
| Audit-Verifikation | `AUDIT_VERIFY_INTERVAL` (Standard 5m) | Periodische Hash-Chain-Integritätsprüfung |
| Scheduled-Email | `EMAIL_PROCESS_INTERVAL` (Standard 1m) | Versendet fällige terminierte Emails |
| Billing | `BILLING_WORKER_INTERVAL` (Standard 1h) | Erstellt monatliche Rechnungen pro Tenant |
| Demo-Reset | Täglich um 00:00 UTC + Offset | Rotiert den Demo-Tenant und re-seeded Beispieldaten |

Zusätzlich prüft der Startup-Flow die Audit-Chain-Integrität und die Immutability-Enforcement-Trigger. Bei `FailClosed=true` und erkannter Manipulation verweigert der Server den Start (`os.Exit(1)`).

## OpenAPI-Generierung

Das Verzeichnis `cmd/openapi-gen/` enthält ein eigenständiges Go-Programm, das das OpenAPI-Schema aus den Handler-Annotationen und DTO-Strukturen generiert. Das Ergebnis ist eine `openapi.json`, die die vollständige API-Spezifikation enthält.

<Aside type="note" title="Verwandte Seiten">
- [API-Referenz](/reference/api/) — Endpunkt-Dokumentation
- [Sicherheit und Compliance](/reference/sicherheit/) — Auth, RLS, Verschlüsselung, Audit
- [Konfiguration](/reference/konfiguration/) — Umgebungsvariablen und Config-Struct
</Aside>
