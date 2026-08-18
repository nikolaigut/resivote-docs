---
title: Architettura
description: Documentazione di riferimento degli strati della Clean Architecture di ResiVote, dello stack tecnologico e del flusso delle richieste.
---

import { FileTree, Aside, Steps, LinkCard } from '@astrojs/starlight/components';

ResiVote segue una struttura Clean Architecture con quattro strati: **Domain**, **Application**, **Infrastructure** e **Interfaces**. Ogni strato dipende solo verso l'interno — lo strato Domain non conosce dipendenze esterne.

## Struttura delle directory

<FileTree>
- `internal/`
  - `domain/`
    - `entity/` — 31 definizioni di entità (modello dati, nessuna logica di business)
    - `repository/` — interfacce repository (`repositories.go`, porte per l'accesso ai dati)
    - `service/` — servizi di dominio (`state_machine`, `quorum_engine`, `live_quorum`, `vote_validator`, `cost_calculator`)
  - `application/` — implementazioni dei service e interfacce dei use-case (`services.go`, DI-Container)
  - `infrastructure/`
    - `persistence/` — repository GORM, connessione DB, DB tenant-scoped, migrazioni
    - `auth/` — validazione ZITADEL OIDC, admin-client, dev-bootstrap
    - `encryption/` — DEK per mandante, cifratura documenti (AES-GCM, HKDF-SHA256)
    - `ai/` — provider LLM (Mistral, Ollama, llama.cpp, Mock, Disabled)
    - `conversion/` — conversione documento-in-PDF con LibreOffice
    - `email/` — sender e-mail Resend e Log
    - `notification/` — sender web-push (webpush-go, VAPID)
    - `pdf/` — estrazione testo PDF
    - `storage/` — blob-storage (filesystem locale o S3/MinIO)
    - `websocket/` — hub e client WebSocket (`gorilla/websocket`)
  - `interfaces/`
    - `http/`
      - `handler/` — handler HTTP per risorsa
      - `middleware/` — Auth, Tenant, transazione DB, RBAC, security-headers, community-access, CORS, portale
      - `dto/` — DTO di request/response
      - `router.go` — router Echo con tutti i gruppi di route e catene di middleware
- `cmd/`
  - `server/main.go` — DI-wiring e avvio del server
  - `openapi-gen/main.go` — generazione dello schema OpenAPI
- `frontend/` — frontend Angular (integrato tramite `embed.go`)
- `migrations/` — 43 migrazioni SQL (golang-migrate)
</FileTree>

## Stack tecnologico

| Componente | Tecnologia | Versione |
|---|---|---|
| Linguaggio | Go | 1.26.3 |
| Framework HTTP | Echo | v4.15.4 |
| ORM | GORM (postgres + sqlite) | v1.31.2 |
| Driver PostgreSQL | pgx/v5 | v5.6.0 |
| OIDC / Auth | ZITADEL (zitadel-go) | v3.29.1 |
| WebSocket | gorilla/websocket | v1.5.3 |
| Web-Push | webpush-go | v1.4.0 |
| S3/MinIO | minio-go | v7.2.1 |
| Generazione PDF | gofpdf | v1.16.2 |
| HTML-Sanitizing | bluemonday | v1.0.27 |
| Import Excel | excelize/v2 | v2.11.0 |
| Configurazione env | godotenv | v1.5.1 |
| Rate-Limiting | golang.org/x/time | v0.15.0 |

### Frontend

Il frontend Angular si trova nella directory `frontend/` e viene integrato nel binary Go tramite `frontend/embed.go` con `//go:embed all:dist/browser`. Il frontend utilizza Angular Material e componenti Angular-Spartan. L'autenticazione avviene tramite OIDC contro ZITADEL.

## Dependency Injection

Il DI-wiring avviene centralmente in `cmd/server/main.go`. Il svolgimento:

<Steps>
1. **Caricare la configurazione** — `config.Load()` legge le variabili d'ambiente; `config.Validate()` impone le chiavi critiche per la produzione.
2. **Connettere il database** — `persistence.NewDB()` apre la connessione PostgreSQL (GORM).
3. **Bootstrap ZITADEL** — `auth.EnsureDevZITADELSetup()` crea in ambienti dev progetto, client OIDC e utenti in modo idempotente.
4. **Istanziare i servizi di dominio** — `StateMachine`, `QuorumEngine`, `LiveQuorumEngine`, `VoteValidator`, `CostCalculator`.
5. **Creare i repository** — Tutti i repository GORM vengono generati con l'istanza DB.
6. **Cablare i service dell'applicazione** — Ogni service riceve i propri repository e servizi di dominio tramite iniezione nel costruttore.
7. **Creare gli handler** — Ogni handler riceve i propri service dell'applicazione.
8. **Configurare il router** — `appHttp.NewRouter()` collega middleware, gruppi di route e handler.
</Steps>

Le interfacce dei service sono definite in `internal/application/services.go` (p. es. `TenantService`, `MeetingService`, `VoteService`, `OwnerService`). Le implementazioni concrete si trovano nello stesso package.

## Flusso delle richieste

Una tipica richiesta API attraversa la seguente catena di middleware:

<Steps>
1. **Recover** — panic-recovery (`middleware.Recover`)
2. **SecurityHeaders** — CSP, HSTS, X-Frame-Options, X-Content-Type-Options (`SecurityHeadersMiddleware`)
3. **BodyLimit** — limite del body della richiesta, predefinito 50M (`middleware.BodyLimit`)
4. **CORS** — validazione delle origin con le origin configurate (`CORSMiddleware`)
5. **Audit** — audit-logging per azioni significative (`AuditMiddleware`)
6. **Auth** — validazione JWT contro le JWKS di ZITADEL (`AuthMiddleware`)
7. **Tenant** — risoluzione del mandante da header/percorso/query, verifica dell'appartenenza (`TenantMiddleware`)
8. **DBTransaction** — transazione request-scoped con `SET LOCAL app.current_tenant_id` per RLS (`DBTransactionMiddleware`)
9. **CommunityAccess** — accesso del proprietario limitato alle proprie community/unità (`CommunityAccessMiddleware`)
10. **Handler → Service → Repository** — la richiesta viene elaborata
</Steps>

Le route super-admin (`/api/v1/tenants`, `/api/v1/admin/*`) aggirano TenantMiddleware e CommunityAccessMiddleware, ma utilizzano `RequireSuperAdmin` e `DBTransactionMiddleware`.

Il middleware feature-gate controlla i moduli opzionali:

- `MeetingEnabledMiddleware` — verifica `tenant.meeting_enabled` per tutte le route digital-meeting
- `PortalEnabledMiddleware` — verifica `tenant.portal_enabled` per tutte le route del portale clienti

## Aggiornamenti live via WebSocket

Le connessioni WebSocket vengono gestite tramite `gorilla/websocket`. La struttura `Hub` (`internal/infrastructure/websocket/hub.go`) gestisce i client connessi e trasmette i messaggi. Il `WebSocketHandler` si registra sotto `/ws/meetings/:meetingId` e utilizza l'autenticazione basata su token tramite parametro di query.

Gli aggiornamenti live riguardano:

- Quorum in diretta e presenza durante un'assemblea
- Risultati delle votazioni in tempo reale
- Cambio di slide di presentazione e stato del timer
- Modifiche al verbale

## Worker in background

Quattro worker in background girano come goroutine con context cancellabile:

| Worker | Configurazione | Funzione |
|---|---|---|
| Verifica audit | `AUDIT_VERIFY_INTERVAL` (predefinito 5m) | Verifica periodica dell'integrità della catena di hash |
| E-mail programmate | `EMAIL_PROCESS_INTERVAL` (predefinito 1m) | Invia le e-mail programmate in scadenza |
| Billing | `BILLING_WORKER_INTERVAL` (predefinito 1h) | Crea fatture mensili per mandante |
| Demo-Reset | Giornalmente alle 00:00 UTC + offset | Ruota il mandante demo e re-seeda i dati di esempio |

Inoltre il flusso di avvio verifica l'integrità della catena di audit e i trigger di imposizione dell'immutabilità. Con `FailClosed=true` e manipolazione rilevata il server rifiuta l'avvio (`os.Exit(1)`).

## Generazione OpenAPI

La directory `cmd/openapi-gen/` contiene un programma Go autonomo che genera lo schema OpenAPI dalle annotazioni degli handler e dalle strutture DTO. Il risultato è un `openapi.json` che contiene la specifica API completa.

<Aside type="note" title="Pagine correlate">
- [Riferimento API](/reference/api/) — documentazione degli endpoint
- [Sicurezza e conformità](/reference/sicherheit/) — Auth, RLS, cifratura, audit
- [Configurazione](/reference/konfiguration/) — variabili d'ambiente e config-struct
</Aside>
