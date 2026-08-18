---
title: Konfiguration (Umgebungsvariablen)
description: Alle Umgebungsvariablen von ResiVote nach Konfigurationsbereich – Defaults, Pflichtfelder und Produktionsanforderungen.
---

import { Aside, Tabs, TabItem } from '@astrojs/starlight/components';

ResiVote liest die gesamte Konfiguration aus Umgebungsvariablen (12-Factor App). Die Struktur ist in `internal/config/config.go` definiert.

<Aside type="warning" title="APP_ENV ist zwingend">
  `APP_ENV` muss explizit als Umgebungsvariable gesetzt sein. Ohne `APP_ENV` verweigert der Server den Start (`ErrAppEnvNotSet`). In Produktion wird `.env` **niemals** geladen — alle Werte müssen aus der Prozess- oder Container-Umgebung stammen.
</Aside>

<Aside type="note" title=".env in Nicht-Produktion">
  In `development`, `dev`, `test` und `staging` lädt ResiVote automatisch eine lokale `.env`-Datei. Explizite Umgebungsvariablen haben Vorrang. In Produktion (`production` / `prod`) ist das `.env`-Loading deaktiviert.
</Aside>

## App & Server

| Variable | Beschreibung | Default | Pflicht in Prod |
|---|---|---|---|
| `APP_ENV` | Umgebung (`production`, `development`, `dev`, `test`, `staging`) | — | **Ja** (ohne Default, Server verweigert Start) |
| `SERVER_PORT` | HTTP-Listen-Port | `18080`, Fallback auf `PORT` dann `8080` | Nein |
| `SERVER_READ_TIMEOUT` | Lese-Timeout | `15s` | Nein |
| `SERVER_WRITE_TIMEOUT` | Schreib-Timeout | `15s` | Nein |
| `SERVER_SHUTDOWN_TIMEOUT` | Graceful-Shutdown-Timeout | `10s` | Nein |
| `SERVER_BODY_LIMIT` | Max. Request-Body (Echo-Syntax, z.B. `50M`) | `50M` | Nein |
| `CORS_ORIGINS` | Erlaubte CORS-Origin (komma-separiert) | Prod: `app.resivote.ch`, `resivote.ch`, `www.resivote.ch`; Dev: zusätzlich `localhost:4200/8081/4321` | Nein |

## Datenbank (PostgreSQL)

| Variable | Beschreibung | Default | Pflicht in Prod |
|---|---|---|---|
| `DB_HOST` | PostgreSQL-Host | `localhost` | Ja |
| `DB_PORT` | PostgreSQL-Port | `5432` | Nein |
| `DB_USER` | Datenbank-Benutzer | `resivote` | Ja |
| `DB_PASSWORD` | Datenbank-Passwort | `resivote` | Ja |
| `DB_NAME` | Datenbank-Name | `resivote` | Ja |
| `DB_SSLMODE` | SSL-Modus | `require` | Ja (`require` in Prod) |
| `DB_MAX_OPEN_CONNS` | Max. offene Verbindungen | `15` | Nein |
| `DB_MAX_IDLE_CONNS` | Max. Idle-Verbindungen | `5` | Nein |
| `DB_CONN_MAX_LIFETIME` | Max. Verbindungsalter | `5m` | Nein |

## Auth (ZITADEL)

| Variable | Beschreibung | Default | Pflicht in Prod |
|---|---|---|---|
| `ZITADEL_BASE_URL` | ZITADEL-Instanz-URL | `http://localhost:18180` | Ja |
| `ZITADEL_PROJECT_ID` | ZITADEL-Projekt-ID | `resivote` | Ja |
| `ZITADEL_CLIENT_ID` | OIDC-Client-ID (Frontend) | `resivote-api` | Ja |
| `ZITADEL_CLIENT_SECRET` | OIDC-Client-Secret (Token Exchange) | — | Ja (für Impersonation) |
| `ZITADEL_TOKEN_EXCHANGE_CLIENT_ID` | Client-ID für Token Exchange | Fallback auf `ZITADEL_CLIENT_ID` | Ja (für Impersonation) |
| `ZITADEL_KEY_PATH` | Pfad zum Machine-Key-JSON (gRPC) | — | Nein |
| `ZITADEL_PAT` | Personal Access Token (Bootstrap, Dev) | — | Nein (Dev-Bootstrap) |
| `ZITADEL_ADMIN_USER` | ZITADEL-Admin-Benutzer (Dev) | `admin` | Nein |
| `ZITADEL_ADMIN_PASSWORD` | ZITADEL-Admin-Passwort (Dev) | `admin` | Nein |
| `ZITADEL_POST_LOGOUT_REDIRECT_URI` | Post-Logout-Redirect-URI | — | Nein |
| `ZITADEL_EXPECTED_ISSUER` | Erwarteter JWT-Issuer | `ZITADEL_BASE_URL` | Nein |
| `ZITADEL_EXPECTED_AUDIENCE` | Erwartete JWT-Audience | `ZITADEL_PROJECT_ID` | Nein |

## WebSocket

| Variable | Beschreibung | Default | Pflicht in Prod |
|---|---|---|---|
| `WS_READ_BUFFER_SIZE` | Read-Buffer-Grösse (Bytes) | `1024` | Nein |
| `WS_WRITE_BUFFER_SIZE` | Write-Buffer-Grösse (Bytes) | `1024` | Nein |
| `WS_PONG_WAIT` | Wartezeit auf Pong | `60s` | Nein |
| `WS_PING_PERIOD` | Ping-Intervall (muss < `WS_PONG_WAIT`) | `54s` | Nein |
| `WS_WRITE_WAIT` | Write-Deadline | `10s` | Nein |
| `WS_MAX_MESSAGE_SIZE` | Max. Nachrichtengrösse (Bytes) | `4096` | Nein |

## Audit-Log

<Aside type="warning" title="AUDIT_HASH_KEY in Produktion zwingend">
  `AUDIT_HASH_KEY` muss in Produktion gesetzt sein und mindestens 32 Bytes (256 Bits) betragen. Ohne starken HMAC-Schlüssel degradiert die Audit-Hash-Chain zu plain SHA-256 und kann Datenbank-Manipulation nicht nachweisen (ZertES/nDSG-Verletzung). Generieren mit `openssl rand -base64 32`.
</Aside>

| Variable | Beschreibung | Default | Pflicht in Prod |
|---|---|---|---|
| `AUDIT_FAIL_CLOSED` | Server-Exit bei Tamper-Erkennung | `true` | Nein |
| `AUDIT_FAIL_CLOSED_THRESHOLD` | Konsekutive Tamper-Erkennungen vor Exit | `3` | Nein |
| `AUDIT_VERIFY_INTERVAL` | Intervall für periodische Chain-Verifikation | `5m` | Nein |
| `AUDIT_HASH_KEY` | HMAC-SHA-256-Key für Hash-Chain (>= 32 Bytes) | — | **Ja** (>= 32 Bytes, CSPRNG) |
| `AUDIT_MAX_LIMIT` | Max. Einträge pro List-Request | `1000` | Nein |

## Check-in

<Aside type="warning" title="CHECKIN_TOKEN_SIGNING_KEY in Produktion zwingend">
  `CHECKIN_TOKEN_SIGNING_KEY` muss in Produktion gesetzt sein und mindestens 32 Bytes betragen. Ohne starken HMAC-Key kann jeder gültige QR-Check-in-Tokens fälschen.
</Aside>

| Variable | Beschreibung | Default | Pflicht in Prod |
|---|---|---|---|
| `CHECKIN_TOKEN_SIGNING_KEY` | HMAC-Key für QR-Check-in-Tokens (>= 32 Bytes) | — | **Ja** (>= 32 Bytes, CSPRNG) |
| `CHECKIN_TOKEN_EXPIRY` | Gültigkeitsdauer eines Check-in-Tokens | `30m` | Nein |

## E-Mail

| Variable | Beschreibung | Default | Pflicht in Prod |
|---|---|---|---|
| `RESEND_API_KEY` | Resend-API-Key | — | Ja (Prod-Versand) |
| `MAIL_FROM` | Absender-Adresse | `noreply@resivote.ch` | Nein |
| `MAIL_DEV_REDIRECT_TO` | Redirect-Ziel in Nicht-Prod | `nikolai.gut@outlook.com` | Nein |
| `CONTACT_RECIPIENT` | Empfänger für Kontaktformular | `kontakt@resivote.ch` | Nein |
| `EMAIL_LOG_ONLY` | Nur loggen, nicht versenden | `true` in Nicht-Prod, `false` in Prod | Nein |
| `EMAIL_PROCESS_INTERVAL` | Intervall für Scheduled-Email-Worker | `1m` | Nein |

<Aside type="note" title="Log-Only in Nicht-Produktion">
  In allen Nicht-Produktions-Umgebungen werden E-Mails immer geloggt und nie versendet — unabhängig von `EMAIL_LOG_ONLY` oder `RESEND_API_KEY`. In Produktion kann Log-Only mit `EMAIL_LOG_ONLY=true` aktiviert werden.
</Aside>

## Storage

| Variable | Beschreibung | Default | Pflicht in Prod |
|---|---|---|---|
| `STORAGE_TYPE` | Storage-Typ (`local` oder `s3`) | `local` | Nein |
| `STORAGE_LOCAL_PATH` | Lokaler Pfad für Filesystem-Storage | `./uploads` | Nein |
| `STORAGE_S3_ENDPOINT` | S3-kompatibler Endpoint | — | Ja (bei `s3`) |
| `STORAGE_S3_BUCKET` | S3-Bucket | — | Ja (bei `s3`) |
| `STORAGE_S3_REGION` | S3-Region | — | Ja (bei `s3`) |
| `STORAGE_S3_ACCESS_KEY` | S3-Access-Key | — | Ja (bei `s3`) |
| `STORAGE_S3_SECRET_KEY` | S3-Secret-Key | — | Ja (bei `s3`) |
| `STORAGE_S3_USE_PATH_STYLE` | Path-Style-URLs (MinIO) | `false` | Nein |
| `STORAGE_MAX_UPLOAD_SIZE` | Max. Upload-Grösse | `50M` | Nein |
| `DOCUMENT_ENCRYPTION_MASTER_KEY` | Base64-kodierter 32-Byte AES-Master-Key für DEK-Wrapping | — | Ja (für Dokument-Verschlüsselung) |

<Aside type="warning" title="Dokument-Verschlüsselung">
  `DOCUMENT_ENCRYPTION_MASTER_KEY` ist ein base64-kodierter 32-Byte-AES-Key, der mandanten-spezifische Data Encryption Keys (DEKs) wrappt. Fehlt der Key, startet die Dokument-Verschlüsselung nicht.
</Aside>

## Notifications (Web Push)

| Variable | Beschreibung | Default | Pflicht in Prod |
|---|---|---|---|
| `VAPID_PUBLIC_KEY` | VAPID Public Key (Frontend) | — | Ja (für Push) |
| `VAPID_PRIVATE_KEY` | VAPID Private Key (Server) | — | Ja (für Push) |
| `VAPID_SUBJECT` | Kontakt-URI für Push-Service | `mailto:admin@resivote.ch` | Nein |
| `PUSH_ICON_URL` | Icon für Push-Notifications | — | Nein |

## AI (Protokoll-Assistenz)

| Variable | Beschreibung | Default | Pflicht in Prod |
|---|---|---|---|
| `AI_PROVIDER` | Provider (`disabled`, `mock`, `llama`, `mistral`, `ollama`) | `disabled` in Prod, `mock` in Nicht-Prod | Nein |
| `AI_LLAMA_ENDPOINT` | llama.cpp-Endpoint | `http://localhost:8080/v1/chat/completions` | Nein |
| `AI_LLAMA_MODEL` | llama.cpp-Modell | `Qwen/Qwen2.5-7B-Instruct-GGUF:Q4_K_M` | Nein |
| `AI_LLAMA_API_KEY` | llama.cpp-API-Key | `local-dummy` | Nein |
| `AI_MISTRAL_API_KEY` | Mistral-API-Key | — | Ja (bei `mistral`) |
| `AI_MISTRAL_ENDPOINT` | Mistral-Endpoint | `https://api.eu.mistral.ai/v1/chat/completions` | Nein |
| `AI_MISTRAL_MODEL` | Mistral-Modell | `mistral-small-latest` | Nein |
| `AI_OLLAMA_ENDPOINT` | Ollama-Endpoint | `http://localhost:11434/api/chat` | Nein |
| `AI_OLLAMA_MODEL` | Ollama-Modell | `llama3.1` | Nein |
| `AI_MAX_TOKENS` | Max. generierte Tokens | `1024` | Nein |
| `AI_TEMPERATURE` | Kreativität (0.0–1.0) | `0.3` | Nein |
| `AI_LOG_ONLY` | Mock-Response statt LLM-Aufruf | `false` | Nein |

## Converter (LibreOffice)

| Variable | Beschreibung | Default | Pflicht in Prod |
|---|---|---|---|
| `CONVERTER_ENABLED` | PDF-Konvertierung aktivieren | `false` | Nein |
| `CONVERTER_COMMAND` | Converter-Binary (`soffice`, `libreoffice`) | `soffice` | Nein |

## Billing

| Variable | Beschreibung | Default | Pflicht in Prod |
|---|---|---|---|
| `BILLING_WORKER_INTERVAL` | Intervall für Billing-Worker | `1h` | Nein |
| `BILLING_DUE_DAYS` | Fälligkeits-Tage nach Periodenende | `30` | Nein |
| `BILLING_DEFAULT_SENDER_NAME` | Default-Rechnungs-Absendername | `Nikolai Gut` | Nein |
| `BILLING_DEFAULT_SENDER_STREET` | Default-Absender-Strasse | `Münigenfeld 6A` | Nein |
| `BILLING_DEFAULT_SENDER_CITY` | Default-Absender-Stadt | `6208 Oberkirch` | Nein |
| `BILLING_DEFAULT_SENDER_VAT_NUMBER` | Default-Absender-MWST-Nummer | — | Nein |
| `BILLING_DEFAULT_SENDER_QR_IBAN` | Default-Absender-QR-IBAN | — | Nein |

## Demo-Reset

| Variable | Beschreibung | Default | Pflicht in Prod |
|---|---|---|---|
| `DEMO_RESET_ENABLED` | Demo-Reset-Worker aktivieren | `false` | Nein |
| `DEMO_RESET_API_KEY` | API-Key für `/internal/demo-reset` | — | Ja (wenn in Prod aktiviert) |
| `DEMO_RESET_RESET_OFFSET` | Zeit-Offset relativ zu 00:00 UTC | `0` | Nein |
| `DEMO_ZITADEL_ADMIN_ID` | ZITADEL-User-ID für Demo-Admin | — | Ja (wenn in Prod aktiviert) |
| `DEMO_ZITADEL_OWNER1_ID` | ZITADEL-User-ID für Demo-Owner 1 | — | Ja (wenn in Prod aktiviert) |
| `DEMO_ZITADEL_OWNER2_ID` | ZITADEL-User-ID für Demo-Owner 2 | — | Ja (wenn in Prod aktiviert) |
| `DEMO_ZITADEL_ADMIN_EMAIL` | Login-E-Mail Demo-Admin | `demo.admin@resivote.ch` | Nein |
| `DEMO_ZITADEL_OWNER1_EMAIL` | Login-E-Mail Demo-Owner 1 | `demo.owner1@resivote.ch` | Nein |
| `DEMO_ZITADEL_OWNER2_EMAIL` | Login-E-Mail Demo-Owner 2 | `demo.owner2@resivote.ch` | Nein |
| `DEMO_RESET_SLUG` | Tenant-Slug für Demo (muss `demo` sein) | `demo` | Nein |
| `DEMO_RESET_HARD_DELETE` | Hard-Delete statt Archivieren | `false` | Nein |

## Tenant-Cache

| Variable | Beschreibung | Default | Pflicht in Prod |
|---|---|---|---|
| `TENANT_CACHE_ENABLED` | In-Prozess-Tenant-Membership-Cache | `true` | Nein |
| `TENANT_CACHE_TTL` | Cache-TTL für Membership-Einträge | `5m` | Nein |

## Produktions-Pflichtvariablen

<Aside type="danger" title="Pflichtvariablen in Produktion">
  Folgende Variablen müssen in Produktion gesetzt sein, sonst verweigert der Server den Start (`Config.Validate`):

  - **`APP_ENV`** — muss `production` oder `prod` sein
  - **`AUDIT_HASH_KEY`** — >= 32 Bytes, CSPRNG-generiert (HMAC-SHA-256 für Audit-Integrität)
  - **`CHECKIN_TOKEN_SIGNING_KEY`** — >= 32 Bytes, CSPRNG-generiert (HMAC-SHA-256 für QR-Tokens)
  - **`DOCUMENT_ENCRYPTION_MASTER_KEY`** — base64-kodierter 32-Byte-AES-Key (Dokument-Verschlüsselung)
  - **`DB_SSLMODE`** — muss `require` sein
  - **`ZITADEL_*`** — Base-URL, Project-ID, Client-ID, Client-Secret, PAT

  Zusätzlich muss das Binary mit `-tags production` gebaut sein, damit der JWT-Signatur-Validierungs-Bypass nicht im Binary existiert.
</Aside>
