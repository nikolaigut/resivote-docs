---
title: Gérer les procurations
description: Accorder, restreindre et révoquer des procurations – de la procuration générale au vote avec mandat.
---

import { Aside, Steps, CardGrid, Card } from '@astrojs/starlight/components';

Ce guide décrit le fonctionnement des procurations (Proxies) dans ResiVote. Il s'adresse aux `tenant_admin`, `meeting_chair` et aux propriétaires.

## Entité Procuration

Une procuration (`Proxy`) transfère le droit de vote pour une unité et une assemblée concrètes d'un propriétaire à un autre. Elle se compose des champs suivants :

- **`grantor_id`** – le mandant (propriétaire qui accorde la procuration).
- **`grantee_id`** – le mandataire (propriétaire qui reçoit la procuration).
- **`unit_id`** – l'unité pour laquelle la procuration est valable. Les procurations sont uniques par unité et par assemblée.
- **`meeting_id`** – l'assemblée à laquelle se rapporte la procuration.

Un propriétaire ne peut pas se mandater lui-même. Une seule procuration active est autorisée par unité et par assemblée.

## Portée de la procuration (Scope)

La portée d'une procuration est définie par `scope` :

- **`FULL`** – la procuration est valable pour l'ensemble de l'assemblée. Le mandataire peut voter pour tous les points de l'ordre du jour.
- **`RESTRICTED`** – la procuration est limitée à certains points de l'ordre du jour. La méthode `CoversAgendaItem` vérifie si un point est couvert : toujours pour `FULL`, et pour `RESTRICTED` uniquement si une instruction existe pour ce point.

## Vote avec mandat (Instructions)

Pour les procurations restreintes, chaque `ProxyInstruction` définit un vote obligatoire pour un point de l'ordre du jour spécifique :

- **`agenda_item_id`** – le point de l'ordre du jour auquel l'instruction s'applique.
- **`mandated_vote`** – l'option de vote prescrite (`YES`, `NO`, `ABSTAIN`, `CANDIDATE` ou `FREE_TEXT`).

<Aside type="warning" title="Instruction contraignante">
  Un vote avec mandat est contraignant. Le mandataire doit obligatoirement voter conformément à l'instruction. Le système l'impose lors du vote.
</Aside>

## Accorder une procuration

<Steps>

1. **Assemblée dans le bon statut.** Les procurations ne peuvent être créées que si l'assemblée a le statut `PUBLISHED`, `CHECK_IN`, `IN_PROGRESS` ou `OPEN`. En `DRAFT`, `CLOSED` ou `ARCHIVED`, la création est verrouillée.

2. **Vérifier le propriétaire et l'unité.** Le système vérifie que le mandant possède activement l'unité et que l'unité appartient au périmètre de communauté de l'assemblée. Le mandataire doit être un propriétaire autorisé dans les communautés de l'assemblée. Pour les unités MEG, les délégués MEG sans propriété directe dans la communauté MEG peuvent également être mandatés.

3. **Définir la portée et les instructions.** Choisissez `FULL` ou `RESTRICTED`. Pour `RESTRICTED`, ajoutez une instruction par point de l'ordre du jour avec l'option de vote mandatée.

4. **Enregistrer la procuration.** Le système crée la procuration et met immédiatement à jour la présence et le quorum en direct, car la représentation change.

</Steps>

## Révoquer une procuration

Une procuration est révoquée via `Revoke`. Le système définit `revoked_at` à l'heure actuelle ; la méthode `IsActive` renvoie ensuite `false`. Une révocation met également immédiatement à jour la présence et le quorum en direct.

## Représentation lors du vote

Lors du vote, le système prend automatiquement en compte les procurations actives :

- Le mandataire doit lui-même être présent à l'assemblée (enregistré sous une unité quelconque) pour que la représentation soit valable.
- Si le mandataire vote pour une unité représentée, `voter_id` est défini sur le mandataire et `proxy_id` fait référence à la procuration.
- En cas de présence directe du propriétaire (présence physique), celle-ci prime sur la procuration – le propriétaire vote lui-même.
- Pour le vote analogique, les mêmes règles s'appliquent : si l'unité n'est pas enregistrée mais est représentée par une procuration active et que le mandataire est présent, le mandataire vote.

## Représentation lors de l'enregistrement

Les procurations ont un impact automatique sur la présence. Le Presence Builder marque les unités représentées comme `REPRESENTED`, à condition que le mandataire soit présent quelque part dans l'assemblée. L'unité représentée est incluse dans les calculs de voix par tête et de quotes-parts de valeur. Détails dans le guide <a href="/guides/checkin/">Enregistrement et présence</a>.

<CardGrid>
  <Card title="Enregistrement et présence" icon="seti:check">
    Comment les unités représentées sont enregistrées lors du check-in.
  </Card>
  <Card title="Effectuer des votes" icon="seti:vote">
    Comment les mandataires votent pour les unités représentées.
  </Card>
</CardGrid>
