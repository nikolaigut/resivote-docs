---
title: Enregistrement et présence
description: Méthodes d'enregistrement, jetons QR, signatures sur tablette et calcul de présence avec procurations.
---

import { Steps, Aside, CardGrid, Card } from '@astrojs/starlight/components';

Ce guide décrit comment les propriétaires sont marqués présents à une assemblée et comment ResiVote calcule la présence. Il s'adresse aux administrateurs de mandant, aux présidents et aux propriétaires.

## Méthodes d'enregistrement

Chaque assemblée définit sa méthode d'enregistrement. Par défaut, la méthode manuelle est utilisée.

| Méthode | Description |
| --- | --- |
| Manuel | Le président ou l'administrateur marque manuellement les propriétaires présents. |
| QR-code | Les propriétaires s'enregistrent eux-mêmes en scannant un QR-code avec leur smartphone. |
| Signature | Les propriétaires se sélectionnent dans un menu déroulant sur la tablette de l'administrateur et signent numériquement. |

## Prérequis : phase d'enregistrement

L'enregistrement requiert que l'assemblée soit en phase d'enregistrement. Lors de l'ouverture de l'assemblée, le système vérifie pour les méthodes QR-code et signature que l'enregistrement est correctement configuré.

## Enregistrement manuel

Le président enregistre manuellement la présence d'une unité. Le système crée un enregistrement de présence et rejette les doubles enregistrements avec une erreur de conflit.

## Self check-in par QR-code

<Steps>

1. **Générer un jeton QR.** L'administrateur génère un jeton d'enregistrement signé pour l'assemblée. Le jeton contient l'identifiant de l'assemblée, la méthode d'enregistrement et le slug du mandant. La durée de validité est de 30 minutes par défaut.

2. **Valider le jeton.** Avant la connexion, le frontend peut valider le jeton pour identifier l'assemblée. Le jeton lui-même n'accorde aucun accès – le propriétaire doit ensuite s'authentifier.

3. **Effectuer le self check-in.** Le propriétaire authentifié enregistre une ou plusieurs de ses unités. Le système vérifie que le propriétaire possède activement l'unité et que l'unité n'est pas déjà enregistrée. Les unités déjà enregistrées sont ignorées – le self check-in est idempotent.

</Steps>

<Aside type="note" title="Vérifier la méthode">
  Le self check-in n'est autorisé que si la méthode d'enregistrement de l'assemblée est QR-code (ou vide, ce qui pour des raisons de rétrocompatibilité autorise le self check-in).
</Aside>

## Enregistrement par signature sur tablette

L'enregistrement par signature s'effectue en deux étapes sur la tablette de l'administrateur :

### Étape 1 : récupérer l'aperçu

L'aperçu montre au propriétaire quelles unités sont couvertes par sa signature :

- **Unités propres** – toutes les propriétés actives dans le périmètre de communauté de l'assemblée.
- **Unités représentées** – unités pour lesquelles le propriétaire est mandataire d'une procuration active. Pour chaque unité représentée, le mandant est indiqué.
- **Total** – additionne les unités couvertes et leurs quotes-parts de valeur.

### Étape 2 : capturer la signature

L'enregistrement par signature enregistre la signature numérique :

- **L'administrateur** qui opère la tablette est enregistré.
- **La signature** est capturée sous forme d'image.
- **Unités propres** – reçoivent un enregistrement de présence par signature.
- **Unités représentées** – ne reçoivent pas de présence propre. Elles sont automatiquement marquées comme représentées via la procuration. Toutes les unités couvertes (propres et représentées) sont documentées à des fins d'audit.

La signature est stockée séparément de la présence, afin que les données d'image restent infalsifiables et vérifiables indépendamment.

## Présence

Chaque présence enregistre quand et comment une unité a été enregistrée :

- **Le propriétaire** – le propriétaire enregistré.
- **L'unité** – l'unité enregistrée.
- **La méthode** – la méthode d'enregistrement : manuel, self check-in (QR), signature (tablette) ou automatique par vote.

Une unité est considérée comme présente dès qu'un enregistrement de présence existe.

## Calcul de présence

Le système agrège les présences, procurations et rapports de propriété en instantanés par communauté. Par communauté, il calcule :

- Le nombre total de propriétaires, le nombre total d'unités (voix par tête) et le total des quotes-parts de valeur.
- Le nombre de propriétaires présents, les voix par tête présentes et les quotes-parts de valeur présentes.
- Les pourcentages de présence par tête et par valeur.

Chaque propriétaire reçoit un statut :

- **Présent** – le propriétaire est directement enregistré.
- **Représenté** – le propriétaire est représenté par une procuration active ; le mandataire est référencé. Prérequis : le mandataire est présent quelque part dans l'assemblée.
- **Absent** – ni présent ni représenté.

Les communautés MEG sans unités propres héritent des unités des STWEG associés, à condition que l'héritage des propriétaires soit activé et que le MEG ne possède pas d'unités propres.

## Présence automatique par vote

Un vote implique la présence : si un propriétaire vote sans avoir été enregistré au préalable, le système crée automatiquement un enregistrement de présence. En cas de vote par procuration, la présence est attribuée au mandataire.

<CardGrid>
  <Card title="Gérer les procurations" icon="seti:doc">
    Comment les unités représentées sont automatiquement enregistrées lors du check-in.
  </Card>
  <Card title="Créer une assemblée" icon="seti:settings">
    Configurer la méthode d'enregistrement lors de la création de l'assemblée.
  </Card>
</CardGrid>
