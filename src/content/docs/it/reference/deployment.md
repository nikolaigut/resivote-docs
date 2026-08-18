---
title: Deployment e sviluppo
description: Sviluppo locale, build, test, migrazioni e opzioni di deployment di produzione per ResiVote.
---

import { Steps, Aside, CardGrid, Card, LinkCard, Tabs, TabItem } from '@astrojs/starlight/components';

## Sviluppo locale

### Requisiti

- Go 1.26+
- Node.js 22+ (frontend Angular)
- Docker & Docker Compose
- `task` (Taskfile-runner)
- CLI `golang-migrate` (viene installata automaticamente tramite `task migrate-install`)

### Avviare lo stack dev

<Steps>
1. **Avviare l'infrastruttura**

   Avvia Postgres e ZITADEL tramite `docker-compose.dev.yml`:

   ```sh
   task docker-dev-up
   ```

   Attende finché ZITADEL è healthy, estrae il PAT di bootstrap e scrive la configurazione dev in `.env`:

   ```sh
   task zitadel-pat
   ```

   Oppure entrambi in un unico passo (incl. migrazioni):

   ```sh
   task start-dev
   ```

2. **Eseguire le migrazioni del database**

   ```sh
   task migrate-up
   ```

   Utilizza `golang-migrate` v4.19.1 con l'URL del DB da `.env` (predefinito: `postgres://resivote:resivote@localhost:45432/resivote?sslmode=disable`).

3. **Avviare il backend**

   ```sh
   task run-dev
   ```

   Avvia il server Go con `APP_ENV=development go run ./cmd/server`.

4. **Avviare il frontend**

   ```sh
   cd frontend && npm start
   ```

   Dev-server Angular su `http://localhost:4200`.
</Steps>

### Porte dev

| Servizio | URL / Porta |
|---|---|
| Postgres | `localhost:45432` (utente/DB: `resivote`/`resivote`) |
| ZITADEL | `http://localhost:18180` |
| Backend | `http://localhost:18080` |
| Frontend | `http://localhost:4200` |

### Configurazione dev

`task zitadel-pat` scrive i seguenti valori in `.env`:

- `APP_ENV=development`
- `DB_HOST=localhost`, `DB_PORT=45432`, `DB_SSLMODE=disable`
- `ZITADEL_BASE_URL=http://localhost:18180`
- `ZITADEL_PAT=<bootstrap-pat>`
- `ZITADEL_ISSUER_OVERRIDE=http://localhost:4200` (proxy frontend per OIDC)
- `SERVER_PORT=18080`
- `CORS_ORIGINS=http://localhost:4200`

## Build

| Task | Descrizione |
|---|---|
| `task build` | Costruisce il frontend (`npm run build`), poi il binary Go in `bin/resivote` |
| `task build-frontend` | Costruisce solo gli asset del frontend |
| `task run` | Costruisce e avvia il binary |
| `task docker-build` | Costruisce l'immagine Docker di produzione (`deployments/docker/Dockerfile`) |

### Dockerfile

Il Dockerfile multi-stage (`deployments/docker/Dockerfile`) esegue i seguenti passaggi:

1. **Stage frontend:** Node 22, `npm install`, `npm run build` → Angular `dist/`
2. **Stage builder:** Go 1.26, copia gli asset del frontend nel contesto di build Go, costruisce con `-tags production` (compila fuori il bypass JWT), installa la CLI `golang-migrate`
3. **Stage runtime:** Alpine 3.19 con `ca-certificates`, `tzdata`, `libreoffice`, `poppler-utils`; utente non-root `appuser`; binary, migrazioni e CLI `migrate` copiati

## Test

| Task | Descrizione |
|---|---|
| `task test` | Tutti i test con `-race -count=1` |
| `task test-unit` | Unit-test (`internal/domain/...`, `-short`) |
| `task test-integration` | Test di integrazione (`internal/infrastructure/...`, `-tags=integration`) |
| `task test-e2e` | Test end-to-end (`test/e2e/...`, `-tags=e2e`) |
| `task test-cover` | Test con report di coverage (`coverage.html`) |
| `task lint` | `golangci-lint run ./...` |
| `task vet` | `go vet ./...` |

## Migrazioni

ResiVote utilizza `golang-migrate` v4.19.1. Le migrazioni si trovano nella directory `migrations/` (43 versioni, numerate sequenzialmente).

| Task | Descrizione |
|---|---|
| `task migrate-up` | Applicare tutte le migrazioni in sospeso |
| `task migrate-down` | Annullare l'ultima migrazione |
| `task migrate-create` | Creare una nuova migrazione (`name=<nome>`) |
| `task migrate-force` | Forzare la migrazione a una versione specifica |
| `task migrate-install` | Installare la CLI `golang-migrate` (se manca) |

<Aside type="note" title="Policy RLS">
  La migrazione `000004` aggiunge clausole `WITH CHECK` a tutte le policy RLS. L'imposizione RLS imposta `SET LOCAL app.current_tenant_id` per ogni request tramite `DBTransactionMiddleware`.
</Aside>

## OpenAPI e generazione del client

```sh
task generate-openapi   # genera openapi.json dalle route Echo (cmd/openapi-gen)
task generate-client    # genera il client API Angular (npm run generate:api)
```

## Deployment di produzione

<CardGrid>
<Card title="Deploio (Nine.ch)" href="#deploio">
  PaaS svizzero, ISO 27001, Zurigo. Configurazione tramite `.deploio.yaml`.
</Card>
<Card title="Docker Compose" href="#docker">
  `deployments/docker/docker-compose.yml` con Postgres, ZITADEL e API.
</Card>
<Card title="Kubernetes" href="#kubernetes">
  Manifest in `deployments/k8s/` (Deployment, Service, ConfigMap, Secrets).
</Card>
<Card title="ZITADEL" href="#zitadel">
  Deployment ZITADEL tramite `deployments/zitadel/`.
</Card>
</CardGrid>

### Deploio

`.deploio.yaml` definisce la configurazione dell'app Deploio:

- **Size:** `micro` (512MB), `mini` (1GB), `standard-1/2/4`
- **Port:** `8080`
- **Replicas:** `1` (scalabile nel cockpit)
- **Basic Auth:** disattivato (ZITADEL OIDC)
- **Variabili env non segrete:** `APP_ENV=production`, `SERVER_PORT=8080`, `DB_SSLMODE=require`, `DB_PORT=5432`
- **Deploy-Job:** `run-migrations` esegue `migrate -path /app/migrations -database "$DB_URL" up` prima di ogni release

Le variabili segrete vengono impostate tramite `nctl update app resivote --env=KEY=VALUE` o nel cockpit:

- `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_URL`
- `ZITADEL_BASE_URL`, `ZITADEL_PROJECT_ID`, `ZITADEL_CLIENT_ID`
- `ZITADEL_TOKEN_EXCHANGE_CLIENT_ID`, `ZITADEL_PAT`, `ZITADEL_CLIENT_SECRET`
- `CHECKIN_TOKEN_SIGNING_KEY`, `AUDIT_HASH_KEY`, `CORS_ORIGINS`

Guida completa: `deployments/deploio/README.md`.

### Docker

`deployments/docker/docker-compose.yml` definisce tre servizi:

- **postgres:** PostgreSQL 18, porta `45432:5432`, script init per multi-DB (`resivote`, `zitadel`)
- **zitadel:** ZITADEL v2.71.4, porta `18180:8080`
- **api:** API ResiVote, costruisce dal Dockerfile, porta `18080:8080`, `APP_ENV=production`

### Kubernetes

Manifest in `deployments/k8s/`:

| File | Risorsa |
|---|---|
| `deployment.yaml` | Deployment con 3 repliche, security-context non-root, resource-limits |
| `service.yaml` | Service ClusterIP sulla porta 8080 |
| `configmap.yaml` | Configurazione non segreta (`SERVER_PORT`, `CORS_ORIGINS`, `DB_HOST`, `DB_SSLMODE`, `ZITADEL_BASE_URL`, `WS_PING_PERIOD`, `WS_PONG_WAIT`) |
| `secrets.yaml` | Segreti (codificati Base64) |

### ZITADEL

`deployments/zitadel/` contiene gli script ZITADEL Action per il setup di bootstrap (iniezione dei ruoli nei claim JWT, flow-bindings).

## Frontend integrato

Il frontend Angular viene integrato nel binary Go tramite `embed.FS` (`frontend/dist`). Echo distribuisce gli asset statici da `dist/browser` con fallback SPA su `index.html`. In produzione esiste un unico binary — frontend e backend vengono distribuiti insieme.

## Worker in background

I seguenti worker in background girano in produzione:

| Worker | Configurazione | Descrizione |
|---|---|---|
| Verifica audit | `AUDIT_VERIFY_INTERVAL` (5m) | Verifica periodica dell'integrità della catena di hash |
| Worker e-mail programmate | `EMAIL_PROCESS_INTERVAL` (1m) | Invia le e-mail programmate in scadenza |
| Billing-worker | `BILLING_WORKER_INTERVAL` (1h) | Crea fatture mensili per tutti i mandanti attivi |
| Demo-reset-worker | `DEMO_RESET_ENABLED` | Reset giornaliero del mandante demo alle 00:00 UTC (opzionale) |

Tutti i worker utilizzano un context cancellabile, che viene interrotto al segnale di shutdown.

## Checklist di sicurezza per la produzione

<Aside type="danger" title="Checklist di sicurezza per la produzione">
  Assicurarsi prima di ogni deployment di produzione:

  - **`APP_ENV=production`** impostato
  - **Binary costruito con `-tags production`** (bypass JWT compilato fuori)
  - **`AUDIT_HASH_KEY`** >= 32 byte, generato CSPRNG (`openssl rand -base64 32`)
  - **`CHECKIN_TOKEN_SIGNING_KEY`** >= 32 byte, generato CSPRNG
  - **`DOCUMENT_ENCRYPTION_MASTER_KEY`** chiave AES di 32 byte codificata base64
  - **`DB_SSLMODE=require`** impostato
  - **Segreti ZITADEL** impostati (`CLIENT_SECRET`, `PAT`, `TOKEN_EXCHANGE_CLIENT_ID`)
  - **Nessun caricamento di `.env`** in produzione (automaticamente disattivato)
  - **`CORS_ORIGINS`** limitato al dominio di produzione
  - **Controllo immutabilità dell'audit** all'avvio superato (trigger attivi, ruolo non-superuser)
</Aside>

<LinkCard title="Configurazione (variabili d'ambiente)" href="../reference/konfiguration/" description="Tutte le variabili d'ambiente con valori predefiniti e campi obbligatori." />
<LinkCard title="REST API" href="../reference/api/" description="Endpoint API, middleware e codici di errore." />
