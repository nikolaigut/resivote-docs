---
title: REST API
description: Riferimento della REST API di ResiVote – gruppi di route, endpoint, autenticazione, middleware e codici di errore.
---

import { Tabs, TabItem, Aside, LinkCard } from '@astrojs/starlight/components';

ResiVote mette a disposizione una REST API sotto il percorso base `/api/v1`. Il router HTTP si basa sul framework Echo ed è definito in `internal/interfaces/http/router.go`. Una specifica OpenAPI 3.0 viene generata automaticamente.

## Percorso base e specifica OpenAPI

Tutti gli endpoint API si trovano sotto `/api/v1`. La specifica OpenAPI (`openapi.json`) viene generata da `cmd/openapi-gen` dalle route Echo.

```sh
task generate-openapi   # genera openapi.json
task generate-client    # genera il client API Angular da openapi.json
```

Il client Angular viene generato nel frontend con `npm run generate:api` (il task `generate-client` copre entrambi i passaggi).

## Autenticazione

L'API utilizza token JWT Bearer tramite ZITADEL OIDC. L'`AuthMiddleware` valida ogni richiesta contro le JWKS di ZITADEL (`{BaseURL}/oauth/v2/keys`) e verifica issuer e audience.

- **Tipo di token:** ZITADEL OIDC access-token (Bearer)
- **Validazione issuer:** `iss` deve corrispondere a `ZITADEL_EXPECTED_ISSUER` (predefinito: `ZITADEL_BASE_URL`)
- **Validazione audience:** `aud` deve contenere `ZITADEL_EXPECTED_AUDIENCE` (predefinito: `ZITADEL_PROJECT_ID`)
- **Dev-Bypass:** nei build non di produzione esiste un bypass della validazione della firma, che viene compilato fuori nel build di produzione (`-tags production`)

Per ulteriori dettagli sull'autenticazione e su ZITADEL si veda [Sicurezza](../reference/sicherheit/) e [Architettura](../reference/architektur/).

## Header del mandante

Gli endpoint tenant-scoped richiedono l'header `X-Tenant-ID` (UUID) o uno slug del mandante nel percorso. La `TenantMiddleware` risolve l'appartenenza al mandante dell'utente e scrive il Tenant-ID nel contesto della richiesta.

## Middleware

I middleware vengono applicati nel seguente ordine:

| Middleware | Scopo |
|---|---|
| `Recover` | Panic-recovery |
| `SecurityHeadersMiddleware` | CSP, HSTS, X-Frame-Options |
| `BodyLimit` | Limite del body della richiesta (predefinito `50M`) |
| `CORSMiddleware` | Configurazione CORS (`CORS_ORIGINS`) |
| `AuditMiddleware` | Audit-logging |
| `AuthMiddleware` | Validazione JWT (ZITADEL OIDC) |
| `TenantMiddleware` | Risoluzione del mandante e verifica dell'appartenenza |
| `DBTransactionMiddleware` | Transazione request-scoped con `SET LOCAL app.current_tenant_id` (PostgreSQL RLS) |
| `CommunityAccessMiddleware` | Accesso del proprietario alle proprie community/unità; `tenant_admin` e `meeting_chair` sono esentati |
| `MeetingEnabledMiddleware` | Blocca gli endpoint live-meeting se `meeting_enabled=false` |
| `PortalEnabledMiddleware` | Blocca gli endpoint del portale se `portal_enabled=false` |
| `CustomErrorHandler` | Gestione centralizzata degli errori con codici `AppError` |

## Gruppi di route

### Endpoint pubblici

Gli endpoint pubblici non richiedono autenticazione.

| Metodo | Percorso | Descrizione |
|---|---|---|
| `GET` | `/health` | Health-check (`{"status":"UP"}`) |
| `GET` | `/auth/config` | Configurazione OIDC (issuer, client-ID, post-logout-URI); rate-limited (10 req/s, burst 20) |
| `GET` | `/api/v1/checkin/:token/validate` | Validazione del token di check-in (JWT); rate-limited (10 req/s, burst 20) |
| `POST` | `/api/v1/public/contact` | Formulario di contatto; rate-limited (5 req/min) |
| `GET/HEAD` | `/api/v1/attachments/:id/slides/images/:imageName` | Stream pubblico di immagini slide per tag `<img>` |
| `POST` | `/internal/demo-reset` | Demo-reset (protetto da API-Key, solo se `DEMO_RESET_ENABLED`) |

### Route Me (`/api/v1/me`)

Endpoint autenticati senza ambito mandante.

| Metodo | Percorso | Descrizione |
|---|---|---|
| `GET` | `/api/v1/me` | Utente attuale: ruoli e appartenenze ai mandanti; rate-limited (10 req/s, burst 20) |
| `POST` | `/api/v1/invitations/redeem` | Riscattare un invito |

### Route admin (`/api/v1/admin`, `/api/v1/tenants`)

Endpoint super-admin con middleware `RequireSuperAdmin` e rate-limiting (30 req/min).

| Metodo | Percorso | Descrizione |
|---|---|---|
| `GET/POST` | `/api/v1/tenants` | Elencare/creare mandanti |
| `GET/PUT/DELETE` | `/api/v1/tenants/:id` | Gestione del mandante |
| `PATCH` | `/api/v1/tenants/:id/billing` | Aggiornare le info di billing |
| `PATCH` | `/api/v1/tenants/:id/portal` | Attivare/disattivare il portale |
| `PATCH` | `/api/v1/tenants/:id/meeting` | Attivare/disattivare la funzione meeting |
| `PATCH` | `/api/v1/tenants/:id/suspend` | Sospendere il mandante |
| `PATCH` | `/api/v1/tenants/:id/activate` | Attivare il mandante |
| `GET` | `/api/v1/tenants/:id/metrics` | Metriche del mandante |
| `POST` | `/api/v1/tenants/suggest-slug` | Proposta di slug |
| `GET` | `/api/v1/tenants/check-slug` | Verificare la disponibilità dello slug |
| `GET/POST` | `/api/v1/tenants/:id/users` | Elencare/creare utenti del mandante |
| `DELETE` | `/api/v1/tenants/:id/users/:email` | Rimuovere un utente del mandante |
| `GET` | `/api/v1/admin/system/health` | Health di sistema |
| `GET` | `/api/v1/admin/system/audit-integrity` | Integrità della catena di audit |
| `GET` | `/api/v1/admin/system/config` | Configurazione in esecuzione |
| `GET/POST` | `/api/v1/admin/users` | Elencare/creare utenti ZITADEL |
| `POST` | `/api/v1/admin/users/roles` | Assegnare ruoli |
| `POST` | `/api/v1/admin/users/:userId/tenant-assignments` | Creare un'assegnazione di mandante |
| `DELETE` | `/api/v1/admin/users/:userId/tenant-assignments/:tenantId` | Rimuovere un'assegnazione di mandante |
| `POST` | `/api/v1/admin/impersonate` | Avviare l'impersonazione (Token Exchange RFC 8693) |
| `POST` | `/api/v1/admin/impersonate/stop` | Terminare l'impersonazione |
| `GET` | `/api/v1/admin/billing/tenants` | Mandanti billing SaaS |
| `GET` | `/api/v1/admin/billing/tenants/:id` | Dettagli del mandante billing SaaS |

### Endpoint tenant-scoped (`/api/v1/...`)

Questi endpoint richiedono `X-Tenant-ID`, imposizione RLS e controlli di community-access.

<Tabs>
<TabItem label="Community e unità">

| Metodo | Percorso | Ruoli |
|---|---|---|
| `POST` | `/communities` | `tenant_admin` |
| `GET` | `/communities` | `tenant_admin`, `meeting_chair`, `owner` |
| `GET/PUT/DELETE` | `/communities/:id` | si veda il router |
| `POST/DELETE` | `/communities/:id/megs/:megId` | `tenant_admin` (collegamento MEG) |
| `GET` | `/communities/:id/megs` | Collegamenti MEG |
| `GET` | `/communities/:id/stwegs` | Collegamenti STWEG |
| `GET/POST` | `/developments` | Complessi immobiliari |
| `GET` | `/developments/tree` | Albero di sviluppo |
| `POST` | `/communities/:communityId/units` | Creare un'unità |
| `POST` | `/communities/reglement-extract` | Estrarre il regolamento (50M body-limit) |
| `POST` | `/communities/reglement-confirm` | Confermare il regolamento |
| `GET` | `/communities/:communityId/units` | Elencare le unità |
| `GET/PUT/DELETE` | `/units/:id` | Gestione delle unità |

</TabItem>
<TabItem label="Ripartizione dei costi">

| Metodo | Percorso | Descrizione |
|---|---|---|
| `GET/POST` | `/communities/:communityId/cost-distribution-keys` | Chiavi di ripartizione (MEG) |
| `GET/PUT/DELETE` | `/communities/:communityId/cost-distribution-keys/:keyId` | Singola chiave |
| `GET/POST` | `/communities/:communityId/cost-statements` | Conteggi dei costi |
| `GET/DELETE` | `/communities/:communityId/cost-statements/:stmtId` | Singolo conteggio |
| `GET` | `/cost-statements/:id/pdf` | Conteggio dei costi come PDF |
| `GET` | `/cost-statements/:id/csv` | Conteggio dei costi come CSV |

</TabItem>
<TabItem label="Proprietari e quote di proprietà">

| Metodo | Percorso | Descrizione |
|---|---|---|
| `POST` | `/owners` | Creare un proprietario |
| `POST` | `/owners/import` | Import CSV (10M body-limit) |
| `GET` | `/owners` | Elencare i proprietari |
| `GET/PUT/DELETE` | `/owners/:id` | Gestione del proprietario |
| `POST` | `/owners/:id/archive` | Archiviare un proprietario |
| `GET` | `/owners/:ownerId/ownerships` | Quote di proprietà di un proprietario |
| `GET` | `/profile` | Profilo proprio |
| `POST/GET/PUT/DELETE` | `/ownerships` | Gestire le quote di proprietà |
| `GET` | `/units/:unitId/ownerships` | Quote di proprietà di un'unità |

</TabItem>
<TabItem label="Assemblee">

| Metodo | Percorso | Descrizione |
|---|---|---|
| `POST/GET` | `/meetings` | Creare/elencare assemblee |
| `GET/PUT/DELETE` | `/meetings/:id` | Gestione dell'assemblea |
| `GET` | `/meetings/:id/presence` | Panoramica della presenza |
| `GET` | `/meetings/:id/mentions` | Partecipanti menzionabili |
| `GET` | `/meetings/:id/quorum` | Quorum in diretta |
| `PATCH` | `/meetings/:id/protocol-writer` | Impostare il redattore del verbale |
| `POST` | `/meetings/:id/publish` | Pubblicare l'assemblea |
| `POST` | `/meetings/:id/open` | Aprire l'assemblea (check-in) |
| `POST` | `/meetings/:id/start` | Avviare l'assemblea |
| `POST` | `/meetings/:id/close` | Chiudere l'assemblea |
| `POST` | `/meetings/:id/archive` | Archiviare l'assemblea |
| `GET` | `/meetings/:id/email-queue-status` | Stato della coda e-mail |
| `POST/DELETE/GET` | `/meetings/:id/communities` | Collegamento multi-community |
| `GET` | `/meetings/:meetingId/eligible-grantees` | Destinatari di procura legittimati |
| `GET` | `/meetings/:meetingId/eligible-units` | Unità legittimate |

</TabItem>
<TabItem label="Punti all'ordine del giorno">

| Metodo | Percorso | Descrizione |
|---|---|---|
| `POST/GET` | `/meetings/:meetingId/agenda-items` | Creare/elencare punti all'ordine del giorno |
| `GET/PUT/DELETE` | `/agenda-items/:id` | Gestione del punto all'ordine del giorno |
| `POST` | `/agenda-items/:id/present` | Avviare la presentazione |
| `POST` | `/agenda-items/:id/open` | Aprire la votazione |
| `POST` | `/agenda-items/:id/close` | Chiudere la votazione |
| `POST` | `/agenda-items/:id/skip` | Saltare il punto all'ordine del giorno |
| `POST` | `/agenda-items/:id/start-pre-voting` | Avviare il pre-voting |
| `POST` | `/agenda-items/:id/cancel-pre-voting` | Interrompere il pre-voting |
| `PATCH` | `/agenda-items/:id/notes` | Aggiornare le note |
| `POST` | `/agenda-items/:id/ai-suggest` | Proposta di verbale IA |
| `POST` | `/agenda-items/:id/timer/start` | Avviare il timer |
| `POST` | `/agenda-items/:id/timer/stop` | Fermare il timer |
| `GET` | `/agenda-items/:id/timer` | Stato del timer |
| `GET` | `/agenda-items/:id/quorum-snapshot` | Snapshot del quorum |

</TabItem>
<TabItem label="Allegati e slide">

| Metodo | Percorso | Descrizione |
|---|---|---|
| `POST` | `/agenda-items/:id/attachments` | Caricare un allegato |
| `POST` | `/agenda-items/:id/slides` | Creare un allegato slide |
| `GET` | `/agenda-items/:id/attachments` | Elencare gli allegati |
| `DELETE` | `/attachments/:id` | Cancellare un allegato |
| `GET` | `/attachments/:id/download` | Scaricare un allegato |
| `POST/PUT/DELETE` | `/attachments/:id/slides` | Gestione delle slide |
| `POST` | `/attachments/:id/slides/current` | Impostare la slide attuale |
| `POST` | `/attachments/:id/slides/images` | Caricare un'immagine slide |
| `POST/GET/DELETE` | `/meetings/:id/attachments` | Allegati dell'assemblea |

</TabItem>
<TabItem label="Votazioni e check-in">

| Metodo | Percorso | Descrizione |
|---|---|---|
| `POST` | `/agenda-items/:agendaItemId/votes` | Esprimere un voto (`owner`) |
| `POST` | `/agenda-items/:agendaItemId/analog-votes` | Voto analogico (`tenant_admin`, `meeting_chair`) |
| `POST` | `/agenda-items/:agendaItemId/bulk-analog-votes` | Voti analogici collettivi |
| `GET` | `/agenda-items/:agendaItemId/votes` | Elencare i voti |
| `GET` | `/agenda-items/:agendaItemId/my-vote` | Voto proprio |
| `GET` | `/agenda-items/:id/result` | Risultato della votazione |
| `GET` | `/agenda-items/:id/eligible-units` | Unità analogiche legittimate |
| `POST` | `/meetings/:meetingId/check-in` | Check-in (amministratore) |
| `POST` | `/meetings/:meetingId/check-in/self` | Self-check-in (`owner`) |
| `GET` | `/meetings/:meetingId/checkin-qr` | Generare token QR (rate-limited) |
| `GET` | `/meetings/:meetingId/attendances` | Lista delle presenze |
| `GET` | `/meetings/:meetingId/my-attendance` | Presenza propria |
| `POST` | `/meetings/:meetingId/signature-checkin` | Check-in con firma (5M body-limit) |
| `GET` | `/meetings/:meetingId/signatures` | Elencare le firme |
| `GET` | `/meetings/:meetingId/owners/:ownerId/checkin-preview` | Anteprima del check-in |

</TabItem>
<TabItem label="Procure">

| Metodo | Percorso | Descrizione |
|---|---|---|
| `POST` | `/meetings/:meetingId/proxies` | Creare una procura |
| `GET` | `/meetings/:meetingId/proxies` | Elencare le procure |
| `DELETE` | `/proxies/:id` | Revocare una procura |

</TabItem>
<TabItem label="Report e pacchetto di prove">

| Metodo | Percorso | Descrizione |
|---|---|---|
| `GET` | `/meetings/:id/protocol/pdf` | Verbale come PDF |
| `GET` | `/meetings/:id/invitation/pdf` | Invito come PDF |
| `GET` | `/meetings/:id/proxy-card/pdf` | Carta di procura come PDF |
| `GET` | `/meetings/:id/evidence-package/verify` | Verificare l'integrità del pacchetto di prove |
| `GET` | `/meetings/:id/evidence-package/pdf` | Pacchetto di prove come PDF |
| `GET` | `/meetings/:id/evidence-package/json` | Pacchetto di prove come JSON |

</TabItem>
<TabItem label="Audit-Log">

| Metodo | Percorso | Descrizione |
|---|---|---|
| `GET` | `/audit-logs` | Elencare gli audit-log (rate-limited) |
| `GET` | `/audit-logs/verify` | Verificare l'integrità della catena |
| `GET` | `/audit-logs/export/pdf` | Audit-log come PDF |
| `GET` | `/audit-logs/export/json` | Audit-log come JSON |

</TabItem>
<TabItem label="Messaggi (broadcast)">

| Metodo | Percorso | Descrizione |
|---|---|---|
| `POST/GET` | `/messages` | Creare/elencare messaggi |
| `GET` | `/messages/recipient-count` | Anteprima dei destinatari |
| `GET/PATCH/DELETE` | `/messages/:id` | Gestione del messaggio |
| `POST` | `/messages/:id/send` | Inviare il messaggio |

</TabItem>
<TabItem label="Billing">

| Metodo | Percorso | Descrizione |
|---|---|---|
| `POST` | `/billing/run` | Creare una fattura (`super_admin`) |
| `GET` | `/billing/invoices` | Elencare le fatture |
| `GET` | `/billing/invoices/:id` | Singola fattura |
| `GET` | `/billing/invoices/:id/pdf` | Fattura come PDF |

</TabItem>
<TabItem label="Ricerca">

| Metodo | Percorso | Descrizione |
|---|---|---|
| `GET` | `/search` | Ricerca globale (con o senza contesto mandante) |

</TabItem>
</Tabs>

### Route alias meeting (`/api/v1/t/:tenantId/m/:meetingSlug`)

Link condivisibili con slug del mandante e slug del meeting. La `TenantMiddleware` risolve lo slug dal parametro di percorso `:tenantId`.

| Metodo | Percorso | Ruoli |
|---|---|---|
| `GET` | `/api/v1/t/:tenantId/m/:meetingSlug` | `tenant_admin`, `meeting_chair`, `owner` |

Questo gruppo utilizza inoltre `MeetingEnabledMiddleware`.

### Endpoint del portale (`/api/v1/portal/...`)

Gli endpoint del portale clienti richiedono `portal_enabled=true` e un rate-limit di scrittura del portale (1 request / 6 s, burst 20).

<Tabs>
<TabItem label="Cartelle e documenti">

| Metodo | Percorso | Descrizione |
|---|---|---|
| `GET` | `/portal/communities/:community_id/folders` | Albero delle cartelle |
| `POST/GET/PUT/DELETE` | `/portal/folders` | Gestione delle cartelle |
| `GET/POST` | `/portal/documents` | Elencare/caricare documenti |
| `GET/PUT/DELETE` | `/portal/documents/:id` | Gestione del documento |
| `GET` | `/portal/documents/:id/download` | Scaricare un documento |

</TabItem>
<TabItem label="Forum e ticket">

| Metodo | Percorso | Descrizione |
|---|---|---|
| `GET/POST` | `/portal/forum/posts` | Argomenti del forum |
| `GET` | `/portal/forum/posts/:id` | Singolo argomento |
| `POST` | `/portal/forum/posts/:id/replies` | Creare una risposta |
| `DELETE` | `/portal/forum/posts/:id` | Cancellare un post |
| `GET/POST` | `/portal/tickets` | Elencare/creare ticket |
| `GET` | `/portal/tickets/:id` | Singolo ticket |
| `POST` | `/portal/tickets/:id/messages` | Messaggio del ticket |
| `PATCH` | `/portal/tickets/:id/status` | Stato del ticket |
| `DELETE` | `/portal/tickets/:id` | Cancellare il ticket |
| `GET` | `/portal/tickets/:id/attachments/:attachmentId` | Allegato del ticket |

</TabItem>
<TabItem label="Notifiche e messaggi">

| Metodo | Percorso | Descrizione |
|---|---|---|
| `GET` | `/portal/notifications` | Elencare le notifiche |
| `POST` | `/portal/notifications/:id/read` | Marcare come letta |
| `POST` | `/portal/notifications/read-all` | Tutte lette |
| `GET` | `/portal/notifications/unread-count` | Numero di non lette |
| `GET/PATCH` | `/portal/notifications/settings` | Impostazioni di notifica |
| `GET` | `/portal/notifications/vapid-public-key` | VAPID Public Key |
| `POST/DELETE` | `/portal/notifications/push/subscribe` | Abbonamento push |
| `GET` | `/portal/messages` | Posta in arrivo |
| `POST` | `/portal/messages/:id/read` | Messaggio letto |
| `POST` | `/portal/messages/:id/archive` | Archiviare il messaggio |

</TabItem>
</Tabs>

### WebSocket (`/ws/meetings/:meetingId`)

Endpoint WebSocket per aggiornamenti in diretta. L'autenticazione e i controlli di tenant/community-access vengono applicati durante l'handshake di upgrade.

| Metodo | Percorso | Descrizione |
|---|---|---|
| `GET` | `/ws/meetings/:meetingId` | Upgrade WebSocket |

<Aside type="note" title="Configurazione WebSocket">
  Ciclo ping/pong: `WS_PONG_WAIT` (60s), `WS_PING_PERIOD` (54s), `WS_WRITE_WAIT` (10s). Dimensioni dei buffer: `WS_READ_BUFFER_SIZE` (1024), `WS_WRITE_BUFFER_SIZE` (1024). Dimensione massima del messaggio: `WS_MAX_MESSAGE_SIZE` (4096). In produzione le origin del browser vengono verificate contro `CORS_ORIGINS`; in sviluppo tutte le origin sono permesse.
</Aside>

I messaggi WebSocket trasmettono lo stato dell'assemblea in diretta, l'avanzamento delle votazioni e gli aggiornamenti del quorum.

### File statici

Gli asset del frontend Angular vengono integrati via `embed.FS` e distribuiti tramite Echo Static Files (`dist/browser`). I percorsi non trovati ricadono su `index.html` (routing SPA, HTML5 History API).

## Gestione degli errori

Il `CustomErrorHandler` trasforma le istanze `AppError` in risposte JSON strutturate. Ogni errore contiene un `code` leggibile dalla macchina e un `message`.

| Codice | Stato HTTP | Descrizione |
|---|---|---|
| `NOT_FOUND` | 404 | Risorsa non trovata |
| `CONFLICT` | 409 | Conflitto (p. es. transizione di stato) |
| `VALIDATION_ERROR` | 400 / 422 | Errore di validazione |
| `UNAUTHORIZED` | 401 | Non autenticato |
| `FORBIDDEN` | 403 | Nessuna autorizzazione |
| `TENANT_MISMATCH` | 403 | Accesso tra mandanti |
| `INVALID_STATE_TRANSITION` | 409 | Transizione di stato non valida |
| `QUORUM_NOT_MET` | 409 | Assemblea non capace di deliberare |
| `VOTE_NOT_ALLOWED` | 403 | Votazione non consentita |
| `PROXY_INSTRUCTION_VIOLATION` | 409 | Istruzione di procura violata |
| `ALREADY_VOTED` | 409 | Già votato |
| `NOT_CHECKED_IN` | 403 | Non registrato |
| `MEETING_NOT_OPEN` | 403 | Assemblea non aperta |
| `AGENDA_ITEM_NOT_OPEN` | 403 | Punto all'ordine del giorno non aperto |
| `USER_NOT_LINKED` | 403 | Utente non collegato |
| `INTERNAL_ERROR` | 500 / 503 | Errore interno |

<LinkCard title="Architettura" href="../reference/architektur/" description="Panoramica degli strati e dei componenti." />
<LinkCard title="Sicurezza" href="../reference/sicherheit/" description="Autenticazione, RLS, audit-log e cifratura." />
