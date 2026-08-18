---
title: Créer une assemblée
description: Créer une assemblée, définir les points de l'ordre du jour et la publier – du brouillon à l'invitation.
---

import { Steps, Aside, CardGrid, Card } from '@astrojs/starlight/components';

Ce guide s'adresse aux `tenant_admin` et `meeting_chair`. Il décrit comment créer une assemblée au statut `DRAFT`, la munir de points de l'ordre du jour et la publier.

## Cycle de vie d'une assemblée

Chaque assemblée traverse un flux de statuts défini. Les transitions d'état sont validées par la State Machine dans le backend.

| Statut | Signification |
| --- | --- |
| `DRAFT` | Phase de préparation – l'assemblée n'est pas encore visible. |
| `PUBLISHED` | Les invitations ont été envoyées. |
| `CHECK_IN` | La phase d'enregistrement est ouverte. |
| `IN_PROGRESS` | L'assemblée est en cours, les points de l'ordre du jour sont traités. |
| `CLOSED` | L'assemblée a été clôturée. |
| `ARCHIVED` | L'assemblée est archivée. |

Transitions valides : `DRAFT → PUBLISHED`, `PUBLISHED → CHECK_IN`, `CHECK_IN → IN_PROGRESS`, `IN_PROGRESS → CLOSED`, `CLOSED → ARCHIVED`. À partir d'`ARCHIVED`, aucune autre transition n'est possible.

## Modes d'assemblée

Lors de la création, vous choisissez le mode de l'assemblée :

- **`LIVE_MEETING`** – Assemblée en présentiel, hybride ou en ligne en temps réel. Valeur par défaut.
- **`CIRCULAR_RESOLUTION`** – Résolution circulaire (Art. 712m al. 2 ZGB). Requiert obligatoirement les champs `circular_voting_start` et `circular_voting_end`. Le début doit précéder la fin.

## Créer une assemblée

<Steps>

1. **Saisir les données de base.** Définissez le titre, la description, la date (`scheduled_at` comme horodatage RFC3339) et le lieu. Le système vérifie qu'aucune autre assemblée du même mandant n'est déjà planifiée à la date choisie. Un slug unique est généré automatiquement.

2. **Choisir le mode et la méthode d'enregistrement.** Définissez `meeting_mode` sur `LIVE_MEETING` ou `CIRCULAR_RESOLUTION`. Choisissez la méthode d'enregistrement (`checkin_method`) :
   - `MANUAL` – le président marque manuellement les propriétaires présents (par défaut).
   - `QR_CODE` – les propriétaires s'enregistrent eux-mêmes via un QR-code.
   - `SIGNATURE` – les propriétaires signent sur la tablette de l'administrateur.

3. **Définir la visibilité des résultats en direct.** Avec `live_results_visible_to`, vous déterminez qui voit les résultats en direct pendant un vote ouvert :
   - `ALL` – tous les participants voient les résultats intermédiaires (par défaut).
   - `CHAIR` – seuls `tenant_admin` et `meeting_chair` voient les résultats en direct.

4. **Activer la confirmation de vote (optionnel).** Définissez `require_vote_confirmation` sur `true` si les propriétaires doivent confirmer explicitement leur vote.

5. **Associer les communautés.** Associez une ou plusieurs communautés à l'assemblée. L'association s'effectue via la table de jointure `meeting_communities` et permet les assemblées multi-communautés.

</Steps>

## Créer des points de l'ordre du jour

Chaque point de l'ordre du jour (`AgendaItem`) appartient à une assemblée et possède les propriétés suivantes :

- **`order_number`** – ordre dans l'assemblée.
- **`title`** et **`description`** – désignation et explication.
- **`type`** – type de point de l'ordre du jour :
  - `MOTION` – vote oui/non/abstention.
  - `ELECTION` – élections ; requiert le champ `candidates` (liste de noms de candidats).
  - `FREE_TEXT` – vote en texte libre.
  - `PROTOCOL` – désignation du rédacteur du procès-verbal, sans vote.
- **`quorum_type`** – modèle de quorum pour ce point : `SIMPLE_MAJORITY`, `QUALIFIED_MAJORITY`, `UNANIMOUS`, `ABSOLUTE_MAJORITY` ou `CUSTOM`. Pour `CUSTOM`, vous définissez `custom_quorum_pct` et optionnellement `custom_quorum_value_pct` ; `custom_quorum_base` détermine la base (`PRESENT` ou `ELIGIBLE`).
- **`community_id`** – référence à la communauté. Une valeur vide (`nil`) signifie que le point s'applique à toutes les communautés de l'assemblée. La méthode `AppliesToCommunity` le vérifie : si `CommunityID` n'est pas défini, le point s'applique à toutes.

Pour `LIVE_MEETING`, le système crée automatiquement le point procédural « Désignation du rédacteur du procès-verbal » (type `PROTOCOL`, `order_number` 0). Dès que vous désignez le rédacteur du procès-verbal, le système ferme automatiquement ce point.

## Configurer le rédacteur du procès-verbal

Le rédacteur du procès-verbal est défini via `protocol_writer_type` et `protocol_writer_owner_id` :

- **`OWNER`** – un propriétaire tient le procès-verbal ; `protocol_writer_owner_id` référence le propriétaire.
- **`TENANT_ADMIN`** – un administrateur tient le procès-verbal.

Cette configuration n'est autorisée que pour `LIVE_MEETING` et n'est plus modifiable une fois l'assemblée `CLOSED` ou `ARCHIVED`.

## Télécharger des pièces jointes

Les pièces jointes peuvent être gérées à deux niveaux :

- **Pièces jointes d'assemblée** – documents généraux pour l'ensemble de l'assemblée.
- **Pièces jointes de point de l'ordre du jour** – documents relatifs à un point spécifique.

De plus, ResiVote prend en charge les diapositives en ligne pour les présentations au sein d'un point de l'ordre du jour.

## Publier l'assemblée

La publication effectue la transition d'état `DRAFT → PUBLISHED`. Les actions suivantes se produisent :

1. La State Machine valide et définit le statut sur `PUBLISHED`.
2. Le système planifie la séquence d'e-mails : une invitation immédiate et un rappel sept jours avant la date de l'assemblée.
3. Les invitations sont envoyées dans la mesure du possible immédiatement ; en cas d'échec d'envoi, l'assemblée reste néanmoins publiée.

<Aside type="note" title="Mises à jour">
  Les assemblées ne peuvent être modifiées que dans le statut `DRAFT` ou `PUBLISHED`. Dès que l'assemblée atteint `CHECK_IN` ou un statut ultérieur, les modifications des données de base sont verrouillées.
</Aside>

<CardGrid>
  <Card title="Effectuer des votes" icon="seti:vote">
    Comment les points de l'ordre du jour sont soumis au vote et quels modèles de vote s'appliquent.
  </Card>
  <Card title="Enregistrement et présence" icon="seti:check">
    Comment les propriétaires sont marqués présents à l'assemblée.
  </Card>
</CardGrid>
