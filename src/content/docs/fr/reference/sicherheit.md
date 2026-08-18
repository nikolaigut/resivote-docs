---
title: Sécurité et conformité
description: Documentation de référence de l'architecture de sécurité de ResiVote — authentification, isolation multi-mandants, chiffrement, journal d'audit et conformité.
---

import { Aside, Steps, LinkCard } from '@astrojs/starlight/components';

ResiVote implémente une Defense-in-Depth sur plusieurs couches : authentification OIDC, PostgreSQL Row-Level Security, chiffrement de documents par mandant, chaîne de hachage d'audit immuable et gardes de configuration critiques en production.

## Authentification

### ZITADEL OIDC

L'authentification s'effectue via ZITADEL OIDC. Le `ZITADELValidator` (`internal/infrastructure/auth/zitadel.go`) valide les JWT access-tokens :

1. **Validation de signature** — signature RSA contre les JWKS (`{BaseURL}/oauth/v2/keys`), mises en cache avec TTL de 5 minutes et retry avec backoff exponentiel (100ms, 500ms, 2s).
2. **Validation de l'émetteur** — le claim `iss` doit correspondre à `ExpectedIssuer` (par défaut : `BaseURL`).
3. **Validation d'audience** — le claim `aud` doit contenir `ExpectedAudience` (par défaut : `ProjectID`).
4. **Enrichissement Userinfo** — si l'e-mail n'est pas contenu dans l'access-token, l'endpoint Userinfo ZITADEL (`{BaseURL}/oidc/v1/userinfo`) est interrogé et mis en cache pendant 5 minutes.

Le `AuthMiddleware` (`internal/interfaces/http/middleware/auth.go`) extrait le token depuis l'en-tête `Authorization` ou du paramètre de requête `token` (pour WebSocket).

<Aside type="warning" title="Contournement JWT uniquement en non-production">
Dans les builds non-production (sans `-tags production`), un repli existe qui analyse les claims sans validation de signature si les JWKS sont inaccessibles. Dans les builds de production (`-tags production`), ce code est **complètement absent** — il n'est pas compilé dans le binaire. La vérification au démarrage dans `main.go` refuse le démarrage si `APP_ENV=production` mais que le build-tag manque.
</Aside>

### Bootstrap ZITADEL et client admin

Dans les environnements de dev, `EnsureDevZITADELSetup` (`zitadel_bootstrap.go`) crée idempotemment le projet, le client OIDC, les utilisateurs et le script d'action. Le bootstrap utilise un PAT (Personal Access Token) pour l'authentification machine.

Le `ZITADELAdminClient` (`zitadel_admin.go`) gère les utilisateurs via l'API de gestion ZITADEL. Deux backends :

- **gRPC** — lorsque `ZITADEL_KEY_PATH` pointe vers un fichier JSON de clé machine (production).
- **REST** — lorsque `ZITADEL_PAT` est défini et qu'aucune clé machine n'est disponible (dev).
- **No-Op** — lorsque ni clé ni PAT ne sont configurés (dev sans intégration ZITADEL).

## Isolation multi-mandants

### PostgreSQL Row Level Security (RLS)

Chaque table tenant-scoped possède une politique RLS `tenant_isolation_policy`. La politique compare `tenant_id` avec la variable de session `app.current_tenant_id` :

```sql
USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
```

La migration `000004` ajoute des clauses `WITH CHECK` à toutes les politiques, qui valident également l'accès en écriture (INSERT/UPDATE). Les tables sans colonne `tenant_id` directe (`proxy_instructions`, `signature_units`) utilisent des sous-requêtes EXISTS sur la table parent.

### DBTransactionMiddleware

Le `DBTransactionMiddleware` (`internal/interfaces/http/middleware/db_tx.go`) ouvre une transaction GORM par requête et définit `SET LOCAL app.current_tenant_id`. La transaction est commitée en cas de succès du handler, annulée en cas d'erreur. Sans Tenant-ID dans le contexte (routes super-admin), `SET LOCAL` est ignoré — les politiques RLS échouent en mode fermé (aucune ligne).

### TenantScopedDB

Le `TenantScopedDB` (`internal/infrastructure/persistence/tenant_scoped_db.go`) est une interface restreinte sur `*gorm.DB` qui n'expose pas `Exec`. Cela empêche les appelants d'appeler `SetTenantContext` en milieu de transaction et de changer le périmètre mandant RLS. La protection principale est les politiques RLS fail-closed ; l'interface est une Defense-in-Depth.

## Chiffrement des documents

### DEK par mandant

Chaque mandant reçoit son propre Data Encryption Key (DEK), généré comme une valeur CSPRNG de 32 octets. Le DEK est enveloppé avec la master key par AES-GCM et stocké en tant que `encrypted_dek` dans la table `tenants` (`tenant_key.go`).

La génération est atomique : `UpdateIfDEKMissing` ne définit le DEK que si `encrypted_dek IS NULL`, de sorte que les appels concurrents de première fois ne s'écrasent pas mutuellement.

### Clé par document

La clé de document est dérivée par HKDF-SHA256 à partir du DEK du mandant et de l'ID du document (`document_encryption.go`) :

```
HKDF-SHA256(dek, salt=documentID[:], info="resivote-doc-v1") → 32-byte key
```

Le chiffrement utilise AES-GCM avec une nonce fraîche par document. Le format est `nonce || ciphertext+tag`.

<Aside type="warning" title="DOCUMENT_ENCRYPTION_MASTER_KEY">
La variable d'environnement `DOCUMENT_ENCRYPTION_MASTER_KEY` doit être une clé AES de 32 octets codée en base64. Sans cette clé, le chiffrement des documents est désactivé. Génération : `openssl rand -base64 32`.
</Aside>

## Journal d'audit

### Chaîne de hachage immuable

Chaque `AuditEntry` contient `PreviousHash` et `Hash`, qui forment une chaîne de hachage chaînée. Trois versions de hachage :

| Version | Algorithme | Champs |
|---|---|---|
| v1 | SHA-256 simple (déprécié) | Champs principaux, sans IP/UserAgent |
| v2 | SHA-256 ou HMAC-SHA-256 | Tous les champs incl. IP/UserAgent |
| v3 | SHA-256 ou HMAC-SHA-256 | v2 + `ImpersonatedByID` |

`ComputeHashWith` dispatche en fonction de `HashVersion`. En production, `AUDIT_HASH_KEY` (≥32 octets) est requis — sans lui, la chaîne dégrade vers SHA-256 simple, ce qui ne permet pas de détecter les manipulations au niveau de la base de données (violation ZertES/nDSG).

### Immutabilité au niveau DB

Les triggers PostgreSQL bloquent `UPDATE`, `DELETE` et `TRUNCATE` sur `audit_entries`, `signatures` et `signature_units` (migration `000001`). Un event-trigger (`audit_entries_ddl_guard`) bloque le DDL sur `audit_entries`, sauf en mode maintenance (`app.maintenance=on`), qui est journalisé dans `audit_maintenance_events`.

### Fail-Closed et vérification

| Mécanisme | Configuration | Par défaut |
|---|---|---|
| `FailClosed` | `AUDIT_FAIL_CLOSED` | `true` |
| `FailClosedThreshold` | `AUDIT_FAIL_CLOSED_THRESHOLD` | 3 |
| `VerifyInterval` | `AUDIT_VERIFY_INTERVAL` | 5 minutes |

Avec `FailClosed=true`, un échec de vérification au démarrage entraîne `os.Exit(1)`. La vérification périodique nécessite `FailClosedThreshold` détections consécutives de manipulation avant que le serveur ne soit arrêté (mitigation DoS : une seule entrée corrompue ne fait pas crasher le service immédiatement). La vérification au démarrage a toujours un seuil de 1.

Le flux de démarrage vérifie en plus les triggers d'application de l'immutabilité et le statut non-superuser du rôle DB.

## Sécurité des jetons d'enregistrement

Les jetons d'enregistrement QR sont signés avec HMAC-SHA-256 (`CheckInTokenService`). La clé de signature est `CHECKIN_TOKEN_SIGNING_KEY`.

<Aside type="warning" title="Variables d'environnement critiques en production">
En production (`APP_ENV=production`), les variables d'environnement suivantes sont **obligatoires** — le serveur refuse le démarrage en cas d'absence ou de valeur trop courte :

- **`AUDIT_HASH_KEY`** — ≥32 octets, HMAC-SHA-256 pour la chaîne de hachage d'audit (ZertES/nDSG)
- **`CHECKIN_TOKEN_SIGNING_KEY`** — ≥32 octets, HMAC-SHA-256 pour les jetons d'enregistrement QR
- **`APP_ENV`** — doit être explicitement défini (pas de valeur par défaut)
- **`DOCUMENT_ENCRYPTION_MASTER_KEY`** — clé AES de 32 octets codée en base64

Génération : `openssl rand -base64 32`
</Aside>

La durée de validité du jeton est `CHECKIN_TOKEN_EXPIRY` (par défaut 30 minutes). La génération de jetons est limitée en débit (5 req/s, burst 10) par utilisateur+mandant. La validation de jetons est limitée en débit (10 req/s, burst 20) par IP.

## En-têtes de sécurité

Le `SecurityHeadersMiddleware` (`internal/interfaces/http/middleware/security.go`) définit les en-têtes suivants :

| En-tête | Valeur |
|---|---|
| `Content-Security-Policy` | `default-src 'self'` ; émetteur OIDC dans `connect-src` |
| `Strict-Transport-Security` | `max-age=31536000` (uniquement HTTPS) |
| `X-Frame-Options` | `SAMEORIGIN` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `accelerometer=(), camera=(), geolocation=(), ...` |

La CSP autorise `style-src 'unsafe-inline'` (styles inline Angular) mais pas `script-src 'unsafe-inline'`. L'URL de l'émetteur OIDC est assainie avant son insertion dans la CSP (validation de schéma, rejet des métacaractères CSP).

## Limite de corps et rate-limiting

- **Limite de corps** — Global `SERVER_BODY_LIMIT` (par défaut 50M). Routes d'upload : `STORAGE_MAX_UPLOAD_SIZE` (par défaut 50M). Import de propriétaires : 10M. Enregistrement par signature : 5M.
- **Rate-Limiting** — `golang.org/x/time/rate` avec stockage en mémoire :
  - `/auth/config` : 10 req/s, burst 20 (par IP)
  - `/api/v1/me` : 10 req/s, burst 20 (par IP)
  - Routes super-admin : 0.5 req/s, burst 30 (par utilisateur)
  - Génération de jetons QR : 5 req/s, burst 10 (par utilisateur+mandant)
  - Export audit/paquet de preuve : 10 req/s, burst 20 (par utilisateur+mandant)
  - Formulaire de contact : 0.083 req/s, burst 2 (par IP)

## Application de APP_ENV

- `APP_ENV` doit être explicitement défini comme variable d'environnement — `config.Load()` renvoie `ErrAppEnvNotSet` en cas d'absence.
- En production, `.env` n'est **jamais** chargé — toute la configuration doit provenir de l'environnement du conteneur/processus.
- En non-production, `.env` est chargé pour des raisons de commodité ; les variables d'env explicites ont la priorité.
- Les attaques par homographe Unicode sur `APP_ENV` sont repoussées (contrôle `isASCII`).

## Immutabilité des votes

Les votes sont immuables (`vote.go`). En cas de modification, l'ancien vote est marqué comme `IsSuperseded=true` et un nouveau vote est créé. `IsActive()` renvoie `!IsSuperseded`. Le moteur de quorum et le calcul des résultats ne prennent en compte que les votes actifs.

## Preuve de non-falsification des signatures

Les signatures sont stockées dans une table distincte (`signatures`), non intégrées dans `Attendance`. Les triggers DB bloquent `UPDATE`, `DELETE` et `TRUNCATE`. Les données d'image de signature (`image_data`, `bytea`) sont ainsi auditées indépendamment et de manière infalsifiable.

## CORS

Le `CORSMiddleware` (`internal/interfaces/http/middleware/cors.go`) valide les origines par rapport à une liste configurée. Origines par défaut (`defaultCORSOrigins` dans `config.go`) :

- Production : `https://app.resivote.ch`, `https://resivote.ch`, `https://www.resivote.ch`
- Non-production : en plus `http://localhost:4200`, `http://localhost:8081`, `http://localhost:4321`

En cas de liste d'origines vide, les requêtes cross-origin sont rejetées en mode fail-closed. `AllowCredentials` est désactivé pour les origines wildcard.

## Références au droit suisse

Le code référence les bases juridiques suisses suivantes :

| Référence | Contexte |
|---|---|
| Art. 647b/d/e ZGB | Quorum à majorité qualifiée (voix par tête et de valeur) |
| Art. 647e ZGB | Quorum à l'unanimité (absences comme non implicite) |
| Art. 712g ZGB | Limitation du droit de vote, majorité qualifiée pour le STWEG |
| Art. 712m al. 2 ZGB | Résolution circulaire (Circular Resolution) |
| Art. 712o ZGB | Une unité, une voix par tête |
| ZertES | Chaîne de hachage d'audit avec HMAC-SHA-256 (preuve d'intégrité) |
| nDSG | Intégrité des données et protection contre la manipulation |

<LinkCard title="Configuration" description="Toutes les variables d'environnement et structures de configuration" href="/reference/konfiguration/" />
<LinkCard title="Enregistrement" description="Guide d'enregistrement QR-code et par signature" href="/guides/checkin/" />
<LinkCard title="Procès-verbal" description="Tenue du procès-verbal et piste d'audit" href="/guides/protokoll/" />
