---
title: Utilisateurs et autorisations
description: Rôles, isolation par mandant, gestion des propriétaires et impersonation dans ResiVote.
---

import { Aside, CardGrid, Card, LinkCard } from '@astrojs/starlight/components';

ResiVote sépare l'identité d'authentification de l'identité de propriétaire. Les rôles sont stockés par mandant dans la base de données. Toutes les données sont isolées par mandant.

## Identité de connexion et identité de propriétaire

ResiVote découple volontairement l'identité de connexion de la propriété :

- **Identité de connexion** – l'identité d'authentification. Contient l'identité ZITADEL, l'e-mail, le nom et un rôle. Pour les super-administrateurs, aucun mandant n'est attribué.
- **Identité de propriétaire** – l'identité de propriété. Contient le nom, l'e-mail, le téléphone et un lien optionnel vers l'identité de connexion. Un propriétaire peut posséder des unités dans plusieurs communautés d'un même mandant.

La liaison s'effectue lors de la première connexion : le système associe l'identité ZITADEL à tous les enregistrements de même e-mail qui n'ont pas encore d'identité externe.

### Propriétés du propriétaire

| Champ | Signification |
|------|---------------|
| Identité externe | Identité globale (inter-mandants) |
| Lien de connexion | Lien optionnel vers l'identité de connexion (nullable pour les données héritées) |
| Archivage | Propriétaire marqué comme archivé |
| Mandant | Les propriétaires ne peuvent posséder des unités qu'au sein d'un même mandant |

## Rôles

ResiVote connaît quatre rôles :

### Administrateur de mandant

L'administrateur de mandant prépare les assemblées, invite les participants, gère les communautés et les unités, et tient le procès-verbal. Il ne voit que les données de son propre mandant.

### Super-administrateur

Le super-administrateur est global. Il gère les mandants, a accès aux routes super-admin et peut emprunter l'identité d'autres utilisateurs. Le rôle de super-administrateur n'est pas stocké par mandant, il reste un rôle global.

### Président

Le président dirige l'assemblée via le tableau de bord du président : il ouvre et ferme les points de l'ordre du jour, lance les votes, accorde des overrides de quorum et contrôle la visibilité des résultats en direct.

### Propriétaire

Le propriétaire participe aux assemblées, vote et consulte ses documents dans le portail. Le rôle de propriétaire est le rôle par défaut pour les personnes ayant droit de vote.

## Associations de mandants

Les associations d'utilisateurs aux mandants sont la **source de vérité** pour les rôles par mandant. Un utilisateur peut avoir plusieurs entrées, une par mandant.

<Aside type="warning" title="Super-administrateur non stocké par mandant">
Le rôle de super-administrateur n'est volontairement pas stocké par mandant. Il reste un rôle global, car les super-administrateurs opèrent de manière inter-mandants.
</Aside>

Rôles autorisés par mandant : administrateur de mandant, président, propriétaire.

## Isolation par mandant

ResiVote est multi-mandants. Chaque entité porte un mandant :

- Les propriétaires sont liés à un mandant.
- Les documents sont isolés par mandant.
- Les dossiers sont isolés par mandant.
- Les assemblées appartiennent à un mandant.
- Les journaux d'audit sont isolés par mandant.

Les super-administrateurs opèrent globalement. Tous les autres utilisateurs ne voient que les données de leur mandant. L'isolation par mandant est appliquée au niveau de la base de données et au niveau de l'application.

## Gérer les propriétaires

Les propriétaires sont des personnes ou organisations ayant droit de vote qui possèdent une ou plusieurs unités de logement. Ils sont enregistrés avec leur nom, adresse et e-mail, et associés aux unités correspondantes.

Un propriétaire peut posséder des unités dans plusieurs communautés d'un même mandant. Les parts de propriété déterminent la quote-part de valeur. L'électeur principal d'une unité est marqué comme tel.

Les propriétaires archivés sont masqués dans l'administration, mais conservés pour les procès-verbaux historiques.

## Mandataires

Un propriétaire peut mandater une autre personne avec une procuration pour participer à l'assemblée et voter en son nom. Les procurations peuvent être accordées librement ou avec mandat.

Le système garantit que seul le mandataire vote numériquement – le mandant est bloqué tant qu'une procuration active existe. Les votes avec mandat doivent correspondre à l'instruction.

## Impersonation

Les super-administrateurs peuvent emprunter l'identité d'un autre utilisateur. Le processus utilise ZITADEL Token Exchange :

- Le super-administrateur échange son jeton d'accès contre un nouveau jeton qui emprunte l'identité de l'utilisateur cible.
- Le jeton résultant identifie l'initiateur de l'impersonation.
- Chaque action pendant l'impersonation est enregistrée dans le journal d'audit avec l'identité de l'initiateur.

<Aside type="note" title="Traçabilité complète">
L'impersonation est entièrement traçable dans le journal d'audit. La chaîne de hachage intègre l'identité de l'initiateur dans chaque entrée d'audit.
</Aside>

## Sécuriser l'accès

Chaque utilisateur se connecte via ZITADEL. L'authentification s'effectue via des liens personnels ou des codes d'invitation. Les administrateurs de mandant ne voient que les données de leur propre mandant.
