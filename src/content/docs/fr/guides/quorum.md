---
title: Quorum et présence
description: Types de quorum, capacité de résolution, calcul de présence et modèles de communauté dans ResiVote.
---

import { Steps, Aside, CardGrid, Card, LinkCard } from '@astrojs/starlight/components';

ResiVote calcule les quorums selon le droit immobilier suisse (ZGB). La capacité de résolution est suivie en direct pendant l'assemblée et figée sous forme d'instantané lors de l'ouverture d'un point de l'ordre du jour.

## Types de quorum

Chaque point de l'ordre du jour définit son type de quorum dans le champ `QuorumType` (`internal/domain/entity/agenda_item.go`) :

| Type | Signification | Base juridique |
|-----|---------------|----------------|
| `SIMPLE_MAJORITY` | OUI > 50% des voix par tête présentes. Les abstentions et les votes non émis comptent comme un non implicite. | — |
| `QUALIFIED_MAJORITY` | OUI > 50% des propriétaires présents (têtes) **et** > 50% **de toutes** les quotes-parts de valeur autorisées. | Art. 647b/d/e, 712g al. 3 ZGB |
| `UNANIMOUS` | 100% **de tous** les propriétaires enregistrés (têtes) et quotes-parts de valeur doivent voter OUI. Les absences sans procuration positive comptent comme un non. | Art. 647e ZGB |
| `ABSOLUTE_MAJORITY` | OUI > 50% **de tous** les propriétaires enregistrés (indépendamment de la présence). | — |
| `CUSTOM` | OUI >= `CustomQuorumPct`% de la base configurée. | Règlement |

### Quorum CUSTOM

Pour `CUSTOM`, le point de l'ordre du jour contient trois champs :

- **`CustomQuorumPct`** – seuil en % (p. ex. 66.67)
- **`CustomQuorumValuePct`** – seuil séparé optionnel pour les quotes-parts de valeur
- **`CustomQuorumBase`** – `PRESENT` (présents) ou `ELIGIBLE` (tous les autorisés)

### Override de quorum

Le président peut lever un blocage de quorum. Le point de l'ordre du jour contient pour cela :

- **`QuorumOverride`** – `bool`. Si `true`, les votes sont acceptés même si `QuorumMetAtOpen` est `false`.
- **`QuorumOverrideReason`** – texte de justification obligatoire lorsque `QuorumOverride = true`.

Le `VoteValidator` (`internal/domain/service/vote_validator.go`) vérifie à l'étape 2a : si `QuorumMet` est `nil` (pas d'instantané), le contrôle est ignoré. Si `QuorumMet` est `false` et que `QuorumOverride` n'est pas défini, le vote est rejeté avec `QuorumNotMet`.

## Moteur de quorum

Le `QuorumEngine` (`internal/domain/service/quorum_engine.go`) est la composante centrale de l'évaluation des votes. Il calcule par communauté un `CommunityQuorumResult` et les agrège en un `AgendaItemResult`.

### Entrées

- Point de l'ordre du jour (`AgendaItem` avec `QuorumType`, `CustomQuorumPct` etc.)
- Communautés de l'assemblée
- Unités et parts de propriété (`Ownership`)
- Présences (`Attendance`)
- Procurations (`Proxy`)
- Votes émis (`Vote`)

### Sorties par communauté

| Champ | Signification |
|------|---------------|
| `YesHeadVotes` / `NoHeadVotes` / `AbstainHeadVotes` | Voix par tête |
| `YesValueQuota` / `NoValueQuota` / `AbstainValueQuota` | Quotes-parts de valeur |
| `HeadVoteThreshold` / `ValueThreshold` | Voix OUI requises |
| `HeadVotePassed` / `ValueVotePassed` | Si le seuil est atteint |
| `Passed` | `*bool` – résultat global (nil pour les points informatifs) |
| `VotingRightsCapApplied` / `CappedOwners` | Limitation du droit de vote appliquée |
| `NoVoters` / `AbstainVoters` | Noms des votants non/abstention (pour le procès-verbal) |
| `CandidateTally` / `Winner` | Résultat d'élection pour `ELECTION` |
| `IsInformational` | Pas de résultat OUI/NON (p. ex. `FREE_TEXT`) |
| `IsInherited` | Résultat MEG hérité des STWEG associés |

### Normalisation défensive

Le `QuorumEngine` normalise les entrées de manière défensive : les communautés vides produisent un résultat informatif (`zeroVoterCommunityResult`), les votes manquants comptent comme un non implicite, et les erreurs d'arrondi `float64` sont absorbées par un epsilon (1e-9).

### Résultat global

`OverallPassed` est `true` si **toutes** les communautés atteignent le quorum. Les résultats MEG hérités (`IsInherited`) ne sont pas comptés double.

## Service de quorum en direct

Le `LiveQuorumEngine` (`internal/domain/service/live_quorum.go`) répond à la question « l'assemblée est-elle capable de résoudre ? » en temps réel, sur la base de la présence actuelle – indépendamment des votes émis.

### Capacité de résolution

L'assemblée est capable de résoudre si **plus de la moitié** des voix par tête **et** plus de la moitié des quotes-parts de valeur sont présentes/représentées, plus le nombre minimum de propriétaires. « Plus de la moitié » est une inégalité **stricte** : pour un nombre total pair N, le seuil est `N/2 + 1` (p. ex. 4 propriétaires → 3 nécessaires). Exactement 50% ne suffit pas.

### Modèles de droit de vote

Les conditions applicables dépendent du `VotingRightsModel` de la communauté :

| Modèle | Condition têtes | Condition quotes-parts de valeur |
|--------|-----------------|----------------------------------|
| `HEAD_AND_VALUE` / `CUSTOM_SHARES` | oui | oui |
| `HEAD_ONLY` | oui | ignorée |
| `VALUE_ONLY` | ignorée | oui |

### Horloge injectable

`LiveQuorumEngine` accepte une interface `Clock` (`NewLiveQuorumEngine(clock ...Clock)`). En production, il utilise `SystemClock` ; dans les tests, une horloge contrôlable peut être injectée pour produire des horodatages déterministes.

### Sortie

`LiveQuorumState` par communauté :

- `HeadQuorumMet`, `ValueQuorumMet`, `MinOwnersMet`, `OverallQuorumMet`
- `RequiredHeadVotes`, `RequiredValueQuota`
- `MissingHeadVotes`, `MissingValueQuota`, `MissingOwners`

`IsQuorumReached` est `true` si toutes les communautés atteignent le quorum.

## Calcul de présence

Le `presenceBuilder` (`internal/application/presence_builder.go`) collecte les présences, procurations et parts de propriété et les agrège en instantanés `CommunityPresence`. Il est partagé entre `MeetingService.GetMeetingPresence` et le `LiveQuorumEngine`, de sorte que le quorum en direct et l'API REST utilisent la même source de présence.

### Déroulement

<Steps>
  1. **Charger les communautés** – toutes les communautés de l'assemblée.
  2. **Charger les présences** – tous les enregistrements `Attendance` de l'assemblée.
  3. **Charger les procurations** – tous les enregistrements `Proxy` de l'assemblée.
  4. **Construire les maps de recherche** – `UnitID → Attendance` et `UnitID → active Proxy`.
  5. **Agréger par communauté** – pour chaque communauté : charger les unités, additionner les parts de propriété, calculer les voix par tête et les quotes-parts de valeur présentes/représentées.
</Steps>

### Statut de présence

Chaque propriétaire reçoit un `PresenceStatus` (`internal/domain/entity/presence.go`) :

| Statut | Signification |
|--------|---------------|
| `PRESENT` | Le propriétaire est présent (enregistrement effectué) |
| `REPRESENTED` | Le propriétaire est représenté par un mandataire |
| `ABSENT` | Le propriétaire est absent |

`CommunityPresence` résume : `TotalOwners`, `TotalHeadVotes`, `TotalValueQuota`, `PresentOwners`, `PresentHeadVotes`, `PresentValueQuota`, `PresenceHeadPct`, `PresenceValuePct`.

### Procurations (Proxy)

Un propriétaire peut mandater une autre personne. Le `VoteValidator` vérifie :

- Seul le mandataire (`GranteeID`) peut voter numériquement, pas le mandant (`GrantorID`).
- La procuration doit couvrir le point de l'ordre du jour (`CoversAgendaItem`).
- Les votes avec mandat doivent correspondre à l'instruction (`MandatedVote`).

## Instantanés de quorum

Lors de l'ouverture d'un point de l'ordre du jour, `LiveQuorumEngine.CreateSnapshot` fige la présence et le statut du quorum actuels. L'instantané sert de base de quorum pour ce point.

### Persistance

`QuorumSnapshotRecord` (`internal/domain/entity/quorum_snapshot.go`) stocke l'instantané dans la base de données (table `quorum_snapshots`) :

| Champ | Signification |
|------|---------------|
| `AgendaItemID` | unique par point de l'ordre du jour (`uniqueIndex`) |
| `MeetingID` | Assemblée |
| `SnapshotJSON` | instantané complet en JSONB |
| `SnapshotTakenAt` | moment de l'instantané |
| `QuorumMetAtOpen` | l'assemblée était-elle capable de résoudre à l'ouverture ? |

L'instantané survit aux redémarrages du serveur et sert de base au contrôle du `VoteValidator`.

## Types de communauté et standards

### STWEG vs MEG

L'entité `Community` (`internal/domain/entity/community.go`) distingue deux types :

| Type | Signification | Quorum standard (têtes/valeur/min propriétaires) |
|-----|---------------|--------------------------------------------------|
| `STWEG` | Communauté des propriétaires par étages | 50% / 50% / 2 |
| `MEG` | Communauté des copropriétaires | 50% / 50% / 1 |

Les standards sont définis dans `LiveQuorumEngine.GetQuorumRequirements`. Les champs de règlement (`ReglementHeadQuorumPct`, `ReglementValueQuorumPct`, `ReglementMinOwners`) remplacent les standards lorsqu'ils ne sont pas `NULL`.

### Modèles de droit de vote

| Modèle | Description |
|--------|-------------|
| `HEAD_AND_VALUE` | Voix par tête + quotes-parts de valeur (standard STWEG) |
| `HEAD_ONLY` | Uniquement les voix par tête (1 unité = 1 voix) |
| `VALUE_ONLY` | Uniquement les quotes-parts de valeur |
| `CUSTOM_SHARES` | Parts personnalisées par unité (spécifique au MEG) |

### Le MEG hérite des propriétaires du STWEG

Un MEG peut hériter des propriétaires des STWEG associés :

- **`InheritsOwners`** – `bool`, pertinent uniquement pour le MEG. Si `true`, le MEG ne gère pas ses propres unités/propriétaires, mais les hérite des STWEG associés.
- **`ShouldInheritSTWEGUnits`** – renvoie `true` si le MEG a `InheritsOwners = true` **et** ne possède pas d'unités propres. Cela évite les doubles comptages.
- **`CommunityLink`** – table de jointure (`community_links`) pour la relation M:N entre STWEG et MEG.

Les résultats MEG hérités sont marqués dans `AgendaItemResult` avec `IsInherited = true` et ne sont pas comptés double dans `OverallPassed`.

### Ensembles immobiliers (Developments)

L'entité `Development` (`internal/domain/entity/community.go`) regroupe plusieurs communautés (STWEG et/ou MEG). Une assemblée peut regrouper plusieurs communautés d'un ensemble immobilier (`Meeting.Communities` via la table de jointure `meeting_communities`).

## Liens complémentaires

<LinkCard title="Vote" href="/guides/abstimmung/" description="Vote, validation et résultats." />
<LinkCard title="Modèle de données" href="/reference/datenmodell/" description="Entités et relations en détail." />
