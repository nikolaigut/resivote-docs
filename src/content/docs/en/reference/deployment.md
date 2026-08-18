---
title: Deployment and Development
description: Local development, build, tests, migrations, and production deployment options for ResiVote.
---

import { Steps, Aside, CardGrid, Card, LinkCard, Tabs, TabItem } from '@astrojs/starlight/components';

## Local Development

### Prerequisites

- Go 1.26+
- Node.js 22+ (Angular frontend)
- Docker & Docker Compose
- `task` (Taskfile runner)
- `golang-migrate` CLI (installed automatically via `task migrate-install`)

### Start the Dev Stack

<Steps>
1. **Start infrastructure**

   Starts Postgres and ZITADEL via `docker-compose.dev.yml`:

   ```sh
   task docker-dev-up
   ```

   Waits until ZITADEL is healthy, extracts the bootstrap PAT, and writes the dev configuration to `.env`:

   ```sh
   task zitadel-pat
   ```

   Or both in one step (including migrations):

   ```sh
   task start-dev
   ```

2. **Run database migrations**

   ```sh
   task migrate-up
   ```

   Uses `golang-migrate` v4.19.1 with the DB URL from `.env` (default: `postgres://resivote:resivote@localhost:45432/resivote?sslmode=disable`).

3. **Start backend**

   ```sh
   task run-dev
   ```

   Starts the Go server with `APP_ENV=development go run ./cmd/server`.

4. **Start frontend**

   ```sh
   cd frontend && npm start
   ```

   Angular dev server at `http://localhost:4200`.
</Steps>

### Dev Ports

| Service | URL / Port |
|---|---|
| Postgres | `localhost:45432` (user/db: `resivote`/`resivote`) |
| ZITADEL | `http://localhost:18180` |
| Backend | `http://localhost:18080` |
| Frontend | `http://localhost:4200` |

### Dev Configuration

`task zitadel-pat` writes the following values to `.env`:

- `APP_ENV=development`
- `DB_HOST=localhost`, `DB_PORT=45432`, `DB_SSLMODE=disable`
- `ZITADEL_BASE_URL=http://localhost:18180`
- `ZITADEL_PAT=<bootstrap-pat>`
- `ZITADEL_ISSUER_OVERRIDE=http://localhost:4200` (frontend proxy for OIDC)
- `SERVER_PORT=18080`
- `CORS_ORIGINS=http://localhost:4200`

## Build

| Task | Description |
|---|---|
| `task build` | Builds frontend (`npm run build`), then Go binary to `bin/resivote` |
| `task build-frontend` | Build frontend assets only |
| `task run` | Build and start the binary |
| `task docker-build` | Build the production Docker image (`deployments/docker/Dockerfile`) |

### Dockerfile

The multi-stage Dockerfile (`deployments/docker/Dockerfile`) performs the following steps:

1. **Frontend stage:** Node 22, `npm install`, `npm run build` → Angular `dist/`
2. **Builder stage:** Go 1.26, copies frontend assets into the Go build context, builds with `-tags production` (compiles out JWT bypass), installs `golang-migrate` CLI
3. **Runtime stage:** Alpine 3.19 with `ca-certificates`, `tzdata`, `libreoffice`, `poppler-utils`; non-root user `appuser`; binary, migrations, and `migrate` CLI copied

## Tests

| Task | Description |
|---|---|
| `task test` | All tests with `-race -count=1` |
| `task test-unit` | Unit tests (`internal/domain/...`, `-short`) |
| `task test-integration` | Integration tests (`internal/infrastructure/...`, `-tags=integration`) |
| `task test-e2e` | End-to-end tests (`test/e2e/...`, `-tags=e2e`) |
| `task test-cover` | Tests with coverage report (`coverage.html`) |
| `task lint` | `golangci-lint run ./...` |
| `task vet` | `go vet ./...` |

## Migrations

ResiVote uses `golang-migrate` v4.19.1. Migrations are in the `migrations/` directory (43 versions, sequentially numbered).

| Task | Description |
|---|---|
| `task migrate-up` | Apply all pending migrations |
| `task migrate-down` | Roll back the last migration |
| `task migrate-create` | Create a new migration (`name=<name>`) |
| `task migrate-force` | Force migration to a specific version |
| `task migrate-install` | Install `golang-migrate` CLI (if missing) |

<Aside type="note" title="RLS Policies">
  Migration `000004` adds `WITH CHECK` clauses to all RLS policies. RLS enforcement sets `SET LOCAL app.current_tenant_id` per request via `DBTransactionMiddleware`.
</Aside>

## OpenAPI and Client Generation

```sh
task generate-openapi   # generates openapi.json from Echo routes (cmd/openapi-gen)
task generate-client    # generates Angular API client (npm run generate:api)
```

## Production Deployment

<CardGrid>
<Card title="Deploio (Nine.ch)" href="#deploio">
  Swiss PaaS, ISO 27001, Zurich. Configuration via `.deploio.yaml`.
</Card>
<Card title="Docker Compose" href="#docker">
  `deployments/docker/docker-compose.yml` with Postgres, ZITADEL, and API.
</Card>
<Card title="Kubernetes" href="#kubernetes">
  Manifests in `deployments/k8s/` (Deployment, Service, ConfigMap, Secrets).
</Card>
<Card title="ZITADEL" href="#zitadel">
  ZITADEL deployment via `deployments/zitadel/`.
</Card>
</CardGrid>

### Deploio

`.deploio.yaml` defines the Deploio app configuration:

- **Size:** `micro` (512MB), `mini` (1GB), `standard-1/2/4`
- **Port:** `8080`
- **Replicas:** `1` (scalable in the cockpit)
- **Basic Auth:** disabled (ZITADEL OIDC)
- **Non-secret env vars:** `APP_ENV=production`, `SERVER_PORT=8080`, `DB_SSLMODE=require`, `DB_PORT=5432`
- **Deploy job:** `run-migrations` runs `migrate -path /app/migrations -database "$DB_URL" up` before each release

Secret variables are set via `nctl update app resivote --env=KEY=VALUE` or the cockpit:

- `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_URL`
- `ZITADEL_BASE_URL`, `ZITADEL_PROJECT_ID`, `ZITADEL_CLIENT_ID`
- `ZITADEL_TOKEN_EXCHANGE_CLIENT_ID`, `ZITADEL_PAT`, `ZITADEL_CLIENT_SECRET`
- `CHECKIN_TOKEN_SIGNING_KEY`, `AUDIT_HASH_KEY`, `CORS_ORIGINS`

Full instructions: `deployments/deploio/README.md`.

### Docker

`deployments/docker/docker-compose.yml` defines three services:

- **postgres:** PostgreSQL 18, port `45432:5432`, init script for multi-DB (`resivote`, `zitadel`)
- **zitadel:** ZITADEL v2.71.4, port `18180:8080`
- **api:** ResiVote API, builds from the Dockerfile, port `18080:8080`, `APP_ENV=production`

### Kubernetes

Manifests in `deployments/k8s/`:

| File | Resource |
|---|---|
| `deployment.yaml` | Deployment with 3 replicas, non-root security context, resource limits |
| `service.yaml` | ClusterIP service on port 8080 |
| `configmap.yaml` | Non-secret configuration (`SERVER_PORT`, `CORS_ORIGINS`, `DB_HOST`, `DB_SSLMODE`, `ZITADEL_BASE_URL`, `WS_PING_PERIOD`, `WS_PONG_WAIT`) |
| `secrets.yaml` | Secrets (Base64-encoded) |

### ZITADEL

`deployments/zitadel/` contains ZITADEL action scripts for the bootstrap setup (role injection into JWT claims, flow bindings).

## Embedded Frontend

The Angular frontend is embedded into the Go binary via `embed.FS` (`frontend/dist`). Echo serves the static assets from `dist/browser` with SPA fallback to `index.html`. In production, there is only a single binary — frontend and backend are delivered together.

## Background Workers

The following background workers run in production:

| Worker | Configuration | Description |
|---|---|---|
| Audit verification | `AUDIT_VERIFY_INTERVAL` (5m) | Periodic hash chain integrity check |
| Scheduled email worker | `EMAIL_PROCESS_INTERVAL` (1m) | Sends due scheduled emails |
| Billing worker | `BILLING_WORKER_INTERVAL` (1h) | Creates monthly invoices for all active tenants |
| Demo reset worker | `DEMO_RESET_ENABLED` | Daily reset of the demo tenant at 00:00 UTC (optional) |

All workers use a cancellable context that is aborted on the shutdown signal.

## Production Security Checklist

<Aside type="danger" title="Production Security Checklist">
  Ensure the following before every production deployment:

  - **`APP_ENV=production`** set
  - **Binary built with `-tags production`** (JWT bypass compiled out)
  - **`AUDIT_HASH_KEY`** >= 32 bytes, CSPRNG-generated (`openssl rand -base64 32`)
  - **`CHECKIN_TOKEN_SIGNING_KEY`** >= 32 bytes, CSPRNG-generated
  - **`DOCUMENT_ENCRYPTION_MASTER_KEY`** base64-encoded 32-byte AES key
  - **`DB_SSLMODE=require`** set
  - **ZITADEL secrets** set (`CLIENT_SECRET`, `PAT`, `TOKEN_EXCHANGE_CLIENT_ID`)
  - **No `.env` loading** in production (automatically disabled)
  - **`CORS_ORIGINS`** restricted to production domain
  - **Audit immutability check** passed at startup (triggers active, non-superuser role)
</Aside>

<LinkCard title="Configuration (Environment Variables)" href="../reference/konfiguration/" description="All environment variables with defaults and required fields." />
<LinkCard title="REST API" href="../reference/api/" description="API endpoints, middlewares, and error codes." />
