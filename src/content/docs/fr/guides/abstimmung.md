---
title: Effectuer des votes
description: Ouvrir des points de l'ordre du jour, voter numériquement et de manière analogique, et gérer les quorums et résultats en direct.
---

import { Steps, Aside, CardGrid, Card, LinkCard } from '@astrojs/starlight/components';

Ce guide décrit le processus de vote – de l'ouverture d'un point de l'ordre du jour au résultat. Il s'adresse aux `tenant_admin` et `meeting_chair`.

## Statut des points de l'ordre du jour

Chaque point de l'ordre du jour traverse son propre flux de statuts, validé par la State Machine :

| Statut | Signification |
| --- | --- |
| `PENDING` | Pas encore traité. |
| `PRESENTING` | Phase de présentation et de discussion ; pas de vote. |
| `PRE_VOTING` | Vote anticipé asynchrone en cours. |
| `OPEN` | Le vote est ouvert. |
| `CLOSED` | Vote clôturé. |
| `SKIPPED` | Le point de l'ordre du jour a été sauté. |

Transitions valides : `PENDING → PRESENTING / PRE_VOTING / OPEN / SKIPPED`, `PRESENTING → OPEN / CLOSED / PENDING / SKIPPED`, `PRE_VOTING → PRESENTING / OPEN / PENDING / CLOSED`, `OPEN → CLOSED / PRESENTING / PENDING`. Les points clôturés peuvent être rouverts ou représentés.

## Types de vote

Le type de vote résulte du type de point de l'ordre du jour (`type`) :

- **`MOTION`** – choix entre `YES`, `NO` et `ABSTAIN`.
- **`ELECTION`** – élection de candidats ; `choice` est `CANDIDATE`, le nom du candidat est stocké dans `candidate_name`.
- **`FREE_TEXT`** – texte libre ; `choice` est `FREE_TEXT`, le texte dans `free_text_value`.

## Modèles de droit de vote

Chaque communauté définit son modèle de droit de vote (`voting_rights_model`) :

- **`HEAD_AND_VALUE`** – voix par tête et quotes-parts de valeur (standard STWEG).
- **`HEAD_ONLY`** – uniquement les voix par tête (1 unité = 1 voix).
- **`VALUE_ONLY`** – uniquement les quotes-parts de valeur.
- **`CUSTOM_SHARES`** – parts personnalisées par unité (spécifique au MEG).

### Voix par tête et quote-part de valeur

Pour chaque voix : **1 unité = 1 voix par tête** (Art. 712o ZGB). Le champ `head_vote_value` est toujours `1`. La quote-part de valeur (`value_quota`) et d'éventuelles `custom_shares` sont capturées au moment du vote sous forme d'instantané dans l'enregistrement de vote. Ainsi, le vote reste traçable a posteriori, même si les rapports de propriété changent ultérieurement.

## Vote anticipé (Pre-Voting)

Pour les votes asynchrones, un point de l'ordre du jour peut être placé dans le statut `PRE_VOTING`. Les propriétaires peuvent voter à l'avance sans être présents. Ces votes sont marqués avec `is_pre_vote = true`. À la clôture du vote, ils sont intégrés au résultat. Le vote anticipé peut être réinitialisé à `PENDING` à tout moment ; les votes déjà émis sont conservés mais ne sont comptés que lorsque le point est ouvert ou que le vote anticipé est relancé.

## Vote numérique

<Steps>

1. **Ouvrir le point de l'ordre du jour.** Le président ouvre le point. Le système vérifie la capacité de résolution (quorum) sur la base de la présence actuelle. Si le quorum n'est pas atteint, le système bloque l'ouverture – sauf si le président a défini un override de quorum.

2. **Émettre un vote.** Le propriétaire sélectionne son unité et son option de vote. Le système crée automatiquement une présence (`Method = VOTE`) si l'unité n'était pas encore enregistrée – un vote implique la présence.

3. **Modifier un vote.** Les votes sont immuables (sécurité d'audit). Si un vote est modifié, le système marque l'ancien vote avec `is_superseded = true` et crée un nouvel enregistrement de vote. Ainsi, chaque changement de vote reste entièrement traçable.

4. **Clôturer le point de l'ordre du jour.** Le président clôture le point. Le système calcule le quorum, enregistre le résultat (`result_passed`, `result_details`) et arrête un éventuel minuteur de présentation.

</Steps>

## Vote analogique

Les propriétaires qui ne peuvent pas voter numériquement sont enregistrés de manière analogique. Le président saisit le vote en leur nom.

- **Vote analogique individuel** – `CastAnalogVote` enregistre un vote pour une unité présente. Si l'unité n'est pas enregistrée mais est représentée par une procuration active, le mandataire vote – à condition qu'il soit lui-même présent.
- **Vote groupé** – `CastBulkAnalogVotesRequest` enregistre plusieurs votes à main levée en une seule étape. Toutes les saisies sont validées et enregistrées dans une seule transaction de base de données. Si un vote échoue, aucun vote n'est persisté.

Le vote analogique n'est autorisé que dans le statut `OPEN`. Une seule voix active est possible par unité ; un vote déjà émis n'est pas écrasé lors de la saisie analogique.

## Résultats en direct

La visibilité des résultats en direct est contrôlée par `live_results_visible_to` au niveau de l'assemblée :

- **`ALL`** – tous les participants voient les résultats intermédiaires pendant que le vote est ouvert.
- **`CHAIR`** – seuls `tenant_admin` et `meeting_chair` voient les résultats en direct pour les points ouverts.

Les résultats clôturés sont visibles pour tous les participants. Les propriétaires non privilégiés voient les chiffres agrégés du quorum, mais pas l'identité des votants non ou des abstentions.

## Confirmation de vote

Si `require_vote_confirmation` est activé, les propriétaires doivent confirmer explicitement leur vote avant qu'il ne soit définitivement enregistré.

## Override de quorum

Le président peut lever un blocage de quorum pour un point de l'ordre du jour. En définissant `quorum_override` sur `true`, les votes sont acceptés même si la capacité de résolution n'était pas donnée à l'ouverture. Le champ `quorum_override_reason` est alors obligatoire. Chaque modification de l'override est enregistrée dans le journal d'audit (`QUORUM_OVERRIDE_GRANTED` ou `QUORUM_OVERRIDE_REVOKED`).

## Minuteur de présentation

Chaque point de l'ordre du jour possède un minuteur à compte à rebours pour la phase de présentation. Les champs `timer_started_at` et `timer_duration_seconds` stockent l'heure de départ et la durée. Ainsi, les clients peuvent synchroniser le minuteur après une reconnexion WebSocket ou un rechargement de page. À la clôture du point, le minuteur est automatiquement arrêté et réinitialisé.

<Aside type="note" title="Procurations">
  Les mandataires peuvent voter pour les unités représentées. Les détails se trouvent dans le guide <a href="/guides/vollmachten/">Gérer les procurations</a>.
</Aside>

<LinkCard title="Référence des quorums" href="/reference/quorum/" description="Détails techniques sur les types de quorum et le calcul." />
