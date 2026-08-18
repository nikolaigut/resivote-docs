---
title: Quorum e presenza
description: Tipi di quorum, capacità deliberativa, calcolo della presenza e modelli di community in ResiVote.
---

import { Steps, Aside, CardGrid, Card, LinkCard } from '@astrojs/starlight/components';

ResiVote calcola i quorum secondo il diritto immobiliare svizzero (ZGB). La capacità deliberativa viene monitorata in diretta durante l'assemblea e congelata come snapshot all'apertura di un punto all'ordine del giorno.

## Tipi di quorum

Ogni punto all'ordine del giorno definisce il proprio tipo di quorum nel campo `QuorumType` (`internal/domain/entity/agenda_item.go`):

| Tipo | Significato | Base giuridica |
|-----|-------------|-----------------|
| `SIMPLE_MAJORITY` | Sì > 50% dei voti per testa presenti. Astensioni e voti non espressi contano come no implicito. | — |
| `QUALIFIED_MAJORITY` | Sì > 50% dei proprietari presenti (teste) **e** > 50% di **tutte** le quote di valore legittimate. | Art. 647b/d/e, 712g cpv. 3 ZGB |
| `UNANIMOUS` | 100% di **tutti** i proprietari registrati (teste) e quote di valore devono votare sì. Le assenze senza procura positiva contano come no. | Art. 647e ZGB |
| `ABSOLUTE_MAJORITY` | Sì > 50% di **tutti** i proprietari registrati (indipendentemente dalla presenza). | — |
| `CUSTOM` | Sì >= `CustomQuorumPct`% della base configurata. | Regolamento |

### Quorum CUSTOM

Per `CUSTOM` il punto all'ordine del giorno contiene tre campi:

- **`CustomQuorumPct`** – soglia in % (p. es. 66.67)
- **`CustomQuorumValuePct`** – soglia separata opzionale per le quote di valore
- **`CustomQuorumBase`** – `PRESENT` (presenti) o `ELIGIBLE` (tutti i legittimati)

### Override del quorum

Il presidente può revocare un blocco del quorum. Il punto all'ordine del giorno contiene a tal fine:

- **`QuorumOverride`** – `bool`. Se `true`, i voti vengono accettati anche se `QuorumMetAtOpen` è `false`.
- **`QuorumOverrideReason`** – testo di motivazione obbligatorio se `QuorumOverride = true`.

Il `VoteValidator` (`internal/domain/service/vote_validator.go`) verifica al passo 2a: se `QuorumMet` è `nil` (nessuno snapshot), il controllo viene saltato. Se `QuorumMet` è `false` e `QuorumOverride` non è impostato, il voto viene rifiutato con `QuorumNotMet`.

## Motore del quorum

Il `QuorumEngine` (`internal/domain/service/quorum_engine.go`) è il componente centrale per l'analisi delle votazioni. Calcola per ogni comunità un `CommunityQuorumResult` e li aggrega in un `AgendaItemResult`.

### Input

- Punto all'ordine del giorno (`AgendaItem` con `QuorumType`, `CustomQuorumPct` ecc.)
- Comunità dell'assemblea
- Unità e quote di proprietà (`Ownership`)
- Presenze (`Attendance`)
- Procure (`Proxy`)
- Voti espressi (`Vote`)

### Output per comunità

| Campo | Significato |
|------|-------------|
| `YesHeadVotes` / `NoHeadVotes` / `AbstainHeadVotes` | Voti per testa |
| `YesValueQuota` / `NoValueQuota` / `AbstainValueQuota` | Quote di valore |
| `HeadVoteThreshold` / `ValueThreshold` | Voti favorevoli richiesti |
| `HeadVotePassed` / `ValueVotePassed` | Se la soglia è stata raggiunta |
| `Passed` | `*bool` – risultato complessivo (nil per punti all'ordine del giorno informativi) |
| `VotingRightsCapApplied` / `CappedOwners` | Limitazione del diritto di voto applicata |
| `NoVoters` / `AbstainVoters` | Cognomi di chi ha votato no/astenuto (per il verbale) |
| `CandidateTally` / `Winner` | Risultato dell'elezione per `ELECTION` |
| `IsInformational` | Nessun risultato sì/no (p. es. `FREE_TEXT`) |
| `IsInherited` | Risultato MEG ereditato da STWEG collegati |

### Normalizzazione difensiva

Il `QuorumEngine` normalizza gli input in modo difensivo: comunità vuote restituiscono un risultato informativo (`zeroVoterCommunityResult`), i voti mancanti contano come no implicito e gli errori di arrotondamento `float64` vengono assorbiti con un epsilon (1e-9).

### Risultato complessivo

`OverallPassed` è `true` se **tutte** le comunità raggiungono il quorum. I risultati MEG ereditati (`IsInherited`) non vengono contati due volte.

## Servizio quorum in diretta

Il `LiveQuorumEngine` (`internal/domain/service/live_quorum.go`) risponde alla domanda «l'assemblea è capace di deliberare?» in tempo reale, sulla base della presenza attuale – indipendentemente dai voti espressi.

### Capacità deliberativa

L'assemblea è capace di deliberare se **più della metà** dei voti per testa **e** più della metà delle quote di valore sono presenti/rappresentate, più il numero minimo di proprietari. «Più della metà» è una **disuguaglianza rigorosa**: con un numero totale pari N la soglia è `N/2 + 1` (p. es. 4 proprietari → 3 necessari). Esattamente il 50% non basta.

### Modelli di diritto di voto

Quali condizioni si applicano dipende dal `VotingRightsModel` della comunità:

| Modello | Condizione teste | Condizione quote di valore |
|--------|------------------|-----------------------------|
| `HEAD_AND_VALUE` / `CUSTOM_SHARES` | sì | sì |
| `HEAD_ONLY` | sì | saltata |
| `VALUE_ONLY` | saltata | sì |

### Clock iniettabile

`LiveQuorumEngine` accetta un'interfaccia `Clock` (`NewLiveQuorumEngine(clock ...Clock)`). In produzione utilizza `SystemClock`; nei test è possibile iniettare un clock controllabile per generare timestamp deterministici.

### Output

`LiveQuorumState` per comunità:

- `HeadQuorumMet`, `ValueQuorumMet`, `MinOwnersMet`, `OverallQuorumMet`
- `RequiredHeadVotes`, `RequiredValueQuota`
- `MissingHeadVotes`, `MissingValueQuota`, `MissingOwners`

`IsQuorumReached` è `true` se tutte le comunità raggiungono il quorum.

## Calcolo della presenza

Il `presenceBuilder` (`internal/application/presence_builder.go`) raccoglie presenze, procure e quote di proprietà e le aggrega in snapshot `CommunityPresence`. Viene utilizzato congiuntamente da `MeetingService.GetMeetingPresence` e dal `LiveQuorumEngine`, in modo che il quorum in diretta e l'API REST utilizzino la stessa fonte di presenza.

### Svolgimento

<Steps>
  1. **Caricare le comunità** – tutte le comunità dell'assemblea.
  2. **Caricare le presenze** – tutti i record `Attendance` dell'assemblea.
  3. **Caricare le procure** – tutti i record `Proxy` dell'assemblea.
  4. **Costruire le lookup-map** – `UnitID → Attendance` e `UnitID → active Proxy`.
  5. **Aggregare per comunità** – per ogni comunità: caricare le unità, sommare le quote di proprietà, calcolare i voti per testa e le quote di valore presenti/rappresentate.
</Steps>

### Stato di presenza

Ogni proprietario riceve un `PresenceStatus` (`internal/domain/entity/presence.go`):

| Stato | Significato |
|--------|-------------|
| `PRESENT` | Il proprietario è presente (check-in effettuato) |
| `REPRESENTED` | Il proprietario è rappresentato da un mandatario |
| `ABSENT` | Il proprietario è assente |

`CommunityPresence` riassume: `TotalOwners`, `TotalHeadVotes`, `TotalValueQuota`, `PresentOwners`, `PresentHeadVotes`, `PresentValueQuota`, `PresenceHeadPct`, `PresenceValuePct`.

### Procure (Proxy)

Un proprietario può conferire una procura a un'altra persona. Il `VoteValidator` verifica:

- Solo il mandatario (`GranteeID`) può votare digitalmente, non il mandante della procura (`GrantorID`).
- La procura deve coprire il punto all'ordine del giorno (`CoversAgendaItem`).
- Le espressioni di voto con mandato devono corrispondere all'istruzione (`MandatedVote`).

## Snapshot del quorum

All'apertura di un punto all'ordine del giorno, `LiveQuorumEngine.CreateSnapshot` congela la presenza attuale e lo stato del quorum. Lo snapshot serve come base del quorum per questo punto all'ordine del giorno.

### Persistenza

`QuorumSnapshotRecord` (`internal/domain/entity/quorum_snapshot.go`) salva lo snapshot nel database (tabella `quorum_snapshots`):

| Campo | Significato |
|------|-------------|
| `AgendaItemID` | univoco per punto all'ordine del giorno (`uniqueIndex`) |
| `MeetingID` | Assemblea |
| `SnapshotJSON` | snapshot completo come JSONB |
| `SnapshotTakenAt` | istante della fotografia |
| `QuorumMetAtOpen` | l'assemblea era capace di deliberare all'apertura? |

Lo snapshot sopravvive ai riavvii del server ed è la base per il controllo del `VoteValidator`.

## Tipi di community e standard

### STWEG vs MEG

L'entità `Community` (`internal/domain/entity/community.go`) distingue due tipi:

| Tipo | Significato | Quorum standard (teste/valore/proprietari min.) |
|-----|-------------|------------------------------------------------|
| `STWEG` | Comunità dei proprietari per piani | 50% / 50% / 2 |
| `MEG` | Comunità dei comproprietari | 50% / 50% / 1 |

Gli standard vengono impostati in `LiveQuorumEngine.GetQuorumRequirements`. I campi del regolamento (`ReglementHeadQuorumPct`, `ReglementValueQuorumPct`, `ReglementMinOwners`) sovrascrivono gli standard se non sono `NULL`.

### Modelli di diritto di voto

| Modello | Descrizione |
|--------|-------------|
| `HEAD_AND_VALUE` | Voti per testa + quote di valore (standard STWEG) |
| `HEAD_ONLY` | Solo voti per testa (1 unità = 1 voto) |
| `VALUE_ONLY` | Solo quote di valore |
| `CUSTOM_SHARES` | Quote personalizzate per unità (specifico per MEG) |

### Il MEG eredita i proprietari dagli STWEG

Un MEG può ereditare i proprietari dagli STWEG collegati:

- **`InheritsOwners`** – `bool`, rilevante solo per il MEG. Se `true`, il MEG non gestisce unità/proprietari propri, ma li eredita dagli STWEG collegati.
- **`ShouldInheritSTWEGUnits`** – restituisce `true` se il MEG ha `InheritsOwners = true` **e** non possiede unità proprie. Questo impedisce il doppio conteggio.
- **`CommunityLink`** – tabella di join (`community_links`) per la relazione M:N tra STWEG e MEG.

I risultati MEG ereditati vengono marcati nell'`AgendaItemResult` con `IsInherited = true` e non vengono contati due volte in `OverallPassed`.

### Complessi immobiliari (Developments)

L'entità `Development` (`internal/domain/entity/community.go`) raggruppa più comunità (STWEG e/o MEG). Un'assemblea può comprendere più comunità di un complesso immobiliare (`Meeting.Communities` tramite la tabella di join `meeting_communities`).

## Link di approfondimento

<LinkCard title="Votazione" href="/guides/abstimmung/" description="Espressione del voto, validazione e risultati." />
<LinkCard title="Modello dati" href="/reference/datenmodell/" description="Entità e relazioni nel dettaglio." />
