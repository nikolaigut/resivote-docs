---
title: Configurazione (variabili d'ambiente)
description: Tutte le variabili d'ambiente di ResiVote per area di configurazione – valori predefiniti, campi obbligatori e requisiti di produzione.
---

import { Aside, Tabs, TabItem } from '@astrojs/starlight/components';

ResiVote legge l'intera configurazione da variabili d'ambiente (12-Factor App). La struttura è definita in `internal/config/config.go`.

<Aside type="warning" title="APP_ENV è obbligatorio">
  `APP_ENV` deve essere impostato esplicitamente come variabile d'ambiente. Senza `APP_ENV` il server rifiuta l'avvio (`ErrAppEnvNotSet`). In produzione `.env` **non viene mai** caricato — tutti i valori devono provenire dall'ambiente del processo o del container.
</Aside>

<Aside type="note" title=".env in non-produzione">
  In `development`, `dev`, `test` e `staging` ResiVote carica automaticamente un file `.env` locale. Le variabili d'ambiente esplicite hanno la precedenza. In produzione (`production` / `prod`) il caricamento di `.env` è disattivato.
</Aside>

## App e server

| Variabile | Descrizione | Predefinito | Obbligatorio in prod |
|---|---|---|---|
| `APP_ENV` | Ambiente (`production`, `development`, `dev`, `test`, `staging`) | — | **Sì** (senza predefinito, il server rifiuta l'avvio) |
| `SERVER_PORT` | Porta di ascolto HTTP | `18080`, fallback su `PORT` poi `8080` | No |
| `SERVER_READ_TIMEOUT` | Timeout di lettura | `15s` | No |
| `SERVER_WRITE_TIMEOUT` | Timeout di scrittura | `15s` | No |
| `SERVER_SHUTDOWN_TIMEOUT` | Timeout di graceful-shutdown | `10s` | No |
| `SERVER_BODY_LIMIT` | Body massimo della richiesta (sintassi Echo, p. es. `50M`) | `50M` | No |
| `CORS_ORIGINS` | Origin CORS permesse (separate da virgola) | Prod: `app.resivote.ch`, `resivote.ch`, `www.resivote.ch`; Dev: inoltre `localhost:4200/8081/4321` | No |

## Database (PostgreSQL)

| Variabile | Descrizione | Predefinito | Obbligatorio in prod |
|---|---|---|---|
| `DB_HOST` | Host PostgreSQL | `localhost` | Sì |
| `DB_PORT` | Porta PostgreSQL | `5432` | No |
| `DB_USER` | Utente del database | `resivote` | Sì |
| `DB_PASSWORD` | Password del database | `resivote` | Sì |
| `DB_NAME` | Nome del database | `resivote` | Sì |
| `DB_SSLMODE` | Modalità SSL | `require` | Sì (`require` in prod) |
| `DB_MAX_OPEN_CONNS` | Connessioni aperte max. | `15` | No |
| `DB_MAX_IDLE_CONNS` | Connessioni idle max. | `5` | No |
| `DB_CONN_MAX_LIFETIME` | Età massima delle connessioni | `5m` | No |

## Auth (ZITADEL)

| Variabile | Descrizione | Predefinito | Obbligatorio in prod |
|---|---|---|---|
| `ZITADEL_BASE_URL` | URL dell'istanza ZITADEL | `http://localhost:18180` | Sì |
| `ZITADEL_PROJECT_ID` | ID del progetto ZITADEL | `resivote` | Sì |
| `ZITADEL_CLIENT_ID` | Client-ID OIDC (frontend) | `resivote-api` | Sì |
| `ZITADEL_CLIENT_SECRET` | Client-Secret OIDC (Token Exchange) | — | Sì (per l'impersonazione) |
| `ZITADEL_TOKEN_EXCHANGE_CLIENT_ID` | Client-ID per Token Exchange | Fallback su `ZITADEL_CLIENT_ID` | Sì (per l'impersonazione) |
| `ZITADEL_KEY_PATH` | Percorso al JSON della chiave macchina (gRPC) | — | No |
| `ZITADEL_PAT` | Personal Access Token (bootstrap, dev) | — | No (bootstrap dev) |
| `ZITADEL_ADMIN_USER` | Utente admin ZITADEL (dev) | `admin` | No |
| `ZITADEL_ADMIN_PASSWORD` | Password admin ZITADEL (dev) | `admin` | No |
| `ZITADEL_POST_LOGOUT_REDIRECT_URI` | URI di redirect post-logout | — | No |
| `ZITADEL_EXPECTED_ISSUER` | Issuer JWT atteso | `ZITADEL_BASE_URL` | No |
| `ZITADEL_EXPECTED_AUDIENCE` | Audience JWT attesa | `ZITADEL_PROJECT_ID` | No |

## WebSocket

| Variabile | Descrizione | Predefinito | Obbligatorio in prod |
|---|---|---|---|
| `WS_READ_BUFFER_SIZE` | Dimensione read-buffer (byte) | `1024` | No |
| `WS_WRITE_BUFFER_SIZE` | Dimensione write-buffer (byte) | `1024` | No |
| `WS_PONG_WAIT` | Tempo di attesa pong | `60s` | No |
| `WS_PING_PERIOD` | Intervallo ping (deve essere < `WS_PONG_WAIT`) | `54s` | No |
| `WS_WRITE_WAIT` | Write-deadline | `10s` | No |
| `WS_MAX_MESSAGE_SIZE` | Dimensione massima del messaggio (byte) | `4096` | No |

## Audit-Log

<Aside type="warning" title="AUDIT_HASH_KEY obbligatorio in produzione">
  `AUDIT_HASH_KEY` deve essere impostato in produzione e avere almeno 32 byte (256 bit). Senza una chiave HMAC forte la catena di hash di audit degrada a SHA-256 semplice e non può dimostrare la manipolazione del database (violazione ZertES/nDSG). Generare con `openssl rand -base64 32`.
</Aside>

| Variabile | Descrizione | Predefinito | Obbligatorio in prod |
|---|---|---|---|
| `AUDIT_FAIL_CLOSED` | Uscita del server al rilevamento di manipolazione | `true` | No |
| `AUDIT_FAIL_CLOSED_THRESHOLD` | Rilevamenti consecutivi prima dell'uscita | `3` | No |
| `AUDIT_VERIFY_INTERVAL` | Intervallo per la verifica periodica della catena | `5m` | No |
| `AUDIT_HASH_KEY` | Chiave HMAC-SHA-256 per la catena di hash (>= 32 byte) | — | **Sì** (>= 32 byte, CSPRNG) |
| `AUDIT_MAX_LIMIT` | Voci max. per richiesta di lista | `1000` | No |

## Check-in

<Aside type="warning" title="CHECKIN_TOKEN_SIGNING_KEY obbligatorio in produzione">
  `CHECKIN_TOKEN_SIGNING_KEY` deve essere impostato in produzione e avere almeno 32 byte. Senza una chiave HMAC forte chiunque può falsificare token di check-in QR validi.
</Aside>

| Variabile | Descrizione | Predefinito | Obbligatorio in prod |
|---|---|---|---|
| `CHECKIN_TOKEN_SIGNING_KEY` | Chiave HMAC per token di check-in QR (>= 32 byte) | — | **Sì** (>= 32 byte, CSPRNG) |
| `CHECKIN_TOKEN_EXPIRY` | Durata di validità di un token di check-in | `30m` | No |

## E-Mail

| Variabile | Descrizione | Predefinito | Obbligatorio in prod |
|---|---|---|---|
| `RESEND_API_KEY` | API-Key Resend | — | Sì (invio in prod) |
| `MAIL_FROM` | Indirizzo mittente | `noreply@resivote.ch` | No |
| `MAIL_DEV_REDIRECT_TO` | Destinazione di redirect in non-prod | `nikolai.gut@outlook.com` | No |
| `CONTACT_RECIPIENT` | Destinatario per il formulario di contatto | `kontakt@resivote.ch` | No |
| `EMAIL_LOG_ONLY` | Solo loggare, non inviare | `true` in non-prod, `false` in prod | No |
| `EMAIL_PROCESS_INTERVAL` | Intervallo per il worker delle e-mail programmate | `1m` | No |

<Aside type="note" title="Log-Only in non-produzione">
  In tutti gli ambienti non di produzione le e-mail vengono sempre loggate e mai inviate — indipendentemente da `EMAIL_LOG_ONLY` o `RESEND_API_KEY`. In produzione la modalità log-only può essere attivata con `EMAIL_LOG_ONLY=true`.
</Aside>

## Storage

| Variabile | Descrizione | Predefinito | Obbligatorio in prod |
|---|---|---|---|
| `STORAGE_TYPE` | Tipo di storage (`local` o `s3`) | `local` | No |
| `STORAGE_LOCAL_PATH` | Percorso locale per il filesystem-storage | `./uploads` | No |
| `STORAGE_S3_ENDPOINT` | Endpoint compatibile S3 | — | Sì (con `s3`) |
| `STORAGE_S3_BUCKET` | Bucket S3 | — | Sì (con `s3`) |
| `STORAGE_S3_REGION` | Regione S3 | — | Sì (con `s3`) |
| `STORAGE_S3_ACCESS_KEY` | Access-Key S3 | — | Sì (con `s3`) |
| `STORAGE_S3_SECRET_KEY` | Secret-Key S3 | — | Sì (con `s3`) |
| `STORAGE_S3_USE_PATH_STYLE` | URL path-style (MinIO) | `false` | No |
| `STORAGE_MAX_UPLOAD_SIZE` | Dimensione max. upload | `50M` | No |
| `DOCUMENT_ENCRYPTION_MASTER_KEY` | Chiave master AES di 32 byte codificata base64 per il wrapping dei DEK | — | Sì (per la cifratura dei documenti) |

<Aside type="warning" title="Cifratura dei documenti">
  `DOCUMENT_ENCRYPTION_MASTER_KEY` è una chiave AES di 32 byte codificata base64 che avvolge le chiavi di cifratura dei dati (DEK) specifiche per mandante. Se la chiave manca, la cifratura dei documenti non si avvia.
</Aside>

## Notifiche (Web Push)

| Variabile | Descrizione | Predefinito | Obbligatorio in prod |
|---|---|---|---|
| `VAPID_PUBLIC_KEY` | VAPID Public Key (frontend) | — | Sì (per push) |
| `VAPID_PRIVATE_KEY` | VAPID Private Key (server) | — | Sì (per push) |
| `VAPID_SUBJECT` | URI di contatto per il push-service | `mailto:admin@resivote.ch` | No |
| `PUSH_ICON_URL` | Icona per le notifiche push | — | No |

## IA (assistenza al verbale)

| Variabile | Descrizione | Predefinito | Obbligatorio in prod |
|---|---|---|---|
| `AI_PROVIDER` | Provider (`disabled`, `mock`, `llama`, `mistral`, `ollama`) | `disabled` in prod, `mock` in non-prod | No |
| `AI_LLAMA_ENDPOINT` | Endpoint llama.cpp | `http://localhost:8080/v1/chat/completions` | No |
| `AI_LLAMA_MODEL` | Modello llama.cpp | `Qwen/Qwen2.5-7B-Instruct-GGUF:Q4_K_M` | No |
| `AI_LLAMA_API_KEY` | API-Key llama.cpp | `local-dummy` | No |
| `AI_MISTRAL_API_KEY` | API-Key Mistral | — | Sì (con `mistral`) |
| `AI_MISTRAL_ENDPOINT` | Endpoint Mistral | `https://api.eu.mistral.ai/v1/chat/completions` | No |
| `AI_MISTRAL_MODEL` | Modello Mistral | `mistral-small-latest` | No |
| `AI_OLLAMA_ENDPOINT` | Endpoint Ollama | `http://localhost:11434/api/chat` | No |
| `AI_OLLAMA_MODEL` | Modello Ollama | `llama3.1` | No |
| `AI_MAX_TOKENS` | Token generati max. | `1024` | No |
| `AI_TEMPERATURE` | Creatività (0.0–1.0) | `0.3` | No |
| `AI_LOG_ONLY` | Risposta mock invece di chiamata LLM | `false` | No |

## Converter (LibreOffice)

| Variabile | Descrizione | Predefinito | Obbligatorio in prod |
|---|---|---|---|
| `CONVERTER_ENABLED` | Attivare la conversione PDF | `false` | No |
| `CONVERTER_COMMAND` | Binary del converter (`soffice`, `libreoffice`) | `soffice` | No |

## Billing

| Variabile | Descrizione | Predefinito | Obbligatorio in prod |
|---|---|---|---|
| `BILLING_WORKER_INTERVAL` | Intervallo per il billing-worker | `1h` | No |
| `BILLING_DUE_DAYS` | Giorni di scadenza dopo la fine del periodo | `30` | No |
| `BILLING_DEFAULT_SENDER_NAME` | Nome mittente fattura predefinito | `Nikolai Gut` | No |
| `BILLING_DEFAULT_SENDER_STREET` | Via mittente predefinita | `Münigenfeld 6A` | No |
| `BILLING_DEFAULT_SENDER_CITY` | Città mittente predefinita | `6208 Oberkirch` | No |
| `BILLING_DEFAULT_SENDER_VAT_NUMBER` | Numero IVA mittente predefinito | — | No |
| `BILLING_DEFAULT_SENDER_QR_IBAN` | QR-IBAN mittente predefinito | — | No |

## Demo-Reset

| Variabile | Descrizione | Predefinito | Obbligatorio in prod |
|---|---|---|---|
| `DEMO_RESET_ENABLED` | Attivare il worker demo-reset | `false` | No |
| `DEMO_RESET_API_KEY` | API-Key per `/internal/demo-reset` | — | Sì (se attivato in prod) |
| `DEMO_RESET_RESET_OFFSET` | Offset temporale relativo alle 00:00 UTC | `0` | No |
| `DEMO_ZITADEL_ADMIN_ID` | ID utente ZITADEL per l'admin demo | — | Sì (se attivato in prod) |
| `DEMO_ZITADEL_OWNER1_ID` | ID utente ZITADEL per l'owner demo 1 | — | Sì (se attivato in prod) |
| `DEMO_ZITADEL_OWNER2_ID` | ID utente ZITADEL per l'owner demo 2 | — | Sì (se attivato in prod) |
| `DEMO_ZITADEL_ADMIN_EMAIL` | E-mail di login admin demo | `demo.admin@resivote.ch` | No |
| `DEMO_ZITADEL_OWNER1_EMAIL` | E-mail di login owner demo 1 | `demo.owner1@resivote.ch` | No |
| `DEMO_ZITADEL_OWNER2_EMAIL` | E-mail di login owner demo 2 | `demo.owner2@resivote.ch` | No |
| `DEMO_RESET_SLUG` | Slug del mandante demo (deve essere `demo`) | `demo` | No |
| `DEMO_RESET_HARD_DELETE` | Hard-delete invece di archiviare | `false` | No |

## Cache del mandante

| Variabile | Descrizione | Predefinito | Obbligatorio in prod |
|---|---|---|---|
| `TENANT_CACHE_ENABLED` | Cache in-process dell'appartenenza al mandante | `true` | No |
| `TENANT_CACHE_TTL` | TTL della cache per le voci di appartenenza | `5m` | No |

## Variabili obbligatorie in produzione

<Aside type="danger" title="Variabili obbligatorie in produzione">
  Le seguenti variabili devono essere impostate in produzione, altrimenti il server rifiuta l'avvio (`Config.Validate`):

  - **`APP_ENV`** — deve essere `production` o `prod`
  - **`AUDIT_HASH_KEY`** — >= 32 byte, generato CSPRNG (HMAC-SHA-256 per l'integrità dell'audit)
  - **`CHECKIN_TOKEN_SIGNING_KEY`** — >= 32 byte, generato CSPRNG (HMAC-SHA-256 per i token QR)
  - **`DOCUMENT_ENCRYPTION_MASTER_KEY`** — chiave AES di 32 byte codificata base64 (cifratura dei documenti)
  - **`DB_SSLMODE`** — deve essere `require`
  - **`ZITADEL_*`** — Base-URL, Project-ID, Client-ID, Client-Secret, PAT

  Inoltre il binary deve essere costruito con `-tags production`, affinché il bypass della validazione della firma JWT non esista nel binary.
</Aside>
