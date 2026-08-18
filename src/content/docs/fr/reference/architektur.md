---
title: Architecture
description: Documentation de référence des couches Clean Architecture de ResiVote, de la stack technologique et du flux de requêtes.
---

import { FileTree, Aside, Steps, LinkCard } from '@astrojs/starlight/components';

ResiVote suit une structure Clean Architecture avec quatre couches : **Domain**, **Application**, **Infrastructure** et **Interfaces**. Chaque couche ne dépend que vers l'intérieur — la couche Domain ne connaît aucune dépendance externe.

## Structure des répertoires

<FileTree>
- `internal/`
  - `domain/`
    - `entity/` — 31 définitions d'entités (modèle de données, aucune logique métier)
    - `repository/` — Interfaces de repository (`repositories.go`, ports pour l'accès aux données)
    - `service/` — Services de domaine (`state_machine`, `quorum_engine`, `live_quorum`, `vote_validator`, `cost_calculator`)
  - `application/` — Implémentations de services et interfaces de cas d'usage (`services.go`, conteneur DI)
  - `infrastructure/`
    - `persistence/` — Repositories GORM, connexion DB, Tenant-Scoped-DB, migrations
    - `auth/` — Validation ZITADEL OIDC, client admin, Dev-Bootstrap
    - `encryption/` — DEK par mandant, chiffrement de documents (AES-GCM, HKDF-SHA256)
    - `ai/` — Providers LLM (Mistral, Ollama, llama.cpp, Mock, Disabled)
    - `conversion/` — Conversion document-vers-PDF via LibreOffice
    - `email/` — Expéditeurs d'e-mails Resend et Log
    - `notification/` — Expéditeur Web Push (webpush-go, VAPID)
    - `pdf/` — Extraction de texte PDF
    - `storage/` — Stockage Blob (système de fichiers local ou S3/MinIO)
    - `websocket/` — Hub WebSocket et client (`gorilla/websocket`)
  - `interfaces/`
    - `http/`
      - `handler/` — Handlers HTTP par ressource
      - `middleware/` — Auth, Tenant, transaction DB, RBAC, en-têtes de sécurité, accès communauté, CORS, portail
      - `dto/` — DTOs de requête/réponse
      - `router.go` — Routeur Echo avec tous les groupes de routes et chaînes de middleware
- `cmd/`
  - `server/main.go` — Câblage DI et bootstrap du serveur
  - `openapi-gen/main.go` — Génération du schéma OpenAPI
- `frontend/` — Frontend Angular (intégré via `embed.go`)
- `migrations/` — 43 migrations SQL (golang-migrate)
</FileTree>

## Stack technologique

| Composant | Technologie | Version |
|---|---|---|
| Langage | Go | 1.26.3 |
| Framework HTTP | Echo | v4.15.4 |
| ORM | GORM (postgres + sqlite) | v1.31.2 |
| Pilote PostgreSQL | pgx/v5 | v5.6.0 |
| OIDC / Auth | ZITADEL (zitadel-go) | v3.29.1 |
| WebSocket | gorilla/websocket | v1.5.3 |
| Web Push | webpush-go | v1.4.0 |
| S3/MinIO | minio-go | v7.2.1 |
| Génération PDF | gofpdf | v1.16.2 |
| Nettoyage HTML | bluemonday | v1.0.27 |
| Import Excel | excelize/v2 | v2.11.0 |
| Configuration Env | godotenv | v1.5.1 |
| Rate-Limiting | golang.org/x/time | v0.15.0 |

### Frontend

Le frontend Angular se trouve dans le répertoire `frontend/` et est intégré dans le binaire Go via `frontend/embed.go` avec `//go:embed all:dist/browser`. Le frontend utilise Angular Material et les composants Angular-Spartan. L'authentification s'effectue via OIDC contre ZITADEL.

## Injection de dépendances

Le câblage DI s'effectue centralement dans `cmd/server/main.go`. Le déroulement :

<Steps>
1. **Charger la configuration** — `config.Load()` lit les variables d'environnement ; `config.Validate()` impose les clés critiques en production.
2. **Connecter la base de données** — `persistence.NewDB()` ouvre la connexion PostgreSQL (GORM).
3. **Bootstrap ZITADEL** — `auth.EnsureDevZITADELSetup()` crée idempotemment le projet, le client OIDC et les utilisateurs dans les environnements de dev.
4. **Instancier les services de domaine** — `StateMachine`, `QuorumEngine`, `LiveQuorumEngine`, `VoteValidator`, `CostCalculator`.
5. **Créer les repositories** — Tous les repositories GORM sont créés avec l'instance DB.
6. **Câbler les services d'application** — Chaque service reçoit ses repositories et services de domaine par injection de constructeur.
7. **Créer les handlers** — Chaque handler reçoit ses services d'application.
8. **Configurer le routeur** — `appHttp.NewRouter()` connecte les middlewares, les groupes de routes et les handlers.
</Steps>

Les interfaces de service sont définies dans `internal/application/services.go` (p. ex. `TenantService`, `MeetingService`, `VoteService`, `OwnerService`). Les implémentations concrètes vivent dans le même package.

## Flux de requêtes

Une requête API typique traverse la chaîne de middlewares suivante :

<Steps>
1. **Recover** — Récupération des panics (`middleware.Recover`)
2. **SecurityHeaders** — CSP, HSTS, X-Frame-Options, X-Content-Type-Options (`SecurityHeadersMiddleware`)
3. **BodyLimit** — Limite du corps de requête, par défaut 50M (`middleware.BodyLimit`)
4. **CORS** — Validation des origines avec les origines configurées (`CORSMiddleware`)
5. **Audit** — Journalisation d'audit pour les actions significatives (`AuditMiddleware`)
6. **Auth** — Validation JWT contre les JWKS ZITADEL (`AuthMiddleware`)
7. **Tenant** — Résolution du mandant depuis l'en-tête/chemin/requête, vérification d'appartenance (`TenantMiddleware`)
8. **DBTransaction** — Transaction par requête avec `SET LOCAL app.current_tenant_id` pour RLS (`DBTransactionMiddleware`)
9. **CommunityAccess** — Accès du propriétaire limité à ses propres communautés/unités (`CommunityAccessMiddleware`)
10. **Handler → Service → Repository** — La requête est traitée
</Steps>

Les routes super-admin (`/api/v1/tenants`, `/api/v1/admin/*`) contournent TenantMiddleware et CommunityAccessMiddleware, mais utilisent `RequireSuperAdmin` et `DBTransactionMiddleware`.

Le middleware de feature-gate contrôle les modules optionnels :

- `MeetingEnabledMiddleware` — vérifie `tenant.meeting_enabled` pour toutes les routes d'assemblée numérique
- `PortalEnabledMiddleware` — vérifie `tenant.portal_enabled` pour toutes les routes du portail client

## Mises à jour en direct via WebSocket

Les connexions WebSocket sont gérées via `gorilla/websocket`. La structure `Hub` (`internal/infrastructure/websocket/hub.go`) gère les clients connectés et diffuse les messages. Le `WebSocketHandler` s'enregistre sous `/ws/meetings/:meetingId` et utilise une authentification par jeton via paramètre de requête.

Les mises à jour en direct concernent :

- Le quorum en direct et la présence pendant une assemblée
- Les résultats des votes en temps réel
- Les changements de diapositive de présentation et le statut du minuteur
- Les modifications du procès-verbal

## Workers d'arrière-plan

Quatre workers d'arrière-plan s'exécutent en tant que goroutines avec un contexte annulable :

| Worker | Configuration | Fonction |
|---|---|---|
| Vérification d'audit | `AUDIT_VERIFY_INTERVAL` (par défaut 5m) | Vérification périodique de l'intégrité de la chaîne de hachage |
| E-mail planifié | `EMAIL_PROCESS_INTERVAL` (par défaut 1m) | Envoie les e-mails planifiés échus |
| Facturation | `BILLING_WORKER_INTERVAL` (par défaut 1h) | Crée les factures mensuelles par mandant |
| Demo-Reset | Quotidiennement à 00:00 UTC + offset | Fait tourner le mandant démo et re-seed les données d'exemple |

De plus, le flux de démarrage vérifie l'intégrité de la chaîne d'audit et les triggers d'application de l'immutabilité. Si `FailClosed=true` et qu'une manipulation est détectée, le serveur refuse de démarrer (`os.Exit(1)`).

## Génération OpenAPI

Le répertoire `cmd/openapi-gen/` contient un programme Go autonome qui génère le schéma OpenAPI à partir des annotations des handlers et des structures DTO. Le résultat est un `openapi.json` qui contient la spécification API complète.

<Aside type="note" title="Pages connexes">
- [Référence API](/reference/api/) — Documentation des endpoints
- [Sécurité et conformité](/reference/sicherheit/) — Auth, RLS, chiffrement, audit
- [Configuration](/reference/konfiguration/) — Variables d'environnement et structure de configuration
</Aside>
