---
title: Deployment und Entwicklung
description: Lokale Entwicklung, Build, Tests, Migrationen und Produktions-Deployment-Optionen für ResiVote.
---

import { Steps, Aside, CardGrid, Card, LinkCard, Tabs, TabItem } from '@astrojs/starlight/components';

## Lokale Entwicklung

### Voraussetzungen

- Go 1.26+
- Node.js 22+ (Angular-Frontend)
- Docker & Docker Compose
- `task` (Taskfile-Runner)
- `golang-migrate` CLI (wird automatisch installiert via `task migrate-install`)

### Dev-Stack starten

<Steps>
1. **Infrastruktur hochfahren**

   Startet Postgres und ZITADEL via `docker-compose.dev.yml`:

   ```sh
   task docker-dev-up
   ```

   Wartet, bis ZITADEL healthy ist, extrahiert den Bootstrap-PAT und schreibt die Dev-Konfiguration in `.env`:

   ```sh
   task zitadel-pat
   ```

   Oder beides in einem Schritt (inkl. Migrationen):

   ```sh
   task start-dev
   ```

2. **Datenbank-Migrationen ausführen**

   ```sh
   task migrate-up
   ```

   Verwendet `golang-migrate` v4.19.1 mit der DB-URL aus `.env` (Default: `postgres://resivote:resivote@localhost:45432/resivote?sslmode=disable`).

3. **Backend starten**

   ```sh
   task run-dev
   ```

   Startet den Go-Server mit `APP_ENV=development go run ./cmd/server`.

4. **Frontend starten**

   ```sh
   cd frontend && npm start
   ```

   Angular-Dev-Server auf `http://localhost:4200`.
</Steps>

### Dev-Ports

| Dienst | URL / Port |
|---|---|
| Postgres | `localhost:45432` (User/DB: `resivote`/`resivote`) |
| ZITADEL | `http://localhost:18180` |
| Backend | `http://localhost:18080` |
| Frontend | `http://localhost:4200` |

### Dev-Konfiguration

`task zitadel-pat` schreibt folgende Werte in `.env`:

- `APP_ENV=development`
- `DB_HOST=localhost`, `DB_PORT=45432`, `DB_SSLMODE=disable`
- `ZITADEL_BASE_URL=http://localhost:18180`
- `ZITADEL_PAT=<bootstrap-pat>`
- `ZITADEL_ISSUER_OVERRIDE=http://localhost:4200` (Frontend-Proxy für OIDC)
- `SERVER_PORT=18080`
- `CORS_ORIGINS=http://localhost:4200`

## Build

| Task | Beschreibung |
|---|---|
| `task build` | Baut Frontend (`npm run build`), dann Go-Binary nach `bin/resivote` |
| `task build-frontend` | Nur Frontend-Assets bauen |
| `task run` | Baut und startet das Binary |
| `task docker-build` | Baut das Produktions-Docker-Image (`deployments/docker/Dockerfile`) |

### Dockerfile

Das Multi-Stage-Dockerfile (`deployments/docker/Dockerfile`) führt folgende Schritte aus:

1. **Frontend-Stage:** Node 22, `npm install`, `npm run build` → Angular `dist/`
2. **Builder-Stage:** Go 1.26, kopiert Frontend-Assets in den Go-Build-Kontext, baut mit `-tags production` (kompiliert JWT-Bypass aus), installiert `golang-migrate` CLI
3. **Runtime-Stage:** Alpine 3.19 mit `ca-certificates`, `tzdata`, `libreoffice`, `poppler-utils`; Non-Root-User `appuser`; Binary, Migrationen und `migrate`-CLI kopiert

## Tests

| Task | Beschreibung |
|---|---|
| `task test` | Alle Tests mit `-race -count=1` |
| `task test-unit` | Unit-Tests (`internal/domain/...`, `-short`) |
| `task test-integration` | Integration-Tests (`internal/infrastructure/...`, `-tags=integration`) |
| `task test-e2e` | End-to-End-Tests (`test/e2e/...`, `-tags=e2e`) |
| `task test-cover` | Tests mit Coverage-Report (`coverage.html`) |
| `task lint` | `golangci-lint run ./...` |
| `task vet` | `go vet ./...` |

## Migrationen

ResiVote verwendet `golang-migrate` v4.19.1. Migrationen liegen im Verzeichnis `migrations/` (43 Versionen, sequenziell nummeriert).

| Task | Beschreibung |
|---|---|
| `task migrate-up` | Alle ausstehenden Migrationen anwenden |
| `task migrate-down` | Letzte Migration zurückrollen |
| `task migrate-create` | Neue Migration erstellen (`name=<name>`) |
| `task migrate-force` | Migration auf bestimmte Version forcieren |
| `task migrate-install` | `golang-migrate` CLI installieren (falls fehlt) |

<Aside type="note" title="RLS-Policies">
  Migration `000004` fügt `WITH CHECK`-Klauseln zu allen RLS-Policies hinzu. Die RLS-Enforcement setzt `SET LOCAL app.current_tenant_id` pro Request via `DBTransactionMiddleware`.
</Aside>

## OpenAPI und Client-Generierung

```sh
task generate-openapi   # generiert openapi.json aus Echo-Routen (cmd/openapi-gen)
task generate-client    # generiert Angular-API-Client (npm run generate:api)
```

## Produktions-Deployment

<CardGrid>
<Card title="Deploio (Nine.ch)" href="#deploio">
  Schweizer PaaS, ISO 27001, Zürich. Konfiguration via `.deploio.yaml`.
</Card>
<Card title="Docker Compose" href="#docker">
  `deployments/docker/docker-compose.yml` mit Postgres, ZITADEL und API.
</Card>
<Card title="Kubernetes" href="#kubernetes">
  Manifeste in `deployments/k8s/` (Deployment, Service, ConfigMap, Secrets).
</Card>
<Card title="ZITADEL" href="#zitadel">
  ZITADEL-Deployment via `deployments/zitadel/`.
</Card>
</CardGrid>

### Deploio

`.deploio.yaml` definiert die Deploio-App-Konfiguration:

- **Size:** `micro` (512MB), `mini` (1GB), `standard-1/2/4`
- **Port:** `8080`
- **Replicas:** `1` (skalierbar im Cockpit)
- **Basic Auth:** deaktiviert (ZITADEL OIDC)
- **Nicht-geheime Env-Vars:** `APP_ENV=production`, `SERVER_PORT=8080`, `DB_SSLMODE=require`, `DB_PORT=5432`
- **Deploy-Job:** `run-migrations` führt `migrate -path /app/migrations -database "$DB_URL" up` vor jedem Release aus

Geheime Variablen werden via `nctl update app resivote --env=KEY=VALUE` oder Cockpit gesetzt:

- `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_URL`
- `ZITADEL_BASE_URL`, `ZITADEL_PROJECT_ID`, `ZITADEL_CLIENT_ID`
- `ZITADEL_TOKEN_EXCHANGE_CLIENT_ID`, `ZITADEL_PAT`, `ZITADEL_CLIENT_SECRET`
- `CHECKIN_TOKEN_SIGNING_KEY`, `AUDIT_HASH_KEY`, `CORS_ORIGINS`

Vollständige Anleitung: `deployments/deploio/README.md`.

### Docker

`deployments/docker/docker-compose.yml` definiert drei Services:

- **postgres:** PostgreSQL 18, Port `45432:5432`, init-Skript für Multi-DB (`resivote`, `zitadel`)
- **zitadel:** ZITADEL v2.71.4, Port `18180:8080`
- **api:** ResiVote-API, baut aus dem Dockerfile, Port `18080:8080`, `APP_ENV=production`

### Kubernetes

Manifeste in `deployments/k8s/`:

| Datei | Ressource |
|---|---|
| `deployment.yaml` | Deployment mit 3 Replicas, Non-Root-Security-Context, Resource-Limits |
| `service.yaml` | ClusterIP-Service auf Port 8080 |
| `configmap.yaml` | Nicht-geheime Konfiguration (`SERVER_PORT`, `CORS_ORIGINS`, `DB_HOST`, `DB_SSLMODE`, `ZITADEL_BASE_URL`, `WS_PING_PERIOD`, `WS_PONG_WAIT`) |
| `secrets.yaml` | Geheimnisse (Base64-kodiert) |

### ZITADEL

`deployments/zitadel/` enthält ZITADEL-Action-Skripte für das Bootstrap-Setup (Rollen-Injektion in JWT-Claims, Flow-Bindings).

## Eingebettetes Frontend

Das Angular-Frontend wird via `embed.FS` (`frontend/dist`) in das Go-Binary eingebettet. Echo serviert die statischen Assets aus `dist/browser` mit SPA-Fallback auf `index.html`. In Produktion existiert nur ein einziger Binary — Frontend und Backend werden zusammen ausgeliefert.

## Hintergrund-Worker

Folgende Hintergrund-Worker laufen in Produktion:

| Worker | Konfiguration | Beschreibung |
|---|---|---|
| Audit-Verifikation | `AUDIT_VERIFY_INTERVAL` (5m) | Periodische Hash-Chain-Integritätsprüfung |
| Scheduled-Email-Worker | `EMAIL_PROCESS_INTERVAL` (1m) | Versendet fällige geplante E-Mails |
| Billing-Worker | `BILLING_WORKER_INTERVAL` (1h) | Erstellt monatliche Rechnungen für alle aktiven Tenants |
| Demo-Reset-Worker | `DEMO_RESET_ENABLED` | Täglicher Reset des Demo-Tenants um 00:00 UTC (optional) |

Alle Worker verwenden einen cancellable Context, der beim Shutdown-Signal abgebrochen wird.

## Produktions-Sicherheits-Checkliste

<Aside type="danger" title="Produktions-Sicherheits-Checkliste">
  Vor jedem Produktions-Deployment sicherstellen:

  - **`APP_ENV=production`** gesetzt
  - **Binary mit `-tags production` gebaut** (JWT-Bypass auskompiliert)
  - **`AUDIT_HASH_KEY`** >= 32 Bytes, CSPRNG-generiert (`openssl rand -base64 32`)
  - **`CHECKIN_TOKEN_SIGNING_KEY`** >= 32 Bytes, CSPRNG-generiert
  - **`DOCUMENT_ENCRYPTION_MASTER_KEY`** base64-kodierter 32-Byte-AES-Key
  - **`DB_SSLMODE=require`** gesetzt
  - **ZITADEL-Secrets** gesetzt (`CLIENT_SECRET`, `PAT`, `TOKEN_EXCHANGE_CLIENT_ID`)
  - **Kein `.env`-Loading** in Produktion (automatisch deaktiviert)
  - **`CORS_ORIGINS`** auf Produktionsdomain eingeschränkt
  - **Audit-Immutability-Check** beim Startup bestanden (Trigger aktiv, Non-Superuser-Role)
</Aside>

<LinkCard title="Konfiguration (Umgebungsvariablen)" href="../reference/konfiguration/" description="Alle Umgebungsvariablen mit Defaults und Pflichtfeldern." />
<LinkCard title="REST API" href="../reference/api/" description="API-Endpunkte, Middlewares und Fehlercodes." />
