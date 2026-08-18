---
title: Effectuer des votes
description: Ouvrir des points de l'ordre du jour, voter numériquement et de manière analogique, et gérer les quorums et résultats en direct.
---

import { Steps, Aside, CardGrid, Card, LinkCard } from '@astrojs/starlight/components';

Ce guide décrit le processus de vote – de l'ouverture d'un point de l'ordre du jour au résultat. Il s'adresse aux administrateurs de mandant et aux présidents.

## Statut des points de l'ordre du jour

Chaque point de l'ordre du jour traverse son propre flux de statuts :

| Statut | Signification |
| --- | --- |
| En attente | Pas encore traité. |
| Présentation | Phase de présentation et de discussion ; pas de vote. |
| Vote anticipé | Vote anticipé asynchrone en cours. |
| Ouvert | Le vote est ouvert. |
| Clôturé | Vote clôturé. |
| Sauté | Le point de l'ordre du jour a été sauté. |

Transitions valides : En attente → Présentation / Vote anticipé / Ouvert / Sauté, Présentation → Ouvert / Clôturé / En attente / Sauté, Vote anticipé → Présentation / Ouvert / En attente / Clôturé, Ouvert → Clôturé / Présentation / En attente. Les points clôturés peuvent être rouverts ou représentés.

## Types de vote

Le type de vote résulte du type de point de l'ordre du jour :

- **Motion** – choix entre oui, non et abstention.
- **Élection** – élection de candidats ; le nom du candidat est enregistré.
- **Texte libre** – texte libre saisi par le propriétaire.

## Modèles de droit de vote

Chaque communauté définit son modèle de droit de vote :

- **Voix par tête et quotes-parts de valeur** – standard STWEG.
- **Uniquement les voix par tête** – 1 unité = 1 voix.
- **Uniquement les quotes-parts de valeur**.
- **Parts personnalisées** – parts personnalisées par unité (spécifique au MEG).

### Voix par tête et quote-part de valeur

Pour chaque voix : **1 unité = 1 voix par tête** (Art. 712o ZGB). La quote-part de valeur et d'éventuelles parts personnalisées sont capturées au moment du vote sous forme d'instantané dans l'enregistrement de vote. Ainsi, le vote reste traçable a posteriori, même si les rapports de propriété changent ultérieurement.

## Vote anticipé (Pre-Voting)

Pour les votes asynchrones, un point de l'ordre du jour peut être placé dans le statut de vote anticipé. Les propriétaires peuvent voter à l'avance sans être présents. Ces votes sont marqués comme votes anticipés. À la clôture du vote, ils sont intégrés au résultat. Le vote anticipé peut être réinitialisé à tout moment ; les votes déjà émis sont conservés mais ne sont comptés que lorsque le point est ouvert ou que le vote anticipé est relancé.

## Vote numérique

<Steps>

1. **Ouvrir le point de l'ordre du jour.** Le président ouvre le point. Le système vérifie la capacité de résolution (quorum) sur la base de la présence actuelle. Si le quorum n'est pas atteint, le système bloque l'ouverture – sauf si le président a défini un override de quorum.

2. **Émettre un vote.** Le propriétaire sélectionne son unité et son option de vote. Le système crée automatiquement une présence si l'unité n'était pas encore enregistrée – un vote implique la présence.

3. **Modifier un vote.** Les votes sont immuables (sécurité d'audit). Si un vote est modifié, le système marque l'ancien vote comme remplacé et crée un nouvel enregistrement de vote. Ainsi, chaque changement de vote reste entièrement traçable.

4. **Clôturer le point de l'ordre du jour.** Le président clôture le point. Le système calcule le quorum, enregistre le résultat et arrête un éventuel minuteur de présentation.

</Steps>

## Vote analogique

Les propriétaires qui ne peuvent pas voter numériquement sont enregistrés de manière analogique. Le président saisit le vote en leur nom.

- **Vote analogique individuel** – enregistre un vote pour une unité présente. Si l'unité n'est pas enregistrée mais est représentée par une procuration active, le mandataire vote – à condition qu'il soit lui-même présent.
- **Vote groupé** – enregistre plusieurs votes à main levée en une seule étape. Toutes les saisies sont validées et enregistrées dans une seule transaction. Si un vote échoue, aucun vote n'est enregistré.

Le vote analogique n'est autorisé que lorsque le point est ouvert. Une seule voix active est possible par unité ; un vote déjà émis n'est pas écrasé lors de la saisie analogique.

## Résultats en direct

La visibilité des résultats en direct est contrôlée au niveau de l'assemblée :

- **Tous les participants** – tous les participants voient les résultats intermédiaires pendant que le vote est ouvert.
- **Président et administrateur** – seuls le président et l'administrateur voient les résultats en direct pour les points ouverts.

Les résultats clôturés sont visibles pour tous les participants. Les propriétaires non privilégiés voient les chiffres agrégés du quorum, mais pas l'identité des votants non ou des abstentions.

## Confirmation de vote

Si la confirmation de vote est activée, les propriétaires doivent confirmer explicitement leur vote avant qu'il ne soit définitivement enregistré.

## Override de quorum

Le président peut lever un blocage de quorum pour un point de l'ordre du jour. En activant l'override de quorum, les votes sont acceptés même si la capacité de résolution n'était pas donnée à l'ouverture. Une justification est alors obligatoire. Chaque modification de l'override est enregistrée dans le journal d'audit.

## Minuteur de présentation

Chaque point de l'ordre du jour possède un minuteur à compte à rebours pour la phase de présentation. L'heure de départ et la durée sont stockées. Ainsi, les clients peuvent synchroniser le minuteur après une reconnexion ou un rechargement de page. À la clôture du point, le minuteur est automatiquement arrêté et réinitialisé.

<Aside type="note" title="Procurations">
  Les mandataires peuvent voter pour les unités représentées. Les détails se trouvent dans le guide <a href="/guides/vollmachten/">Gérer les procurations</a>.
</Aside>

<LinkCard title="Quorum et présence" href="/guides/quorum/" description="Capacité de résolution et calcul du quorum." />
