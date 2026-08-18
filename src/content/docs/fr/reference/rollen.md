---
title: Rôles et autorisations
description: Documentation de référence des rôles ResiVote, du modèle d'autorisations, des gardes frontend et de l'impersonation.
---

import { Aside, LinkCard, Steps } from '@astrojs/starlight/components';

ResiVote distingue quatre rôles avec des autorisations graduées. Les rôles sont résolus via les claims JWT ZITADEL et la table `user_tenant_roles`. Les gardes frontend complètent le RBAC backend avec une protection de routage côté client.

## Rôles

Les rôles sont définis dans `internal/domain/entity/user.go` :

| Rôle | Portée | Description |
|---|---|---|
| `super_admin` | Global | Administration de la plateforme, gestion des mandants, facturation |
| `tenant_admin` | Par mandant | Gestion de toutes les ressources du mandant |
| `meeting_chair` | Par mandant | Direction de l'assemblée, enregistrement sur tablette, procès-verbal |
| `owner` | Par mandant | Propriétaire, vote, accès au portail |

## User vs. Owner

ResiVote sépare l'identité d'authentification de la propriété :

- **User** (table `users`) : identité d'authentification avec ZITADEL `sub`, e-mail et rôle. Un User peut être propriétaire, mais ce n'est pas obligatoire.
- **Owner** (table `owners`) : enregistrement de propriétaire avec parts de propriété. A une FK `UserID` optionnelle vers la table `users`. Les Owners hérités sans `UserID` sont liés via `ExternalUserID` (ZITADEL sub).

Un Owner peut appartenir à plusieurs mandants (via `ExternalUserID`), mais ne peut posséder des biens immobiliers que toujours au sein d'un même mandant.

## UserTenantRole — Source de vérité

La table `user_tenant_roles` est la source contraignante pour les attributions de mandants — **et non** les claims JWT. Un User peut avoir plusieurs entrées `UserTenantRole`, une par mandant.

<Aside type="warning" title="super_admin est global">
`super_admin` n'est pas stocké dans `user_tenant_roles`. Ce rôle reste un claim JWT global, vérifié par `claims.IsSuperAdmin()` dans `RequireSuperAdmin`. Le `TenantID` dans l'enregistrement `User` est nullable pour `super_admin`.
</Aside>

## Isolation par mandant

Le `TenantMiddleware` résout l'appartenance au mandant dans l'ordre suivant :

1. Claims JWT `TenantMemberships` (primaire — défini par le script d'action ZITADEL)
2. `TenantMembershipCache` (cache en processus via `user_tenant_roles`)
3. Table de jointure `user_tenant_roles` (repli DB en cas de cache-miss)
4. Table `users` `TenantID` unique (repli hérité)
5. Table `owners` (repli hérité pour les données antérieures à la table users)

Les super-administrateurs (non impersonnés) obtiennent un accès universel avec tous les rôles (`super_admin`, `tenant_admin`, `meeting_chair`, `owner`). La RLS PostgreSQL applique l'isolation par mandant supplémentairement au niveau de la base de données.

## Autorisations par rôle

Les autorisations sont définies par les appels `RequireRole` dans `router.go` et les gardes frontend dans `app.routes.ts`.

### super_admin

Gestion globale de la plateforme. Routes sous `/api/v1/tenants` et `/api/v1/admin/*` protégées par `RequireSuperAdmin`.

- Créer, lister, modifier, suspendre, activer, supprimer des mandants
- Obtenir les métriques d'un mandant
- Activer/désactiver les fonctionnalités portail et assemblée d'un mandant
- Gérer les utilisateurs (ZITADEL : créer, attribuer des rôles)
- Attributions multi-mandants d'utilisateurs (`/admin/users/:userId/tenant-assignments`)
- Santé de la plateforme et intégrité d'audit (`/admin/system/health`, `/admin/system/audit-integrity`)
- Métriques de facturation SaaS (`/admin/billing/tenants`)
- Démarrer une impersonation (`/admin/impersonate`)

Routes frontend : `/super-admin/*` avec `superAdminGuard`.

### tenant_admin

Gestion à l'échelle du mandant. Routes avec `RequireRole("tenant_admin")`.

- Créer/modifier/supprimer des communautés et des unités
- Gérer les liens de communautés (STWEG↔MEG)
- Gérer les Developments (ensembles immobiliers)
- Créer, importer (Excel), archiver, modifier des propriétaires
- Gérer les Ownership
- Créer des assemblées et piloter le cycle de vie complet (Publier, Ouvrir, Démarrer, Clôturer, Archiver)
- Créer et piloter les points de l'ordre du jour
- Effectuer l'enregistrement (manuel, QR-code, signature)
- Enregistrer des votes analogiques et des votes analogiques groupés
- Gérer la répartition des coûts et les décomptes de coûts
- Consulter et exporter les journaux d'audit (PDF/JSON)
- Télécharger et vérifier le paquet de preuve
- Gérer les documents et dossiers du portail
- Gérer le forum et les tickets
- Créer et envoyer des messages (diffusions)
- Consulter les factures

Routes frontend : `/admin/*` avec `roleGuard(['tenant_admin', 'super_admin'])`.

### meeting_chair

Direction de l'assemblée. Routes avec `RequireRole("meeting_chair")` ou `RequireRole("tenant_admin", "meeting_chair")`.

- Consulter les assemblées et effectuer les transitions de statut (Ouvrir, Démarrer, Clôturer)
- Piloter les points de l'ordre du jour (Présenter, Ouvrir, Clôturer, Sauter, Pre-Voting)
- Modifier les notes du procès-verbal et demander des suggestions IA
- Piloter le minuteur de présentation
- Effectuer l'enregistrement (manuel, QR-code, signature)
- Enregistrer des votes analogiques et des votes analogiques groupés
- Gérer les pièces jointes et les diapositives
- Télécharger et vérifier le paquet de preuve

Routes frontend : `/meeting/:id/chair` et `/meeting/:id/tablet-checkin` avec `chairGuard`.

### owner

Propriétaire avec accès au portail et droit de vote. Routes avec `RequireRole("owner")`.

- Consulter les assemblées et les points de l'ordre du jour (uniquement ses propres communautés)
- Voter (`CastVote`)
- Consulter son propre vote (`GetMyVote`)
- Self check-in (`SelfCheckIn`)
- Accorder et révoquer des procurations
- Télécharger les PDF d'invitation et de carte de procuration
- Télécharger le PDF du procès-verbal
- Consulter et télécharger les documents du portail
- Créer et répondre à des posts du forum
- Créer et répondre à des tickets
- Consulter les messages
- Gérer les notifications

Routes frontend : `/portal/*` avec `portalEnabledGuard` et `tenantSelectionGuard`.

## Gardes frontend

Les gardes de routeur Angular (`frontend/src/app/app.routes.ts`) protègent le routage côté client :

| Garde | Fonction |
|---|---|
| `authGuard` | Vérifie l'authentification OIDC |
| `chairGuard` | Vérifie le rôle `meeting_chair` |
| `superAdminGuard` | Vérifie le rôle `super_admin` |
| `superAdminRedirectGuard` | Redirige les super-admins vers le tableau de bord super-admin |
| `roleGuard(['tenant_admin', 'super_admin'])` | Vérifie des rôles spécifiques |
| `portalEnabledGuard` | Vérifie si le portail est activé pour le mandant |
| `portalRedirectGuard` | Redirige les propriétaires vers le portail |
| `tenantSelectionGuard` | Vérifie si un mandant a été sélectionné |
| `meetingRoleRedirectGuard` | Redirige vers la bonne vue d'assemblée selon le rôle |

## Middleware Community-Access

Le `CommunityAccessMiddleware` limite l'accès des propriétaires aux communautés, unités, assemblées et points de l'ordre du jour auxquels ils sont réellement associés. Le middleware charge les données d'Ownership du propriétaire et stocke les ensembles d'IDs de communauté et d'unité dans le contexte de la requête.

`tenant_admin` et `meeting_chair` sont exemptés — ils peuvent accéder à toutes les ressources de leur mandant.

Les titulaires de procuration (Proxy-Grantee) obtiennent l'accès aux assemblées dont ils représentent les communautés via une procuration active — même s'ils ne sont pas directement propriétaires dans la communauté.

## Impersonation

Un super-administrateur peut emprunter l'identité d'un autre utilisateur (Impersonation) via ZITADEL Token Exchange (RFC 8693). Le service `ImpersonationService` (`internal/application/impersonation_service.go`) échange le token super-admin contre un JWT qui contient un claim `act` avec l'identité du super-administrateur.

<Aside type="note" title="Mesures de sécurité">
- `RequireSuperAdmin` bloque les tokens impersonnés — aucune élévation de privilèges possible.
- `RequireSuperAdminOrImpersonated` n'autorise que l'endpoint de stop-impersonation pour les tokens impersonnés.
- Le `TenantMiddleware` applique pour les tokens impersonnés la résolution d'appartenance normale de l'utilisateur cible.
- L'`ImpersonatorSub` est stocké dans le contexte (`WithImpersonatorID`) et dans le journal d'audit (`ImpersonatedByID`).
</Aside>

## Cache d'appartenance au mandant

Le `TenantMembershipCache` (`internal/application/tenant_membership_cache.go`) évite les requêtes DB répétées dans le `TenantMiddleware` lorsque les claims JWT ne contiennent pas de `tenant_memberships` (cas de production — ZITADEL fournit uniquement l'authentification, l'appartenance au mandant est en DB).

| Configuration | Variable d'env | Par défaut |
|---|---|---|
| `Enabled` | `TENANT_CACHE_ENABLED` | `true` |
| `TTL` | `TENANT_CACHE_TTL` | 5 minutes |

Le cache est invalidé lors des changements de rôles, de la suspension de mandant et du demo-reset.

<LinkCard title="Gérer les utilisateurs" description="Guide de gestion des utilisateurs et d'attribution des rôles" href="/guides/benutzer/" />
<LinkCard title="Sécurité et conformité" description="Authentification, RLS, chiffrement et audit" href="/reference/sicherheit/" />
