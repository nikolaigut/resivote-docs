---
title: Configuration (Environment Variables)
description: All ResiVote environment variables by configuration area – defaults, required fields, and production requirements.
---

import { Aside, Tabs, TabItem } from '@astrojs/starlight/components';

ResiVote reads all configuration from environment variables (12-Factor App). The structure is defined in `internal/config/config.go`.

<Aside type="warning" title="APP_ENV is mandatory">
  `APP_ENV` must be explicitly set as an environment variable. Without `APP_ENV`, the server refuses to start (`ErrAppEnvNotSet`). In production, `.env` is **never** loaded — all values must come from the process or container environment.
</Aside>

<Aside type="note" title=".env in Non-Production">
  In `development`, `dev`, `test`, and `staging`, ResiVote automatically loads a local `.env` file. Explicit environment variables take precedence. In production (`production` / `prod`), `.env` loading is disabled.
</Aside>

## App & Server

| Variable | Description | Default | Required in Prod |
|---|---|---|---|
| `APP_ENV` | Environment (`production`, `development`, `dev`, `test`, `staging`) | — | **Yes** (no default, server refuses to start) |
| `SERVER_PORT` | HTTP listen port | `18080`, fallback to `PORT` then `8080` | No |
| `SERVER_READ_TIMEOUT` | Read timeout | `15s` | No |
| `SERVER_WRITE_TIMEOUT` | Write timeout | `15s` | No |
| `SERVER_SHUTDOWN_TIMEOUT` | Graceful shutdown timeout | `10s` | No |
| `SERVER_BODY_LIMIT` | Max request body (Echo syntax, e.g. `50M`) | `50M` | No |
| `CORS_ORIGINS` | Allowed CORS origins (comma-separated) | Prod: `app.resivote.ch`, `resivote.ch`, `www.resivote.ch`; Dev: additionally `localhost:4200/8081/4321` | No |

## Database (PostgreSQL)

| Variable | Description | Default | Required in Prod |
|---|---|---|---|
| `DB_HOST` | PostgreSQL host | `localhost` | Yes |
| `DB_PORT` | PostgreSQL port | `5432` | No |
| `DB_USER` | Database user | `resivote` | Yes |
| `DB_PASSWORD` | Database password | `resivote` | Yes |
| `DB_NAME` | Database name | `resivote` | Yes |
| `DB_SSLMODE` | SSL mode | `require` | Yes (`require` in prod) |
| `DB_MAX_OPEN_CONNS` | Max open connections | `15` | No |
| `DB_MAX_IDLE_CONNS` | Max idle connections | `5` | No |
| `DB_CONN_MAX_LIFETIME` | Max connection lifetime | `5m` | No |

## Auth (ZITADEL)

| Variable | Description | Default | Required in Prod |
|---|---|---|---|
| `ZITADEL_BASE_URL` | ZITADEL instance URL | `http://localhost:18180` | Yes |
| `ZITADEL_PROJECT_ID` | ZITADEL project ID | `resivote` | Yes |
| `ZITADEL_CLIENT_ID` | OIDC client ID (frontend) | `resivote-api` | Yes |
| `ZITADEL_CLIENT_SECRET` | OIDC client secret (token exchange) | — | Yes (for impersonation) |
| `ZITADEL_TOKEN_EXCHANGE_CLIENT_ID` | Client ID for token exchange | Fallback to `ZITADEL_CLIENT_ID` | Yes (for impersonation) |
| `ZITADEL_KEY_PATH` | Path to machine key JSON (gRPC) | — | No |
| `ZITADEL_PAT` | Personal Access Token (bootstrap, dev) | — | No (dev bootstrap) |
| `ZITADEL_ADMIN_USER` | ZITADEL admin user (dev) | `admin` | No |
| `ZITADEL_ADMIN_PASSWORD` | ZITADEL admin password (dev) | `admin` | No |
| `ZITADEL_POST_LOGOUT_REDIRECT_URI` | Post-logout redirect URI | — | No |
| `ZITADEL_EXPECTED_ISSUER` | Expected JWT issuer | `ZITADEL_BASE_URL` | No |
| `ZITADEL_EXPECTED_AUDIENCE` | Expected JWT audience | `ZITADEL_PROJECT_ID` | No |

## WebSocket

| Variable | Description | Default | Required in Prod |
|---|---|---|---|
| `WS_READ_BUFFER_SIZE` | Read buffer size (bytes) | `1024` | No |
| `WS_WRITE_BUFFER_SIZE` | Write buffer size (bytes) | `1024` | No |
| `WS_PONG_WAIT` | Pong wait time | `60s` | No |
| `WS_PING_PERIOD` | Ping interval (must be < `WS_PONG_WAIT`) | `54s` | No |
| `WS_WRITE_WAIT` | Write deadline | `10s` | No |
| `WS_MAX_MESSAGE_SIZE` | Max message size (bytes) | `4096` | No |

## Audit Log

<Aside type="warning" title="AUDIT_HASH_KEY mandatory in production">
  `AUDIT_HASH_KEY` must be set in production and be at least 32 bytes (256 bits). Without a strong HMAC key, the audit hash chain degrades to plain SHA-256 and cannot prove database manipulation (ZertES/nDSG violation). Generate with `openssl rand -base64 32`.
</Aside>

| Variable | Description | Default | Required in Prod |
|---|---|---|---|
| `AUDIT_FAIL_CLOSED` | Server exit on tamper detection | `true` | No |
| `AUDIT_FAIL_CLOSED_THRESHOLD` | Consecutive tamper detections before exit | `3` | No |
| `AUDIT_VERIFY_INTERVAL` | Interval for periodic chain verification | `5m` | No |
| `AUDIT_HASH_KEY` | HMAC-SHA-256 key for hash chain (>= 32 bytes) | — | **Yes** (>= 32 bytes, CSPRNG) |
| `AUDIT_MAX_LIMIT` | Max entries per list request | `1000` | No |

## Check-in

<Aside type="warning" title="CHECKIN_TOKEN_SIGNING_KEY mandatory in production">
  `CHECKIN_TOKEN_SIGNING_KEY` must be set in production and be at least 32 bytes. Without a strong HMAC key, anyone could forge valid QR check-in tokens.
</Aside>

| Variable | Description | Default | Required in Prod |
|---|---|---|---|
| `CHECKIN_TOKEN_SIGNING_KEY` | HMAC key for QR check-in tokens (>= 32 bytes) | — | **Yes** (>= 32 bytes, CSPRNG) |
| `CHECKIN_TOKEN_EXPIRY` | Validity period of a check-in token | `30m` | No |

## Email

| Variable | Description | Default | Required in Prod |
|---|---|---|---|
| `RESEND_API_KEY` | Resend API key | — | Yes (production sending) |
| `MAIL_FROM` | Sender address | `noreply@resivote.ch` | No |
| `MAIL_DEV_REDIRECT_TO` | Redirect target in non-prod | `nikolai.gut@outlook.com` | No |
| `CONTACT_RECIPIENT` | Recipient for contact form | `kontakt@resivote.ch` | No |
| `EMAIL_LOG_ONLY` | Log only, do not send | `true` in non-prod, `false` in prod | No |
| `EMAIL_PROCESS_INTERVAL` | Interval for scheduled email worker | `1m` | No |

<Aside type="note" title="Log-Only in Non-Production">
  In all non-production environments, emails are always logged and never sent — regardless of `EMAIL_LOG_ONLY` or `RESEND_API_KEY`. In production, log-only can be activated with `EMAIL_LOG_ONLY=true`.
</Aside>

## Storage

| Variable | Description | Default | Required in Prod |
|---|---|---|---|
| `STORAGE_TYPE` | Storage type (`local` or `s3`) | `local` | No |
| `STORAGE_LOCAL_PATH` | Local path for filesystem storage | `./uploads` | No |
| `STORAGE_S3_ENDPOINT` | S3-compatible endpoint | — | Yes (with `s3`) |
| `STORAGE_S3_BUCKET` | S3 bucket | — | Yes (with `s3`) |
| `STORAGE_S3_REGION` | S3 region | — | Yes (with `s3`) |
| `STORAGE_S3_ACCESS_KEY` | S3 access key | — | Yes (with `s3`) |
| `STORAGE_S3_SECRET_KEY` | S3 secret key | — | Yes (with `s3`) |
| `STORAGE_S3_USE_PATH_STYLE` | Path-style URLs (MinIO) | `false` | No |
| `STORAGE_MAX_UPLOAD_SIZE` | Max upload size | `50M` | No |
| `DOCUMENT_ENCRYPTION_MASTER_KEY` | Base64-encoded 32-byte AES master key for DEK wrapping | — | Yes (for document encryption) |

<Aside type="warning" title="Document Encryption">
  `DOCUMENT_ENCRYPTION_MASTER_KEY` is a base64-encoded 32-byte AES key that wraps tenant-specific Data Encryption Keys (DEKs). If the key is missing, document encryption does not start.
</Aside>

## Notifications (Web Push)

| Variable | Description | Default | Required in Prod |
|---|---|---|---|
| `VAPID_PUBLIC_KEY` | VAPID public key (frontend) | — | Yes (for push) |
| `VAPID_PRIVATE_KEY` | VAPID private key (server) | — | Yes (for push) |
| `VAPID_SUBJECT` | Contact URI for push service | `mailto:admin@resivote.ch` | No |
| `PUSH_ICON_URL` | Icon for push notifications | — | No |

## AI (Minutes Assistance)

| Variable | Description | Default | Required in Prod |
|---|---|---|---|
| `AI_PROVIDER` | Provider (`disabled`, `mock`, `llama`, `mistral`, `ollama`) | `disabled` in prod, `mock` in non-prod | No |
| `AI_LLAMA_ENDPOINT` | llama.cpp endpoint | `http://localhost:8080/v1/chat/completions` | No |
| `AI_LLAMA_MODEL` | llama.cpp model | `Qwen/Qwen2.5-7B-Instruct-GGUF:Q4_K_M` | No |
| `AI_LLAMA_API_KEY` | llama.cpp API key | `local-dummy` | No |
| `AI_MISTRAL_API_KEY` | Mistral API key | — | Yes (with `mistral`) |
| `AI_MISTRAL_ENDPOINT` | Mistral endpoint | `https://api.eu.mistral.ai/v1/chat/completions` | No |
| `AI_MISTRAL_MODEL` | Mistral model | `mistral-small-latest` | No |
| `AI_OLLAMA_ENDPOINT` | Ollama endpoint | `http://localhost:11434/api/chat` | No |
| `AI_OLLAMA_MODEL` | Ollama model | `llama3.1` | No |
| `AI_MAX_TOKENS` | Max generated tokens | `1024` | No |
| `AI_TEMPERATURE` | Creativity (0.0–1.0) | `0.3` | No |
| `AI_LOG_ONLY` | Mock response instead of LLM call | `false` | No |

## Converter (LibreOffice)

| Variable | Description | Default | Required in Prod |
|---|---|---|---|
| `CONVERTER_ENABLED` | Enable PDF conversion | `false` | No |
| `CONVERTER_COMMAND` | Converter binary (`soffice`, `libreoffice`) | `soffice` | No |

## Billing

| Variable | Description | Default | Required in Prod |
|---|---|---|---|
| `BILLING_WORKER_INTERVAL` | Interval for billing worker | `1h` | No |
| `BILLING_DUE_DAYS` | Due days after period end | `30` | No |
| `BILLING_DEFAULT_SENDER_NAME` | Default invoice sender name | `Nikolai Gut` | No |
| `BILLING_DEFAULT_SENDER_STREET` | Default sender street | `Münigenfeld 6A` | No |
| `BILLING_DEFAULT_SENDER_CITY` | Default sender city | `6208 Oberkirch` | No |
| `BILLING_DEFAULT_SENDER_VAT_NUMBER` | Default sender VAT number | — | No |
| `BILLING_DEFAULT_SENDER_QR_IBAN` | Default sender QR-IBAN | — | No |

## Demo Reset

| Variable | Description | Default | Required in Prod |
|---|---|---|---|
| `DEMO_RESET_ENABLED` | Enable demo reset worker | `false` | No |
| `DEMO_RESET_API_KEY` | API key for `/internal/demo-reset` | — | Yes (if enabled in prod) |
| `DEMO_RESET_RESET_OFFSET` | Time offset relative to 00:00 UTC | `0` | No |
| `DEMO_ZITADEL_ADMIN_ID` | ZITADEL user ID for demo admin | — | Yes (if enabled in prod) |
| `DEMO_ZITADEL_OWNER1_ID` | ZITADEL user ID for demo owner 1 | — | Yes (if enabled in prod) |
| `DEMO_ZITADEL_OWNER2_ID` | ZITADEL user ID for demo owner 2 | — | Yes (if enabled in prod) |
| `DEMO_ZITADEL_ADMIN_EMAIL` | Login email demo admin | `demo.admin@resivote.ch` | No |
| `DEMO_ZITADEL_OWNER1_EMAIL` | Login email demo owner 1 | `demo.owner1@resivote.ch` | No |
| `DEMO_ZITADEL_OWNER2_EMAIL` | Login email demo owner 2 | `demo.owner2@resivote.ch` | No |
| `DEMO_RESET_SLUG` | Tenant slug for demo (must be `demo`) | `demo` | No |
| `DEMO_RESET_HARD_DELETE` | Hard delete instead of archiving | `false` | No |

## Tenant Cache

| Variable | Description | Default | Required in Prod |
|---|---|---|---|
| `TENANT_CACHE_ENABLED` | In-process tenant membership cache | `true` | No |
| `TENANT_CACHE_TTL` | Cache TTL for membership entries | `5m` | No |

## Production Required Variables

<Aside type="danger" title="Required Variables in Production">
  The following variables must be set in production, otherwise the server refuses to start (`Config.Validate`):

  - **`APP_ENV`** — must be `production` or `prod`
  - **`AUDIT_HASH_KEY`** — >= 32 bytes, CSPRNG-generated (HMAC-SHA-256 for audit integrity)
  - **`CHECKIN_TOKEN_SIGNING_KEY`** — >= 32 bytes, CSPRNG-generated (HMAC-SHA-256 for QR tokens)
  - **`DOCUMENT_ENCRYPTION_MASTER_KEY`** — base64-encoded 32-byte AES key (document encryption)
  - **`DB_SSLMODE`** — must be `require`
  - **`ZITADEL_*`** — Base URL, project ID, client ID, client secret, PAT

  Additionally, the binary must be built with `-tags production` so that the JWT signature validation bypass does not exist in the binary.
</Aside>
