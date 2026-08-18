---
title: Quorum et présence
description: Types de quorum, capacité de résolution, calcul de présence et modèles de communauté dans ResiVote.
---

import { Steps, Aside, CardGrid, Card, LinkCard } from '@astrojs/starlight/components';

ResiVote calcule les quorums selon le droit immobilier suisse (ZGB). La capacité de résolution est suivie en direct pendant l'assemblée et figée sous forme d'instantané lors de l'ouverture d'un point de l'ordre du jour.

## Types de quorum

Chaque point de l'ordre du jour définit son type de quorum :

| Type | Signification | Base juridique |
|-----|---------------|----------------|
| Majorité simple | OUI > 50% des voix par tête présentes. Les abstentions et les votes non émis comptent comme un non implicite. | — |
| Majorité qualifiée | OUI > 50% des propriétaires présents (têtes) **et** > 50% **de toutes** les quotes-parts de valeur autorisées. | Art. 647b/d/e, 712g al. 3 ZGB |
| Unanimité | 100% **de tous** les propriétaires enregistrés (têtes) et quotes-parts de valeur doivent voter OUI. Les absences sans procuration positive comptent comme un non. | Art. 647e ZGB |
| Majorité absolue | OUI > 50% **de tous** les propriétaires enregistrés (indépendamment de la présence). | — |
| Personnalisé | OUI >= seuil en % de la base configurée. | Règlement |

### Quorum personnalisé

Pour un quorum personnalisé, le point de l'ordre du jour contient trois paramètres :

- **Seuil en %** – p. ex. 66.67%
- **Seuil séparé optionnel pour les quotes-parts de valeur**
- **Base** – les présents ou tous les autorisés

### Override de quorum

Le président peut lever un blocage de quorum. Le point de l'ordre du jour contient pour cela :

- **Override de quorum** – si activé, les votes sont acceptés même si le quorum n'était pas atteint à l'ouverture.
- **Justification** – texte de justification obligatoire lorsque l'override est activé.

Le système vérifie lors du vote : si aucun instantané de quorum n'existe, le contrôle est ignoré. Si le quorum n'était pas atteint et qu'aucun override n'est défini, le vote est rejeté.

## Moteur de quorum

Le moteur de quorum est la composante centrale de l'évaluation des votes. Il calcule par communauté un résultat de quorum et les agrège en un résultat global.

### Entrées

- Point de l'ordre du jour avec son type de quorum et ses paramètres
- Communautés de l'assemblée
- Unités et parts de propriété
- Présences
- Procurations
- Votes émis

### Sorties par communauté

| Champ | Signification |
|------|---------------|
| Voix par tête (oui / non / abstention) | Voix par tête |
| Quotes-parts de valeur (oui / non / abstention) | Quotes-parts de valeur |
| Seuils requis | Voix OUI requises |
| Seuils atteints | Si le seuil est atteint |
| Résultat global | Résultat global (nil pour les points informatifs) |
| Limitation du droit de vote appliquée | Propriétaires concernés par le plafonnement |
| Noms des votants non / abstention | Pour le procès-verbal |
| Résultat d'élection | Tally et vainqueur pour les élections |
| Point informatif | Pas de résultat OUI/NON (p. ex. texte libre) |
| Résultat hérité | Résultat MEG hérité des STWEG associés |

### Normalisation défensive

Le moteur de quorum normalise les entrées de manière défensive : les communautés vides produisent un résultat informatif, les votes manquants comptent comme un non implicite, et les erreurs d'arrondi sont absorbées.

### Résultat global

Le résultat global est positif si **toutes** les communautés atteignent le quorum. Les résultats MEG hérités ne sont pas comptés double.

## Service de quorum en direct

Le service de quorum en direct répond à la question « l'assemblée est-elle capable de résoudre ? » en temps réel, sur la base de la présence actuelle – indépendamment des votes émis.

### Capacité de résolution

L'assemblée est capable de résoudre si **plus de la moitié** des voix par tête **et** plus de la moitié des quotes-parts de valeur sont présentes/représentées, plus le nombre minimum de propriétaires. « Plus de la moitié » est une inégalité **stricte** : pour un nombre total pair N, le seuil est `N/2 + 1` (p. ex. 4 propriétaires → 3 nécessaires). Exactement 50% ne suffit pas.

### Modèles de droit de vote

Les conditions applicables dépendent du modèle de droit de vote de la communauté :

| Modèle | Condition têtes | Condition quotes-parts de valeur |
|--------|-----------------|----------------------------------|
| Voix par tête et quotes-parts de valeur / Parts personnalisées | oui | oui |
| Uniquement les voix par tête | oui | ignorée |
| Uniquement les quotes-parts de valeur | ignorée | oui |

### Sortie

L'état du quorum en direct par communauté indique :

- Si le quorum par tête est atteint, si le quorum par valeur est atteint, si le nombre minimum de propriétaires est atteint, et le quorum global.
- Les voix par tête requises et les quotes-parts de valeur requises.
- Les voix par tête manquantes, les quotes-parts de valeur manquantes et les propriétaires manquants.

L'assemblée est capable de résoudre si toutes les communautés atteignent le quorum.

## Calcul de présence

Le système collecte les présences, procurations et parts de propriété et les agrège en instantanés par communauté. Le quorum en direct et l'API utilisent la même source de présence.

### Déroulement

<Steps>
  1. **Charger les communautés** – toutes les communautés de l'assemblée.
  2. **Charger les présences** – tous les enregistrements de présence de l'assemblée.
  3. **Charger les procurations** – tous les enregistrements de procuration de l'assemblée.
  4. **Construire les correspondances** – entre unités et présences, et entre unités et procurations actives.
  5. **Agréger par communauté** – pour chaque communauté : charger les unités, additionner les parts de propriété, calculer les voix par tête et les quotes-parts de valeur présentes/représentées.
</Steps>

### Statut de présence

Chaque propriétaire reçoit un statut de présence :

| Statut | Signification |
|--------|---------------|
| Présent | Le propriétaire est présent (enregistrement effectué) |
| Représenté | Le propriétaire est représenté par un mandataire |
| Absent | Le propriétaire est absent |

Le résumé par communauté indique : le nombre total de propriétaires, les voix par tête totales, les quotes-parts de valeur totales, les propriétaires présents, les voix par tête présentes, les quotes-parts de valeur présentes, et les pourcentages de présence par tête et par valeur.

### Procurations

Un propriétaire peut mandater une autre personne. Le système vérifie :

- Seul le mandataire peut voter numériquement, pas le mandant.
- La procuration doit couvrir le point de l'ordre du jour.
- Les votes avec mandat doivent correspondre à l'instruction.

## Instantanés de quorum

Lors de l'ouverture d'un point de l'ordre du jour, le système fige la présence et le statut du quorum actuels. L'instantané sert de base de quorum pour ce point.

### Persistance

L'instantané est stocké dans la base de données :

| Champ | Signification |
|------|---------------|
| Point de l'ordre du jour | unique par point de l'ordre du jour |
| Assemblée | l'assemblée concernée |
| Instantané complet | données complètes de l'instantané |
| Moment de l'instantané | moment où l'instantané a été pris |
| Quorum atteint à l'ouverture | l'assemblée était-elle capable de résoudre à l'ouverture ? |

L'instantané survit aux redémarrages du serveur et sert de base au contrôle du quorum lors du vote.

## Types de communauté et standards

### STWEG vs MEG

ResiVote distingue deux types de communauté :

| Type | Signification | Quorum standard (têtes/valeur/min propriétaires) |
|-----|---------------|--------------------------------------------------|
| STWEG | Communauté des propriétaires par étages | 50% / 50% / 2 |
| MEG | Communauté des copropriétaires | 50% / 50% / 1 |

Les standards peuvent être remplacés par les valeurs du règlement lorsqu'elles sont définies.

### Modèles de droit de vote

| Modèle | Description |
|--------|-------------|
| Voix par tête et quotes-parts de valeur | Standard STWEG |
| Uniquement les voix par tête | 1 unité = 1 voix |
| Uniquement les quotes-parts de valeur | — |
| Parts personnalisées | Parts personnalisées par unité (spécifique au MEG) |

### Le MEG hérite des propriétaires du STWEG

Un MEG peut hériter des propriétaires des STWEG associés :

- **Héritage des propriétaires** – pertinent uniquement pour le MEG. Si activé, le MEG ne gère pas ses propres unités/propriétaires, mais les hérite des STWEG associés.
- **Héritage effectif** – se produit si l'héritage est activé **et** que le MEG ne possède pas d'unités propres. Cela évite les doubles comptages.
- **Lien entre communautés** – association entre STWEG et MEG.

Les résultats MEG hérités sont marqués comme tels et ne sont pas comptés double dans le résultat global.

### Ensembles immobiliers

Un ensemble immobilier regroupe plusieurs communautés (STWEG et/ou MEG). Une assemblée peut regrouper plusieurs communautés d'un ensemble immobilier.

## Liens complémentaires

<LinkCard title="Vote" href="/guides/abstimmung/" description="Vote, validation et résultats." />
