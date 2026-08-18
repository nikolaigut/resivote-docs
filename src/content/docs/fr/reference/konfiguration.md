---
title: Configuration (variables d'environnement)
description: Toutes les variables d'environnement de ResiVote par domaine de configuration – valeurs par défaut, champs obligatoires et exigences de production.
---

import { Aside, Tabs, TabItem } from '@astrojs/starlight/components';

ResiVote lit toute sa configuration depuis des variables d'environnement (12-Factor App). La structure est définie dans `internal/config/config.go`.

<Aside type="warning" title="APP_ENV est obligatoire">
  `APP_ENV` doit être explicitement défini comme variable d'environnement. Sans `APP_ENV`, le serveur refuse le démarrage (`ErrAppEnvNotSet`). En production, `.env` n'est **jamais** chargé — toutes les valeurs doivent provenir de l'environnement du processus ou du conteneur.
</Aside>

<Aside type="note" title=".env en non-production">
  En `development`, `dev`, `test` et `staging`, ResiVote charge automatiquement un fichier `.env` local. Les variables d'environnement explicites ont la priorité. En production (`production` / `prod`), le chargement de `.env` est désactivé.
</Aside>

## App et serveur

| Variable | Description | Par défaut | Obligatoire en prod |
|---|---|---|---|
| `APP_ENV` | Environnement (`production`, `development`, `dev`, `test`, `staging`) | — | **Oui** (sans valeur par défaut, le serveur refuse le démarrage) |
| `SERVER_PORT` | Port d'écoute HTTP | `18080`, repli sur `PORT` puis `8080` | Non |
| `SERVER_READ_TIMEOUT` | Délai d'attente en lecture | `15s` | Non |
| `SERVER_WRITE_TIMEOUT` | Délai d'attente en écriture | `15s` | Non |
| `SERVER_SHUTDOWN_TIMEOUT` | Délai d'arrêt gracieux | `10s` | Non |
| `SERVER_BODY_LIMIT` | Corps de requête max (syntaxe Echo, p. ex. `50M`) | `50M` | Non |
| `CORS_ORIGINS` | Origines CORS autorisées (séparées par des virgules) | Prod : `app.resivote.ch`, `resivote.ch`, `www.resivote.ch` ; Dev : en plus `localhost:4200/8081/4321` | Non |

## Base de données (PostgreSQL)

| Variable | Description | Par défaut | Obligatoire en prod |
|---|---|---|---|
| `DB_HOST` | Hôte PostgreSQL | `localhost` | Oui |
| `DB_PORT` | Port PostgreSQL | `5432` | Non |
| `DB_USER` | Utilisateur de la base de données | `resivote` | Oui |
| `DB_PASSWORD` | Mot de passe de la base de données | `resivote` | Oui |
| `DB_NAME` | Nom de la base de données | `resivote` | Oui |
| `DB_SSLMODE` | Mode SSL | `require` | Oui (`require` en prod) |
| `DB_MAX_OPEN_CONNS` | Max. connexions ouvertes | `15` | Non |
| `DB_MAX_IDLE_CONNS` | Max. connexions inactives | `5` | Non |
| `DB_CONN_MAX_LIFETIME` | Durée de vie max. des connexions | `5m` | Non |

## Auth (ZITADEL)

| Variable | Description | Par défaut | Obligatoire en prod |
|---|---|---|---|
| `ZITADEL_BASE_URL` | URL de l'instance ZITADEL | `http://localhost:18180` | Oui |
| `ZITADEL_PROJECT_ID` | ID de projet ZITADEL | `resivote` | Oui |
| `ZITADEL_CLIENT_ID` | ID client OIDC (frontend) | `resivote-api` | Oui |
| `ZITADEL_CLIENT_SECRET` | Secret client OIDC (Token Exchange) | — | Oui (pour l'impersonation) |
| `ZITADEL_TOKEN_EXCHANGE_CLIENT_ID` | ID client pour Token Exchange | Repli sur `ZITADEL_CLIENT_ID` | Oui (pour l'impersonation) |
| `ZITADEL_KEY_PATH` | Chemin vers le JSON de clé machine (gRPC) | — | Non |
| `ZITADEL_PAT` | Personal Access Token (bootstrap, dev) | — | Non (bootstrap dev) |
| `ZITADEL_ADMIN_USER` | Utilisateur admin ZITADEL (dev) | `admin` | Non |
| `ZITADEL_ADMIN_PASSWORD` | Mot de passe admin ZITADEL (dev) | `admin` | Non |
| `ZITADEL_POST_LOGOUT_REDIRECT_URI` | URI de redirection post-logout | — | Non |
| `ZITADEL_EXPECTED_ISSUER` | Émetteur JWT attendu | `ZITADEL_BASE_URL` | Non |
| `ZITADEL_EXPECTED_AUDIENCE` | Audience JWT attendue | `ZITADEL_PROJECT_ID` | Non |

## WebSocket

| Variable | Description | Par défaut | Obligatoire en prod |
|---|---|---|---|
| `WS_READ_BUFFER_SIZE` | Taille du buffer de lecture (octets) | `1024` | Non |
| `WS_WRITE_BUFFER_SIZE` | Taille du buffer d'écriture (octets) | `1024` | Non |
| `WS_PONG_WAIT` | Délai d'attente Pong | `60s` | Non |
| `WS_PING_PERIOD` | Intervalle Ping (doit être < `WS_PONG_WAIT`) | `54s` | Non |
| `WS_WRITE_WAIT` | Délai d'attente écriture | `10s` | Non |
| `WS_MAX_MESSAGE_SIZE` | Taille max. des messages (octets) | `4096` | Non |

## Journal d'audit

<Aside type="warning" title="AUDIT_HASH_KEY obligatoire en production">
  `AUDIT_HASH_KEY` doit être défini en production et faire au moins 32 octets (256 bits). Sans une clé HMAC forte, la chaîne de hachage d'audit dégrade vers SHA-256 simple et ne peut pas prouver une manipulation de base de données (violation ZertES/nDSG). Générer avec `openssl rand -base64 32`.
</Aside>

| Variable | Description | Par défaut | Obligatoire en prod |
|---|---|---|---|
| `AUDIT_FAIL_CLOSED` | Arrêt du serveur en cas de détection de falsification | `true` | Non |
| `AUDIT_FAIL_CLOSED_THRESHOLD` | Détections consécutives avant arrêt | `3` | Non |
| `AUDIT_VERIFY_INTERVAL` | Intervalle de vérification périodique de la chaîne | `5m` | Non |
| `AUDIT_HASH_KEY` | Clé HMAC-SHA-256 pour la chaîne de hachage (>= 32 octets) | — | **Oui** (>= 32 octets, CSPRNG) |
| `AUDIT_MAX_LIMIT` | Max. d'entrées par requête de liste | `1000` | Non |

## Enregistrement

<Aside type="warning" title="CHECKIN_TOKEN_SIGNING_KEY obligatoire en production">
  `CHECKIN_TOKEN_SIGNING_KEY` doit être défini en production et faire au moins 32 octets. Sans une clé HMAC forte, n'importe qui peut falsifier des jetons d'enregistrement QR valides.
</Aside>

| Variable | Description | Par défaut | Obligatoire en prod |
|---|---|---|---|
| `CHECKIN_TOKEN_SIGNING_KEY` | Clé HMAC pour les jetons d'enregistrement QR (>= 32 octets) | — | **Oui** (>= 32 octets, CSPRNG) |
| `CHECKIN_TOKEN_EXPIRY` | Durée de validité d'un jeton d'enregistrement | `30m` | Non |

## E-mail

| Variable | Description | Par défaut | Obligatoire en prod |
|---|---|---|---|
| `RESEND_API_KEY` | Clé API Resend | — | Oui (envoi en prod) |
| `MAIL_FROM` | Adresse d'expéditeur | `noreply@resivote.ch` | Non |
| `MAIL_DEV_REDIRECT_TO` | Destination de redirection en non-prod | `nikolai.gut@outlook.com` | Non |
| `CONTACT_RECIPIENT` | Destinataire du formulaire de contact | `kontakt@resivote.ch` | Non |
| `EMAIL_LOG_ONLY` | Journaliser uniquement, ne pas envoyer | `true` en non-prod, `false` en prod | Non |
| `EMAIL_PROCESS_INTERVAL` | Intervalle du worker d'e-mails planifiés | `1m` | Non |

<Aside type="note" title="Log-Only en non-production">
  Dans tous les environnements non-production, les e-mails sont toujours journalisés et jamais envoyés — indépendamment de `EMAIL_LOG_ONLY` ou `RESEND_API_KEY`. En production, le mode log-only peut être activé avec `EMAIL_LOG_ONLY=true`.
</Aside>

## Stockage

| Variable | Description | Par défaut | Obligatoire en prod |
|---|---|---|---|
| `STORAGE_TYPE` | Type de stockage (`local` ou `s3`) | `local` | Non |
| `STORAGE_LOCAL_PATH` | Chemin local pour le stockage sur système de fichiers | `./uploads` | Non |
| `STORAGE_S3_ENDPOINT` | Endpoint compatible S3 | — | Oui (si `s3`) |
| `STORAGE_S3_BUCKET` | Bucket S3 | — | Oui (si `s3`) |
| `STORAGE_S3_REGION` | Région S3 | — | Oui (si `s3`) |
| `STORAGE_S3_ACCESS_KEY` | Clé d'accès S3 | — | Oui (si `s3`) |
| `STORAGE_S3_SECRET_KEY` | Clé secrète S3 | — | Oui (si `s3`) |
| `STORAGE_S3_USE_PATH_STYLE` | URLs en path-style (MinIO) | `false` | Non |
| `STORAGE_MAX_UPLOAD_SIZE` | Taille max. de téléchargement | `50M` | Non |
| `DOCUMENT_ENCRYPTION_MASTER_KEY` | Clé master AES 32 octets codée en base64 pour l'enveloppement des DEK | — | Oui (pour le chiffrement des documents) |

<Aside type="warning" title="Chiffrement des documents">
  `DOCUMENT_ENCRYPTION_MASTER_KEY` est une clé AES de 32 octets codée en base64 qui enveloppe les Data Encryption Keys (DEK) spécifiques au mandant. Si la clé manque, le chiffrement des documents ne démarre pas.
</Aside>

## Notifications (Web Push)

| Variable | Description | Par défaut | Obligatoire en prod |
|---|---|---|---|
| `VAPID_PUBLIC_KEY` | Clé publique VAPID (frontend) | — | Oui (pour push) |
| `VAPID_PRIVATE_KEY` | Clé privée VAPID (serveur) | — | Oui (pour push) |
| `VAPID_SUBJECT` | URI de contact pour le service push | `mailto:admin@resivote.ch` | Non |
| `PUSH_ICON_URL` | Icône pour les notifications push | — | Non |

## IA (assistance au procès-verbal)

| Variable | Description | Par défaut | Obligatoire en prod |
|---|---|---|---|
| `AI_PROVIDER` | Provider (`disabled`, `mock`, `llama`, `mistral`, `ollama`) | `disabled` en prod, `mock` en non-prod | Non |
| `AI_LLAMA_ENDPOINT` | Endpoint llama.cpp | `http://localhost:8080/v1/chat/completions` | Non |
| `AI_LLAMA_MODEL` | Modèle llama.cpp | `Qwen/Qwen2.5-7B-Instruct-GGUF:Q4_K_M` | Non |
| `AI_LLAMA_API_KEY` | Clé API llama.cpp | `local-dummy` | Non |
| `AI_MISTRAL_API_KEY` | Clé API Mistral | — | Oui (si `mistral`) |
| `AI_MISTRAL_ENDPOINT` | Endpoint Mistral | `https://api.eu.mistral.ai/v1/chat/completions` | Non |
| `AI_MISTRAL_MODEL` | Modèle Mistral | `mistral-small-latest` | Non |
| `AI_OLLAMA_ENDPOINT` | Endpoint Ollama | `http://localhost:11434/api/chat` | Non |
| `AI_OLLAMA_MODEL` | Modèle Ollama | `llama3.1` | Non |
| `AI_MAX_TOKENS` | Max. tokens générés | `1024` | Non |
| `AI_TEMPERATURE` | Créativité (0.0–1.0) | `0.3` | Non |
| `AI_LOG_ONLY` | Réponse mock au lieu d'un appel LLM | `false` | Non |

## Convertisseur (LibreOffice)

| Variable | Description | Par défaut | Obligatoire en prod |
|---|---|---|---|
| `CONVERTER_ENABLED` | Activer la conversion PDF | `false` | Non |
| `CONVERTER_COMMAND` | Binaire du convertisseur (`soffice`, `libreoffice`) | `soffice` | Non |

## Facturation

| Variable | Description | Par défaut | Obligatoire en prod |
|---|---|---|---|
| `BILLING_WORKER_INTERVAL` | Intervalle du worker de facturation | `1h` | Non |
| `BILLING_DUE_DAYS` | Jours d'échéance après fin de période | `30` | Non |
| `BILLING_DEFAULT_SENDER_NAME` | Nom d'expéditeur de facture par défaut | `Nikolai Gut` | Non |
| `BILLING_DEFAULT_SENDER_STREET` | Rue de l'expéditeur par défaut | `Münigenfeld 6A` | Non |
| `BILLING_DEFAULT_SENDER_CITY` | Ville de l'expéditeur par défaut | `6208 Oberkirch` | Non |
| `BILLING_DEFAULT_SENDER_VAT_NUMBER` | Numéro de TVA de l'expéditeur par défaut | — | Non |
| `BILLING_DEFAULT_SENDER_QR_IBAN` | QR-IBAN de l'expéditeur par défaut | — | Non |

## Demo-Reset

| Variable | Description | Par défaut | Obligatoire en prod |
|---|---|---|---|
| `DEMO_RESET_ENABLED` | Activer le worker de demo-reset | `false` | Non |
| `DEMO_RESET_API_KEY` | Clé API pour `/internal/demo-reset` | — | Oui (si activé en prod) |
| `DEMO_RESET_RESET_OFFSET` | Décalage temporel relatif à 00:00 UTC | `0` | Non |
| `DEMO_ZITADEL_ADMIN_ID` | ID utilisateur ZITADEL pour l'admin démo | — | Oui (si activé en prod) |
| `DEMO_ZITADEL_OWNER1_ID` | ID utilisateur ZITADEL pour le propriétaire démo 1 | — | Oui (si activé en prod) |
| `DEMO_ZITADEL_OWNER2_ID` | ID utilisateur ZITADEL pour le propriétaire démo 2 | — | Oui (si activé en prod) |
| `DEMO_ZITADEL_ADMIN_EMAIL` | E-mail de connexion admin démo | `demo.admin@resivote.ch` | Non |
| `DEMO_ZITADEL_OWNER1_EMAIL` | E-mail de connexion propriétaire démo 1 | `demo.owner1@resivote.ch` | Non |
| `DEMO_ZITADEL_OWNER2_EMAIL` | E-mail de connexion propriétaire démo 2 | `demo.owner2@resivote.ch` | Non |
| `DEMO_RESET_SLUG` | Slug du mandant démo (doit être `demo`) | `demo` | Non |
| `DEMO_RESET_HARD_DELETE` | Hard-delete au lieu d'archiver | `false` | Non |

## Cache de mandant

| Variable | Description | Par défaut | Obligatoire en prod |
|---|---|---|---|
| `TENANT_CACHE_ENABLED` | Cache d'appartenance au mandant en processus | `true` | Non |
| `TENANT_CACHE_TTL` | TTL du cache pour les entrées d'appartenance | `5m` | Non |

## Variables obligatoires en production

<Aside type="danger" title="Variables obligatoires en production">
  Les variables suivantes doivent être définies en production, sinon le serveur refuse le démarrage (`Config.Validate`) :

  - **`APP_ENV`** — doit être `production` ou `prod`
  - **`AUDIT_HASH_KEY`** — >= 32 octets, généré par CSPRNG (HMAC-SHA-256 pour l'intégrité d'audit)
  - **`CHECKIN_TOKEN_SIGNING_KEY`** — >= 32 octets, généré par CSPRNG (HMAC-SHA-256 pour les jetons QR)
  - **`DOCUMENT_ENCRYPTION_MASTER_KEY`** — clé AES de 32 octets codée en base64 (chiffrement des documents)
  - **`DB_SSLMODE`** — doit être `require`
  - **`ZITADEL_*`** — URL de base, ID de projet, ID client, secret client, PAT

  De plus, le binaire doit être compilé avec `-tags production` pour que le contournement de validation de signature JWT n'existe pas dans le binaire.
</Aside>
