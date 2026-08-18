---
title: REST API
description: Référence de l'API REST de ResiVote – groupes de routes, endpoints, authentification, middlewares et codes d'erreur.
---

import { Tabs, TabItem, Aside, LinkCard } from '@astrojs/starlight/components';

ResiVote fournit une API REST sous le chemin de base `/api/v1`. Le routeur HTTP est basé sur le framework Echo et est défini dans `internal/interfaces/http/router.go`. Une spécification OpenAPI 3.0 est générée automatiquement.

## Chemin de base et spécification OpenAPI

Tous les endpoints API se trouvent sous `/api/v1`. La spécification OpenAPI (`openapi.json`) est générée par `cmd/openapi-gen` à partir des routes Echo.

```sh
task generate-openapi   # génère openapi.json
task generate-client    # génère le client API Angular à partir d'openapi.json
```

Le client Angular est généré dans le frontend avec `npm run generate:api` (la tâche `generate-client` couvre les deux étapes).

## Authentification

L'API utilise des jetons JWT Bearer via ZITADEL OIDC. L'`AuthMiddleware` valide chaque requête contre les JWKS ZITADEL (`{BaseURL}/oauth/v2/keys`) et vérifie l'émetteur et l'audience.

- **Type de jeton :** ZITADEL OIDC Access-Token (Bearer)
- **Validation de l'émetteur :** `iss` doit correspondre à `ZITADEL_EXPECTED_ISSUER` (par défaut : `ZITADEL_BASE_URL`)
- **Validation d'audience :** `aud` doit contenir `ZITADEL_EXPECTED_AUDIENCE` (par défaut : `ZITADEL_PROJECT_ID`)
- **Contournement en dev :** Dans les builds non-production, un contournement de validation de signature existe, qui est compilé hors du build de production (`-tags production`)

Plus de détails sur l'authentification et ZITADEL voir [Sécurité](../reference/sicherheit/) et [Architecture](../reference/architektur/).

## En-tête de mandant

Les endpoints tenant-scoped requièrent l'en-tête `X-Tenant-ID` (UUID) ou un slug de mandant dans le chemin. Le `TenantMiddleware` résout l'appartenance au mandant de l'utilisateur et écrit l'ID du mandant dans le contexte de la requête.

## Middlewares

Les middlewares sont appliqués dans l'ordre suivant :

| Middleware | Objectif |
|---|---|
| `Recover` | Récupération des panics |
| `SecurityHeadersMiddleware` | CSP, HSTS, X-Frame-Options |
| `BodyLimit` | Limite du corps de requête (par défaut `50M`) |
| `CORSMiddleware` | Configuration CORS (`CORS_ORIGINS`) |
| `AuditMiddleware` | Journalisation d'audit |
| `AuthMiddleware` | Validation JWT (ZITADEL OIDC) |
| `TenantMiddleware` | Résolution du mandant et vérification d'appartenance |
| `DBTransactionMiddleware` | Transaction par requête avec `SET LOCAL app.current_tenant_id` (PostgreSQL RLS) |
| `CommunityAccessMiddleware` | Accès du propriétaire à ses propres communautés/unités ; `tenant_admin` et `meeting_chair` sont exemptés |
| `MeetingEnabledMiddleware` | Bloque les endpoints d'assemblée en direct si `meeting_enabled=false` |
| `PortalEnabledMiddleware` | Bloque les endpoints du portail si `portal_enabled=false` |
| `CustomErrorHandler` | Gestion centralisée des erreurs avec codes `AppError` |

## Groupes de routes

### Endpoints publics

Les endpoints publics ne nécessitent pas d'authentification.

| Méthode | Chemin | Description |
|---|---|---|
| `GET` | `/health` | Health-check (`{"status":"UP"}`) |
| `GET` | `/auth/config` | Configuration OIDC (émetteur, client-ID, URI post-logout) ; limité en débit (10 req/s, burst 20) |
| `GET` | `/api/v1/checkin/:token/validate` | Validation de jeton d'enregistrement (JWT) ; limité en débit (10 req/s, burst 20) |
| `POST` | `/api/v1/public/contact` | Formulaire de contact ; limité en débit (5 req/min) |
| `GET/HEAD` | `/api/v1/attachments/:id/slides/images/:imageName` | Flux d'images de diapositive public pour les balises `<img>` |
| `POST` | `/internal/demo-reset` | Demo-reset (protégé par clé API, uniquement si `DEMO_RESET_ENABLED`) |

### Routes Me (`/api/v1/me`)

Endpoints authentifiés sans portée de mandant.

| Méthode | Chemin | Description |
|---|---|---|
| `GET` | `/api/v1/me` | Utilisateur actuel : rôles et appartenances au mandant ; limité en débit (10 req/s, burst 20) |
| `POST` | `/api/v1/invitations/redeem` | Échanger une invitation |

### Routes Admin (`/api/v1/admin`, `/api/v1/tenants`)

Endpoints super-admin avec middleware `RequireSuperAdmin` et rate-limiting (30 req/min).

| Méthode | Chemin | Description |
|---|---|---|
| `GET/POST` | `/api/v1/tenants` | Lister/créer des mandants |
| `GET/PUT/DELETE` | `/api/v1/tenants/:id` | Gestion des mandants |
| `PATCH` | `/api/v1/tenants/:id/billing` | Mettre à jour les infos de facturation |
| `PATCH` | `/api/v1/tenants/:id/portal` | Activer/désactiver le portail |
| `PATCH` | `/api/v1/tenants/:id/meeting` | Activer/désactiver la fonctionnalité d'assemblée |
| `PATCH` | `/api/v1/tenants/:id/suspend` | Suspendre le mandant |
| `PATCH` | `/api/v1/tenants/:id/activate` | Activer le mandant |
| `GET` | `/api/v1/tenants/:id/metrics` | Métriques du mandant |
| `POST` | `/api/v1/tenants/suggest-slug` | Suggestion de slug |
| `GET` | `/api/v1/tenants/check-slug` | Vérifier la disponibilité d'un slug |
| `GET/POST` | `/api/v1/tenants/:id/users` | Lister/créer des utilisateurs du mandant |
| `DELETE` | `/api/v1/tenants/:id/users/:email` | Supprimer un utilisateur du mandant |
| `GET` | `/api/v1/admin/system/health` | Santé du système |
| `GET` | `/api/v1/admin/system/audit-integrity` | Intégrité de la chaîne d'audit |
| `GET` | `/api/v1/admin/system/config` | Configuration en cours |
| `GET/POST` | `/api/v1/admin/users` | Lister/créer des utilisateurs ZITADEL |
| `POST` | `/api/v1/admin/users/roles` | Attribuer des rôles |
| `POST` | `/api/v1/admin/users/:userId/tenant-assignments` | Créer une attribution de mandant |
| `DELETE` | `/api/v1/admin/users/:userId/tenant-assignments/:tenantId` | Supprimer une attribution de mandant |
| `POST` | `/api/v1/admin/impersonate` | Démarrer une impersonation (Token Exchange RFC 8693) |
| `POST` | `/api/v1/admin/impersonate/stop` | Arrêter une impersonation |
| `GET` | `/api/v1/admin/billing/tenants` | Mandants de facturation SaaS |
| `GET` | `/api/v1/admin/billing/tenants/:id` | Détails d'un mandant de facturation SaaS |

### Endpoints tenant-scoped (`/api/v1/...`)

Ces endpoints requièrent `X-Tenant-ID`, l'application de RLS et des vérifications d'accès communauté.

<Tabs>
<TabItem label="Communautés et unités">

| Méthode | Chemin | Rôles |
|---|---|---|
| `POST` | `/communities` | `tenant_admin` |
| `GET` | `/communities` | `tenant_admin`, `meeting_chair`, `owner` |
| `GET/PUT/DELETE` | `/communities/:id` | voir routeur |
| `POST/DELETE` | `/communities/:id/megs/:megId` | `tenant_admin` (lien MEG) |
| `GET` | `/communities/:id/megs` | Liens MEG |
| `GET` | `/communities/:id/stwegs` | Liens STWEG |
| `GET/POST` | `/developments` | Ensembles immobiliers |
| `GET` | `/developments/tree` | Arbre de développement |
| `POST` | `/communities/:communityId/units` | Créer une unité |
| `POST` | `/communities/reglement-extract` | Extraire un règlement (limite corps 50M) |
| `POST` | `/communities/reglement-confirm` | Confirmer un règlement |
| `GET` | `/communities/:communityId/units` | Lister les unités |
| `GET/PUT/DELETE` | `/units/:id` | Gestion des unités |

</TabItem>
<TabItem label="Répartition des coûts">

| Méthode | Chemin | Description |
|---|---|---|
| `GET/POST` | `/communities/:communityId/cost-distribution-keys` | Clés de répartition (MEG) |
| `GET/PUT/DELETE` | `/communities/:communityId/cost-distribution-keys/:keyId` | Clé individuelle |
| `GET/POST` | `/communities/:communityId/cost-statements` | Décomptes de coûts |
| `GET/DELETE` | `/communities/:communityId/cost-statements/:stmtId` | Décompte individuel |
| `GET` | `/cost-statements/:id/pdf` | Décompte de coûts en PDF |
| `GET` | `/cost-statements/:id/csv` | Décompte de coûts en CSV |

</TabItem>
<TabItem label="Propriétaires et parts de propriété">

| Méthode | Chemin | Description |
|---|---|---|
| `POST` | `/owners` | Créer un propriétaire |
| `POST` | `/owners/import` | Import CSV (limite corps 10M) |
| `GET` | `/owners` | Lister les propriétaires |
| `GET/PUT/DELETE` | `/owners/:id` | Gestion des propriétaires |
| `POST` | `/owners/:id/archive` | Archiver un propriétaire |
| `GET` | `/owners/:ownerId/ownerships` | Parts de propriété d'un propriétaire |
| `GET` | `/profile` | Profil personnel |
| `POST/GET/PUT/DELETE` | `/ownerships` | Gérer les parts de propriété |
| `GET` | `/units/:unitId/ownerships` | Parts de propriété d'une unité |

</TabItem>
<TabItem label="Assemblées">

| Méthode | Chemin | Description |
|---|---|---|
| `POST/GET` | `/meetings` | Créer/lister des assemblées |
| `GET/PUT/DELETE` | `/meetings/:id` | Gestion des assemblées |
| `GET` | `/meetings/:id/presence` | Vue d'ensemble de la présence |
| `GET` | `/meetings/:id/mentions` | Participants mentionnables |
| `GET` | `/meetings/:id/quorum` | Quorum en direct |
| `PATCH` | `/meetings/:id/protocol-writer` | Définir le rédacteur du procès-verbal |
| `POST` | `/meetings/:id/publish` | Publier l'assemblée |
| `POST` | `/meetings/:id/open` | Ouvrir l'assemblée (enregistrement) |
| `POST` | `/meetings/:id/start` | Démarrer l'assemblée |
| `POST` | `/meetings/:id/close` | Clôturer l'assemblée |
| `POST` | `/meetings/:id/archive` | Archiver l'assemblée |
| `GET` | `/meetings/:id/email-queue-status` | Statut de la file d'attente des e-mails |
| `POST/DELETE/GET` | `/meetings/:id/communities` | Lien multi-communautés |
| `GET` | `/meetings/:meetingId/eligible-grantees` | Destinataires de procuration autorisés |
| `GET` | `/meetings/:meetingId/eligible-units` | Unités autorisées |

</TabItem>
<TabItem label="Points de l'ordre du jour">

| Méthode | Chemin | Description |
|---|---|---|
| `POST/GET` | `/meetings/:meetingId/agenda-items` | Créer/lister des points de l'ordre du jour |
| `GET/PUT/DELETE` | `/agenda-items/:id` | Gestion des points de l'ordre du jour |
| `POST` | `/agenda-items/:id/present` | Démarrer la présentation |
| `POST` | `/agenda-items/:id/open` | Ouvrir le vote |
| `POST` | `/agenda-items/:id/close` | Clôturer le vote |
| `POST` | `/agenda-items/:id/skip` | Sauter le point de l'ordre du jour |
| `POST` | `/agenda-items/:id/start-pre-voting` | Démarrer le Pre-Voting |
| `POST` | `/agenda-items/:id/cancel-pre-voting` | Annuler le Pre-Voting |
| `PATCH` | `/agenda-items/:id/notes` | Mettre à jour les notes |
| `POST` | `/agenda-items/:id/ai-suggest` | Suggestion de procès-verbal par IA |
| `POST` | `/agenda-items/:id/timer/start` | Démarrer le minuteur |
| `POST` | `/agenda-items/:id/timer/stop` | Arrêter le minuteur |
| `GET` | `/agenda-items/:id/timer` | Statut du minuteur |
| `GET` | `/agenda-items/:id/quorum-snapshot` | Instantané du quorum |

</TabItem>
<TabItem label="Pièces jointes et diapositives">

| Méthode | Chemin | Description |
|---|---|---|
| `POST` | `/agenda-items/:id/attachments` | Télécharger une pièce jointe |
| `POST` | `/agenda-items/:id/slides` | Créer une pièce jointe de diapositives |
| `GET` | `/agenda-items/:id/attachments` | Lister les pièces jointes |
| `DELETE` | `/attachments/:id` | Supprimer une pièce jointe |
| `GET` | `/attachments/:id/download` | Télécharger une pièce jointe |
| `POST/PUT/DELETE` | `/attachments/:id/slides` | Gestion des diapositives |
| `POST` | `/attachments/:id/slides/current` | Définir la diapositive actuelle |
| `POST` | `/attachments/:id/slides/images` | Télécharger une image de diapositive |
| `POST/GET/DELETE` | `/meetings/:id/attachments` | Pièces jointes d'assemblée |

</TabItem>
<TabItem label="Votes et enregistrement">

| Méthode | Chemin | Description |
|---|---|---|
| `POST` | `/agenda-items/:agendaItemId/votes` | Émettre un vote (`owner`) |
| `POST` | `/agenda-items/:agendaItemId/analog-votes` | Vote analogique (`tenant_admin`, `meeting_chair`) |
| `POST` | `/agenda-items/:agendaItemId/bulk-analog-votes` | Votes analogiques groupés |
| `GET` | `/agenda-items/:agendaItemId/votes` | Lister les votes |
| `GET` | `/agenda-items/:agendaItemId/my-vote` | Vote personnel |
| `GET` | `/agenda-items/:id/result` | Résultat du vote |
| `GET` | `/agenda-items/:id/eligible-units` | Unités analogiques autorisées |
| `POST` | `/meetings/:meetingId/check-in` | Enregistrement (admin) |
| `POST` | `/meetings/:meetingId/check-in/self` | Self check-in (`owner`) |
| `GET` | `/meetings/:meetingId/checkin-qr` | Générer un jeton QR (limité en débit) |
| `GET` | `/meetings/:meetingId/attendances` | Liste des présences |
| `GET` | `/meetings/:meetingId/my-attendance` | Présence personnelle |
| `POST` | `/meetings/:meetingId/signature-checkin` | Enregistrement par signature (limite corps 5M) |
| `GET` | `/meetings/:meetingId/signatures` | Lister les signatures |
| `GET` | `/meetings/:meetingId/owners/:ownerId/checkin-preview` | Aperçu de l'enregistrement |

</TabItem>
<TabItem label="Procurations">

| Méthode | Chemin | Description |
|---|---|---|
| `POST` | `/meetings/:meetingId/proxies` | Créer une procuration |
| `GET` | `/meetings/:meetingId/proxies` | Lister les procurations |
| `DELETE` | `/proxies/:id` | Révoquer une procuration |

</TabItem>
<TabItem label="Rapports et paquet de preuve">

| Méthode | Chemin | Description |
|---|---|---|
| `GET` | `/meetings/:id/protocol/pdf` | Procès-verbal en PDF |
| `GET` | `/meetings/:id/invitation/pdf` | Invitation en PDF |
| `GET` | `/meetings/:id/proxy-card/pdf` | Carte de procuration en PDF |
| `GET` | `/meetings/:id/evidence-package/verify` | Vérifier l'intégrité du paquet de preuve |
| `GET` | `/meetings/:id/evidence-package/pdf` | Paquet de preuve en PDF |
| `GET` | `/meetings/:id/evidence-package/json` | Paquet de preuve en JSON |

</TabItem>
<TabItem label="Journaux d'audit">

| Méthode | Chemin | Description |
|---|---|---|
| `GET` | `/audit-logs` | Lister les journaux d'audit (limité en débit) |
| `GET` | `/audit-logs/verify` | Vérifier l'intégrité de la chaîne |
| `GET` | `/audit-logs/export/pdf` | Journal d'audit en PDF |
| `GET` | `/audit-logs/export/json` | Journal d'audit en JSON |

</TabItem>
<TabItem label="Messages (diffusion)">

| Méthode | Chemin | Description |
|---|---|---|
| `POST/GET` | `/messages` | Créer/lister des messages |
| `GET` | `/messages/recipient-count` | Aperçu des destinataires |
| `GET/PATCH/DELETE` | `/messages/:id` | Gestion des messages |
| `POST` | `/messages/:id/send` | Envoyer un message |

</TabItem>
<TabItem label="Facturation">

| Méthode | Chemin | Description |
|---|---|---|
| `POST` | `/billing/run` | Créer une facture (`super_admin`) |
| `GET` | `/billing/invoices` | Lister les factures |
| `GET` | `/billing/invoices/:id` | Facture individuelle |
| `GET` | `/billing/invoices/:id/pdf` | Facture en PDF |

</TabItem>
<TabItem label="Recherche">

| Méthode | Chemin | Description |
|---|---|---|
| `GET` | `/search` | Recherche globale (avec ou sans contexte de mandant) |

</TabItem>
</Tabs>

### Routes alias d'assemblée (`/api/v1/t/:tenantId/m/:meetingSlug`)

Liens partageables avec slug de mandant et slug d'assemblée. Le `TenantMiddleware` résout le slug depuis le paramètre de chemin `:tenantId`.

| Méthode | Chemin | Rôles |
|---|---|---|
| `GET` | `/api/v1/t/:tenantId/m/:meetingSlug` | `tenant_admin`, `meeting_chair`, `owner` |

Ce groupe utilise en plus `MeetingEnabledMiddleware`.

### Endpoints du portail (`/api/v1/portal/...`)

Les endpoints du portail client requièrent `portal_enabled=true` et un rate-limit d'écriture du portail (1 requête / 6 s, burst 20).

<Tabs>
<TabItem label="Dossiers et documents">

| Méthode | Chemin | Description |
|---|---|---|
| `GET` | `/portal/communities/:community_id/folders` | Arbre des dossiers |
| `POST/GET/PUT/DELETE` | `/portal/folders` | Gestion des dossiers |
| `GET/POST` | `/portal/documents` | Lister/télécharger des documents |
| `GET/PUT/DELETE` | `/portal/documents/:id` | Gestion des documents |
| `GET` | `/portal/documents/:id/download` | Télécharger un document |

</TabItem>
<TabItem label="Forum et tickets">

| Méthode | Chemin | Description |
|---|---|---|
| `GET/POST` | `/portal/forum/posts` | Sujets du forum |
| `GET` | `/portal/forum/posts/:id` | Sujet individuel |
| `POST` | `/portal/forum/posts/:id/replies` | Créer une réponse |
| `DELETE` | `/portal/forum/posts/:id` | Supprimer un post |
| `GET/POST` | `/portal/tickets` | Lister/créer des tickets |
| `GET` | `/portal/tickets/:id` | Ticket individuel |
| `POST` | `/portal/tickets/:id/messages` | Message de ticket |
| `PATCH` | `/portal/tickets/:id/status` | Statut du ticket |
| `DELETE` | `/portal/tickets/:id` | Supprimer un ticket |
| `GET` | `/portal/tickets/:id/attachments/:attachmentId` | Pièce jointe de ticket |

</TabItem>
<TabItem label="Notifications et messages">

| Méthode | Chemin | Description |
|---|---|---|
| `GET` | `/portal/notifications` | Lister les notifications |
| `POST` | `/portal/notifications/:id/read` | Marquer comme lu |
| `POST` | `/portal/notifications/read-all` | Tout marquer comme lu |
| `GET` | `/portal/notifications/unread-count` | Nombre non lus |
| `GET/PATCH` | `/portal/notifications/settings` | Paramètres de notification |
| `GET` | `/portal/notifications/vapid-public-key` | Clé publique VAPID |
| `POST/DELETE` | `/portal/notifications/push/subscribe` | Abonnement push |
| `GET` | `/portal/messages` | Boîte de réception des messages |
| `POST` | `/portal/messages/:id/read` | Message lu |
| `POST` | `/portal/messages/:id/archive` | Archiver un message |

</TabItem>
</Tabs>

### WebSocket (`/ws/meetings/:meetingId`)

Endpoint WebSocket pour les mises à jour en direct. L'authentification et les vérifications d'accès tenant/communauté sont appliquées lors du handshake d'upgrade.

| Méthode | Chemin | Description |
|---|---|---|
| `GET` | `/ws/meetings/:meetingId` | Upgrade WebSocket |

<Aside type="note" title="Configuration WebSocket">
  Cycle Ping/Pong : `WS_PONG_WAIT` (60s), `WS_PING_PERIOD` (54s), `WS_WRITE_WAIT` (10s). Tailles des buffers : `WS_READ_BUFFER_SIZE` (1024), `WS_WRITE_BUFFER_SIZE` (1024). Taille max. des messages : `WS_MAX_MESSAGE_SIZE` (4096). En production, les origines du navigateur sont vérifiées contre `CORS_ORIGINS` ; en développement, toutes les origines sont autorisées.
</Aside>

Les messages WebSocket transmettent le statut de l'assemblée en direct, la progression des votes et les mises à jour du quorum.

### Fichiers statiques

Les assets du frontend Angular sont intégrés via `embed.FS` et servis via les fichiers statiques d'Echo (`dist/browser`). Les chemins non trouvés retombent sur `index.html` (routage SPA, HTML5 History API).

## Gestion des erreurs

Le `CustomErrorHandler` transforme les instances `AppError` en réponses JSON structurées. Chaque erreur contient un `code` lisible par machine et un `message`.

| Code | Statut HTTP | Description |
|---|---|---|
| `NOT_FOUND` | 404 | Ressource non trouvée |
| `CONFLICT` | 409 | Conflit (p. ex. transition d'état) |
| `VALIDATION_ERROR` | 400 / 422 | Erreur de validation |
| `UNAUTHORIZED` | 401 | Non authentifié |
| `FORBIDDEN` | 403 | Pas d'autorisation |
| `TENANT_MISMATCH` | 403 | Accès inter-mandants |
| `INVALID_STATE_TRANSITION` | 409 | Transition d'état invalide |
| `QUORUM_NOT_MET` | 409 | Assemblée incapable de résoudre |
| `VOTE_NOT_ALLOWED` | 403 | Vote non autorisé |
| `PROXY_INSTRUCTION_VIOLATION` | 409 | Instruction de procuration violée |
| `ALREADY_VOTED` | 409 | Déjà voté |
| `NOT_CHECKED_IN` | 403 | Non enregistré |
| `MEETING_NOT_OPEN` | 403 | Assemblée non ouverte |
| `AGENDA_ITEM_NOT_OPEN` | 403 | Point de l'ordre du jour non ouvert |
| `USER_NOT_LINKED` | 403 | Utilisateur non lié |
| `INTERNAL_ERROR` | 500 / 503 | Erreur interne |

<LinkCard title="Architecture" href="../reference/architektur/" description="Vue d'ensemble des couches et composants." />
<LinkCard title="Sécurité" href="../reference/sicherheit/" description="Authentification, RLS, journal d'audit et chiffrement." />
