---
title: Déploiement et développement
description: Développement local, build, tests, migrations et options de déploiement en production pour ResiVote.
---

import { Steps, Aside, CardGrid, Card, LinkCard, Tabs, TabItem } from '@astrojs/starlight/components';

## Développement local

### Prérequis

- Go 1.26+
- Node.js 22+ (frontend Angular)
- Docker & Docker Compose
- `task` (Taskfile runner)
- `golang-migrate` CLI (installé automatiquement via `task migrate-install`)

### Démarrer la stack de dev

<Steps>
1. **Démarrer l'infrastructure**

   Démarre Postgres et ZITADEL via `docker-compose.dev.yml` :

   ```sh
   task docker-dev-up
   ```

   Attend que ZITADEL soit sain, extrait le PAT de bootstrap et écrit la configuration de dev dans `.env` :

   ```sh
   task zitadel-pat
   ```

   Ou les deux en une seule étape (incl. les migrations) :

   ```sh
   task start-dev
   ```

2. **Exécuter les migrations de base de données**

   ```sh
   task migrate-up
   ```

   Utilise `golang-migrate` v4.19.1 avec l'URL DB de `.env` (par défaut : `postgres://resivote:resivote@localhost:45432/resivote?sslmode=disable`).

3. **Démarrer le backend**

   ```sh
   task run-dev
   ```

   Démarre le serveur Go avec `APP_ENV=development go run ./cmd/server`.

4. **Démarrer le frontend**

   ```sh
   cd frontend && npm start
   ```

   Serveur de dev Angular sur `http://localhost:4200`.
</Steps>

### Ports de dev

| Service | URL / Port |
|---|---|
| Postgres | `localhost:45432` (utilisateur/DB : `resivote`/`resivote`) |
| ZITADEL | `http://localhost:18180` |
| Backend | `http://localhost:18080` |
| Frontend | `http://localhost:4200` |

### Configuration de dev

`task zitadel-pat` écrit les valeurs suivantes dans `.env` :

- `APP_ENV=development`
- `DB_HOST=localhost`, `DB_PORT=45432`, `DB_SSLMODE=disable`
- `ZITADEL_BASE_URL=http://localhost:18180`
- `ZITADEL_PAT=<bootstrap-pat>`
- `ZITADEL_ISSUER_OVERRIDE=http://localhost:4200` (proxy frontend pour OIDC)
- `SERVER_PORT=18080`
- `CORS_ORIGINS=http://localhost:4200`

## Build

| Tâche | Description |
|---|---|
| `task build` | Build le frontend (`npm run build`), puis le binaire Go vers `bin/resivote` |
| `task build-frontend` | Build uniquement les assets frontend |
| `task run` | Build et démarre le binaire |
| `task docker-build` | Build l'image Docker de production (`deployments/docker/Dockerfile`) |

### Dockerfile

Le Dockerfile multi-stage (`deployments/docker/Dockerfile`) exécute les étapes suivantes :

1. **Stage frontend :** Node 22, `npm install`, `npm run build` → Angular `dist/`
2. **Stage builder :** Go 1.26, copie les assets frontend dans le contexte de build Go, build avec `-tags production` (compile le contournement JWT hors), installe la CLI `golang-migrate`
3. **Stage runtime :** Alpine 3.19 avec `ca-certificates`, `tzdata`, `libreoffice`, `poppler-utils` ; utilisateur non-root `appuser` ; binaire, migrations et CLI `migrate` copiés

## Tests

| Tâche | Description |
|---|---|
| `task test` | Tous les tests avec `-race -count=1` |
| `task test-unit` | Tests unitaires (`internal/domain/...`, `-short`) |
| `task test-integration` | Tests d'intégration (`internal/infrastructure/...`, `-tags=integration`) |
| `task test-e2e` | Tests de bout en bout (`test/e2e/...`, `-tags=e2e`) |
| `task test-cover` | Tests avec rapport de couverture (`coverage.html`) |
| `task lint` | `golangci-lint run ./...` |
| `task vet` | `go vet ./...` |

## Migrations

ResiVote utilise `golang-migrate` v4.19.1. Les migrations se trouvent dans le répertoire `migrations/` (43 versions, numérotées séquentiellement).

| Tâche | Description |
|---|---|
| `task migrate-up` | Appliquer toutes les migrations en attente |
| `task migrate-down` | Annuler la dernière migration |
| `task migrate-create` | Créer une nouvelle migration (`name=<name>`) |
| `task migrate-force` | Forcer la migration vers une version spécifique |
| `task migrate-install` | Installer la CLI `golang-migrate` (si manquante) |

<Aside type="note" title="Politiques RLS">
  La migration `000004` ajoute des clauses `WITH CHECK` à toutes les politiques RLS. L'application de RLS définit `SET LOCAL app.current_tenant_id` par requête via `DBTransactionMiddleware`.
</Aside>

## OpenAPI et génération de client

```sh
task generate-openapi   # génère openapi.json à partir des routes Echo (cmd/openapi-gen)
task generate-client    # génère le client API Angular (npm run generate:api)
```

## Déploiement en production

<CardGrid>
<Card title="Deploio (Nine.ch)" href="#deploio">
  PaaS suisse, ISO 27001, Zurich. Configuration via `.deploio.yaml`.
</Card>
<Card title="Docker Compose" href="#docker">
  `deployments/docker/docker-compose.yml` avec Postgres, ZITADEL et API.
</Card>
<Card title="Kubernetes" href="#kubernetes">
  Manifestes dans `deployments/k8s/` (Deployment, Service, ConfigMap, Secrets).
</Card>
<Card title="ZITADEL" href="#zitadel">
  Déploiement ZITADEL via `deployments/zitadel/`.
</Card>
</CardGrid>

### Deploio

`.deploio.yaml` définit la configuration de l'application Deploio :

- **Size :** `micro` (512MB), `mini` (1GB), `standard-1/2/4`
- **Port :** `8080`
- **Replicas :** `1` (scalable dans le cockpit)
- **Basic Auth :** désactivé (ZITADEL OIDC)
- **Variables d'env non secrètes :** `APP_ENV=production`, `SERVER_PORT=8080`, `DB_SSLMODE=require`, `DB_PORT=5432`
- **Deploy-Job :** `run-migrations` exécute `migrate -path /app/migrations -database "$DB_URL" up` avant chaque release

Les variables secrètes sont définies via `nctl update app resivote --env=KEY=VALUE` ou le cockpit :

- `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_URL`
- `ZITADEL_BASE_URL`, `ZITADEL_PROJECT_ID`, `ZITADEL_CLIENT_ID`
- `ZITADEL_TOKEN_EXCHANGE_CLIENT_ID`, `ZITADEL_PAT`, `ZITADEL_CLIENT_SECRET`
- `CHECKIN_TOKEN_SIGNING_KEY`, `AUDIT_HASH_KEY`, `CORS_ORIGINS`

Guide complet : `deployments/deploio/README.md`.

### Docker

`deployments/docker/docker-compose.yml` définit trois services :

- **postgres :** PostgreSQL 18, port `45432:5432`, script d'init pour multi-DB (`resivote`, `zitadel`)
- **zitadel :** ZITADEL v2.71.4, port `18180:8080`
- **api :** API ResiVote, build depuis le Dockerfile, port `18080:8080`, `APP_ENV=production`

### Kubernetes

Manifestes dans `deployments/k8s/` :

| Fichier | Ressource |
|---|---|
| `deployment.yaml` | Deployment avec 3 replicas, security context non-root, resource limits |
| `service.yaml` | Service ClusterIP sur le port 8080 |
| `configmap.yaml` | Configuration non secrète (`SERVER_PORT`, `CORS_ORIGINS`, `DB_HOST`, `DB_SSLMODE`, `ZITADEL_BASE_URL`, `WS_PING_PERIOD`, `WS_PONG_WAIT`) |
| `secrets.yaml` | Secrets (codés en Base64) |

### ZITADEL

`deployments/zitadel/` contient les scripts d'action ZITADEL pour le bootstrap (injection de rôles dans les claims JWT, flow bindings).

## Frontend intégré

Le frontend Angular est intégré dans le binaire Go via `embed.FS` (`frontend/dist`). Echo sert les assets statiques depuis `dist/browser` avec un repli SPA sur `index.html`. En production, il n'existe qu'un seul binaire — frontend et backend sont livrés ensemble.

## Workers d'arrière-plan

Les workers d'arrière-plan suivants s'exécutent en production :

| Worker | Configuration | Description |
|---|---|---|
| Vérification d'audit | `AUDIT_VERIFY_INTERVAL` (5m) | Vérification périodique de l'intégrité de la chaîne de hachage |
| Worker d'e-mails planifiés | `EMAIL_PROCESS_INTERVAL` (1m) | Envoie les e-mails planifiés échus |
| Worker de facturation | `BILLING_WORKER_INTERVAL` (1h) | Crée les factures mensuelles pour tous les mandants actifs |
| Worker de demo-reset | `DEMO_RESET_ENABLED` | Reset quotidien du mandant démo à 00:00 UTC (optionnel) |

Tous les workers utilisent un contexte annulable, qui est interrompu lors du signal d'arrêt.

## Checklist de sécurité en production

<Aside type="danger" title="Checklist de sécurité en production">
  Avant chaque déploiement en production, s'assurer que :

  - **`APP_ENV=production`** est défini
  - **Binaire compilé avec `-tags production`** (contournement JWT compilé hors)
  - **`AUDIT_HASH_KEY`** >= 32 octets, généré par CSPRNG (`openssl rand -base64 32`)
  - **`CHECKIN_TOKEN_SIGNING_KEY`** >= 32 octets, généré par CSPRNG
  - **`DOCUMENT_ENCRYPTION_MASTER_KEY`** clé AES de 32 octets codée en base64
  - **`DB_SSLMODE=require`** est défini
  - **Secrets ZITADEL** définis (`CLIENT_SECRET`, `PAT`, `TOKEN_EXCHANGE_CLIENT_ID`)
  - **Pas de chargement `.env`** en production (automatiquement désactivé)
  - **`CORS_ORIGINS`** restreint au domaine de production
  - **Vérification d'immutabilité d'audit** au démarrage réussie (triggers actifs, rôle non-superuser)
</Aside>

<LinkCard title="Configuration (variables d'environnement)" href="../reference/konfiguration/" description="Toutes les variables d'environnement avec valeurs par défaut et champs obligatoires." />
<LinkCard title="REST API" href="../reference/api/" description="Endpoints API, middlewares et codes d'erreur." />
