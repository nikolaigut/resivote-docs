---
title: Enregistrement et présence
description: Méthodes d'enregistrement, jetons QR, signatures sur tablette et calcul de présence avec procurations.
---

import { Steps, Aside, CardGrid, Card } from '@astrojs/starlight/components';

Ce guide décrit comment les propriétaires sont marqués présents à une assemblée et comment ResiVote calcule la présence. Il s'adresse aux `tenant_admin`, `meeting_chair` et aux propriétaires.

## Méthodes d'enregistrement

Chaque assemblée définit sa méthode d'enregistrement (`checkin_method`). Une valeur vide signifie `MANUAL`.

| Méthode | Description |
| --- | --- |
| `MANUAL` | Le président ou l'administrateur marque manuellement les propriétaires présents. |
| `QR_CODE` | Les propriétaires s'enregistrent eux-mêmes en scannant un QR-code avec leur smartphone. |
| `SIGNATURE` | Les propriétaires se sélectionnent dans un menu déroulant sur la tablette de l'administrateur et signent numériquement. |

## Prérequis : statut CHECK_IN

L'enregistrement requiert que l'assemblée soit dans le statut `CHECK_IN`. Lors de l'ouverture de l'assemblée (`PUBLISHED → CHECK_IN`), le système vérifie pour les méthodes `QR_CODE` et `SIGNATURE` que l'enregistrement est correctement configuré.

## Enregistrement manuel

Le président enregistre manuellement la présence d'une unité. Le système crée un enregistrement `Attendance` avec `method = CHECKIN` et rejette les doubles enregistrements avec une erreur de conflit.

## Self check-in par QR-code

<Steps>

1. **Générer un jeton QR.** L'administrateur génère un jeton d'enregistrement signé pour l'assemblée. Le jeton est un JWT signé par HMAC (HS256) et contient la `meeting_id`, la méthode d'enregistrement et le slug du mandant. La durée de validité est contrôlée par la variable d'environnement `CHECKIN_TOKEN_EXPIRY` (par défaut : 30 minutes).

2. **Valider le jeton.** Avant la connexion, le frontend peut valider le jeton pour identifier l'assemblée. Le jeton lui-même n'accorde aucun accès – le propriétaire doit ensuite s'authentifier.

3. **Effectuer le self check-in.** Le propriétaire authentifié enregistre une ou plusieurs de ses unités. Le système vérifie que le propriétaire possède activement l'unité (`ValidUntil` n'est pas défini) et que l'unité n'est pas déjà enregistrée. Les unités déjà enregistrées sont ignorées – le self check-in est idempotent.

</Steps>

<Aside type="note" title="Vérifier la méthode">
  Le self check-in n'est autorisé que si la méthode d'enregistrement de l'assemblée est `QR_CODE` (ou vide, ce qui pour des raisons de rétrocompatibilité autorise le self check-in).
</Aside>

## Enregistrement par signature sur tablette

L'enregistrement par signature s'effectue en deux étapes sur la tablette de l'administrateur :

### Étape 1 : récupérer l'aperçu

La `CheckinPreview` montre au propriétaire quelles unités sont couvertes par sa signature :

- **Unités propres** (`own_units`) – toutes les propriétés actives dans le périmètre de communauté de l'assemblée.
- **Unités représentées** (`proxy_units`) – unités pour lesquelles le propriétaire est mandataire d'une procuration active. Pour chaque unité représentée, le mandant (`proxy_grantor_id`) est indiqué.
- **Total** – `total_units` et `total_value_quota` additionnent les unités couvertes et leurs quotes-parts de valeur.

### Étape 2 : capturer la signature

La méthode `SignatureCheckIn` enregistre la signature numérique :

- **`captured_by_id`** – l'administrateur qui opère la tablette.
- **`image_data`** – la signature sous forme de données d'image JPEG ou PNG.
- **Unités propres** – reçoivent un enregistrement `Attendance` avec `method = SIGNATURE`.
- **Unités représentées** – ne reçoivent pas de présence propre. Elles sont automatiquement marquées comme représentées via la procuration dans le Presence Builder. La table de jointure `SignatureUnit` documente toutes les unités couvertes (propres et représentées) à des fins d'audit.

La signature est stockée dans une table distincte (`signatures`) – séparée de la présence – afin que les données d'image restent infalsifiables et vérifiables indépendamment.

## Entité Présence

Chaque présence (`Attendance`) enregistre quand et comment une unité a été enregistrée :

- **`owner_id`** – le propriétaire.
- **`unit_id`** – l'unité enregistrée.
- **`method`** – la méthode d'enregistrement : `CHECKIN` (manuel), `SELF_CHECKIN` (QR), `SIGNATURE` (tablette) ou `VOTE` (automatique par vote).

Une unité est considérée comme présente dès qu'un enregistrement `Attendance` existe.

## Calcul de présence (Presence Builder)

Le Presence Builder agrège les présences, procurations et rapports de propriété en instantanés par communauté (`CommunityPresence`). Par communauté, il calcule :

- **`total_owners`**, **`total_head_votes`** (nombre d'unités) et **`total_value_quota`**.
- **`present_owners`**, **`present_head_votes`** et **`present_value_quota`**.
- **`presence_head_pct`** et **`presence_value_pct`** – pourcentages de présence.

Chaque propriétaire reçoit un statut (`PresenceRecord`) :

- **`PRESENT`** – le propriétaire est directement enregistré.
- **`REPRESENTED`** – le propriétaire est représenté par une procuration active ; `represented_by` fait référence au mandataire. Prérequis : le mandataire est présent quelque part dans l'assemblée.
- **`ABSENT`** – ni présent ni représenté.

Les communautés MEG sans unités propres héritent des unités des STWEG associés, à condition que `InheritsOwners` soit actif et que le MEG ne possède pas d'unités propres.

## Présence automatique par vote

Un vote implique la présence : si un propriétaire vote sans avoir été enregistré au préalable, le système crée automatiquement un enregistrement `Attendance` avec `method = VOTE`. En cas de vote par procuration, la présence est attribuée au mandataire.

<CardGrid>
  <Card title="Gérer les procurations" icon="seti:doc">
    Comment les unités représentées sont automatiquement enregistrées lors du check-in.
  </Card>
  <Card title="Créer une assemblée" icon="seti:settings">
    Configurer la méthode d'enregistrement lors de la création de l'assemblée.
  </Card>
</CardGrid>
