---
title: Utilisateurs et autorisations
description: Rôles, isolation par mandant, gestion des propriétaires et impersonation dans ResiVote.
---

import { Aside, CardGrid, Card, LinkCard } from '@astrojs/starlight/components';

ResiVote sépare l'identité d'authentification (`User`) de l'identité de propriétaire (`Owner`). Les rôles sont stockés par mandant dans la base de données, et non dérivés des claims JWT. Toutes les données sont isolées par mandant.

## User vs Owner

ResiVote découple volontairement l'identité de connexion de la propriété :

- **`User`** (`internal/domain/entity/user.go`) – l'identité d'authentification. Contient le `sub` ZITADEL (`ExternalUserID`), l'e-mail, le nom et un rôle. `TenantID` est nullable (`nil` pour `super_admin`).
- **`Owner`** (`internal/domain/entity/owner.go`) – l'identité de propriété. Contient le nom, l'e-mail, le téléphone et une clé étrangère `UserID` optionnelle vers la table `users`. Un Owner peut posséder des unités dans plusieurs communautés d'un même mandant.

La liaison s'effectue lors de la première connexion : `LinkAllExternalUsersByEmail` associe le `sub` ZITADEL à tous les enregistrements User de même e-mail qui n'ont pas encore d'`ExternalUserID`.

### Propriétés d'Owner

| Champ | Signification |
|------|---------------|
| `ExternalUserID` | Identité globale (inter-mandants) |
| `UserID` | FK optionnelle vers `users` (nullable pour les données héritées) |
| `IsArchived` / `ArchivedAt` | Propriétaire marqué comme archivé |
| `TenantID` | Mandant – les propriétaires ne peuvent posséder des unités qu'au sein d'un même mandant |

## Rôles

ResiVote connaît quatre rôles (`internal/domain/entity/user.go`) :

### tenant_admin

L'administrateur de mandant prépare les assemblées, invite les participants, gère les communautés et les unités, et tient le procès-verbal. Il ne voit que les données de son propre mandant (`TenantID` défini).

### super_admin

Le super-administrateur est global (`TenantID = nil`). Il gère les mandants, a accès aux routes super-admin et peut emprunter l'identité d'autres utilisateurs. Le rôle `super_admin` n'est **pas** stocké dans `UserTenantRole`, il reste un claim JWT global.

### meeting_chair

Le président dirige l'assemblée via le tableau de bord du président : il ouvre et ferme les points de l'ordre du jour, lance les votes, accorde des overrides de quorum et contrôle la visibilité des résultats en direct. Une garde frontend (`chair guard`) protège les fonctions du président.

### owner

Le propriétaire participe aux assemblées, vote et consulte ses documents dans le portail. Le rôle de propriétaire est le rôle par défaut pour les personnes ayant droit de vote.

## UserTenantRole

`UserTenantRole` (`internal/domain/entity/user_tenant_role.go`) est la **source de vérité** pour les associations de mandants – et non les claims JWT. Un utilisateur peut avoir plusieurs entrées, une par mandant.

<Aside type="warning" title="super_admin non stocké ici">
Le rôle `super_admin` n'est volontairement pas stocké dans `UserTenantRole`. Il reste un claim JWT global, car les super-administrateurs opèrent de manière inter-mandants.
</Aside>

Rôles autorisés dans `UserTenantRole` : `tenant_admin`, `meeting_chair`, `owner`.

## Isolation par mandant

ResiVote est multi-mandants. Chaque entité porte un champ `TenantID` :

- `Owner.TenantID` – les propriétaires sont liés à un mandant.
- `Document.TenantID` – les documents sont isolés par mandant.
- `Folder.TenantID` – les dossiers sont isolés par mandant.
- `Meeting.TenantID` – les assemblées appartiennent à un mandant.
- `AuditEntry.TenantID` – les journaux d'audit sont isolés par mandant.

Les super-administrateurs (`TenantID = nil`) opèrent globalement. Tous les autres utilisateurs ne voient que les données de leur mandant. L'isolation par mandant est appliquée au niveau de la base de données (Row-Level Security) et au niveau de l'application (`ctxutil.TenantIDFromContext`).

## Gérer les propriétaires

Les propriétaires sont des personnes ou organisations ayant droit de vote qui possèdent une ou plusieurs unités de logement. Ils sont enregistrés avec leur nom, adresse et e-mail, et associés aux unités correspondantes via `Ownership`.

Un propriétaire peut posséder des unités dans plusieurs communautés d'un même mandant. Les parts de propriété (`ShareNumerator`/`ShareDenominator`) déterminent la quote-part de valeur. `IsPrimaryVoter` marque l'électeur principal d'une unité.

Les propriétaires archivés (`IsArchived = true`) sont masqués dans l'administration, mais conservés pour les procès-verbaux historiques.

## Mandataires

Un propriétaire peut mandater une autre personne avec une procuration (`Proxy`) pour participer à l'assemblée et voter en son nom. Les procurations peuvent être accordées librement ou avec mandat.

Le `VoteValidator` garantit que seul le mandataire (`GranteeID`) vote numériquement – le mandant (`GrantorID`) est bloqué tant qu'une procuration active existe. Les votes avec mandat doivent correspondre à l'instruction (`MandatedVote`).

## Impersonation

Les super-administrateurs peuvent emprunter l'identité d'un autre utilisateur (`internal/application/impersonation_service.go`). Le processus utilise ZITADEL Token Exchange (RFC 8693) :

- Le super-administrateur échange son access-token contre un nouveau JWT qui emprunte l'identité de l'utilisateur cible.
- Le JWT résultant contient un claim `act` qui identifie l'initiateur de l'impersonation.
- Chaque action pendant l'impersonation est enregistrée dans le journal d'audit avec `ImpersonatedByID` (version de hachage v3).

<Aside type="note" title="Traçabilité complète">
L'impersonation est entièrement traçable dans le journal d'audit. La chaîne de hachage (v3) intègre l'identité de l'initiateur dans chaque entrée d'audit.
</Aside>

## Sécuriser l'accès

Chaque utilisateur se connecte via ZITADEL (OIDC). L'authentification s'effectue via des liens personnels ou des codes d'invitation (`RedeemInvitation`). Les administrateurs de mandant ne voient que les données de leur propre mandant.

Détails sur la chaîne de hachage d'audit et la vérification d'intégrité voir `/reference/sicherheit/`.

## Liens complémentaires

<LinkCard title="Référence des rôles" href="/reference/rollen/" description="Définitions détaillées des rôles et autorisations." />
<LinkCard title="Sécurité et audit" href="/reference/sicherheit/" description="Chaînes de hachage, journalisation d'impersonation et vérification d'intégrité." />
