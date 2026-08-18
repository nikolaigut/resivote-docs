---
title: Quorum und Präsenz
description: Quorum-Typen, Beschlussfähigkeit, Präsenz-Berechnung und Community-Modelle in ResiVote.
---

import { Steps, Aside, CardGrid, Card, LinkCard } from '@astrojs/starlight/components';

ResiVote berechnet Quoren nach schweizerischem Immobilienrecht (ZGB). Die Beschlussfähigkeit wird live während der Versammlung verfolgt und beim Öffnen eines Traktandums als Snapshot eingefroren.

## Quorum-Typen

Jedes Traktandum definiert seinen Quorum-Typ im Feld `QuorumType` (`internal/domain/entity/agenda_item.go`):

| Typ | Bedeutung | Rechtsgrundlage |
|-----|-----------|-----------------|
| `SIMPLE_MAJORITY` | Ja > 50% der anwesenden Kopf-Stimmen. Enthaltungen und nicht abgegebene Stimmen zählen als implizites Nein. | — |
| `QUALIFIED_MAJORITY` | Ja > 50% der anwesenden Eigentümer (Köpfe) **und** > 50% **aller** berechtigten Wertquoten. | Art. 647b/d/e, 712g Abs. 3 ZGB |
| `UNANIMOUS` | 100% **aller** registrierten Eigentümer (Köpfe) und Wertquoten müssen Ja stimmen. Absenzen ohne positive Vollmacht zählen als Nein. | Art. 647e ZGB |
| `ABSOLUTE_MAJORITY` | Ja > 50% **aller** registrierten Eigentümer (unabhängig von Anwesenheit). | — |
| `CUSTOM` | Ja >= `CustomQuorumPct`% der konfigurierten Basis. | Reglement |

### CUSTOM-Quorum

Für `CUSTOM` hält das Traktandum drei Felder:

- **`CustomQuorumPct`** – Schwellwert in % (z. B. 66.67)
- **`CustomQuorumValuePct`** – optionaler separater Schwellwert für Wertquoten
- **`CustomQuorumBase`** – `PRESENT` (anwesend) oder `ELIGIBLE` (alle berechtigten)

### Quorum-Override

Der Vorsitzende kann einen Quorum-Block aufheben. Das Traktandum hält dazu:

- **`QuorumOverride`** – `bool`. Wenn `true`, werden Stimmen akzeptiert, auch wenn `QuorumMetAtOpen` `false` ist.
- **`QuorumOverrideReason`** – zwingender Grundtext bei `QuorumOverride = true`.

Der `VoteValidator` (`internal/domain/service/vote_validator.go`) prüft in Schritt 2a: wenn `QuorumMet` `nil` ist (kein Snapshot), wird der Check übersprungen. Wenn `QuorumMet` `false` ist und `QuorumOverride` nicht gesetzt, wird die Stimme mit `QuorumNotMet` abgelehnt.

## Quorum-Engine

Der `QuorumEngine` (`internal/domain/service/quorum_engine.go`) ist die Kernkomponente für die Abstimmungsauswertung. Er berechnet pro Gemeinschaft ein `CommunityQuorumResult` und aggregiert sie zu einem `AgendaItemResult`.

### Eingaben

- Traktandum (`AgendaItem` mit `QuorumType`, `CustomQuorumPct` etc.)
- Gemeinschaften der Versammlung
- Einheiten und Eigentumsanteile (`Ownership`)
- Anwesenheiten (`Attendance`)
- Vollmachten (`Proxy`)
- Abgegebene Stimmen (`Vote`)

### Ausgaben pro Gemeinschaft

| Feld | Bedeutung |
|------|-----------|
| `YesHeadVotes` / `NoHeadVotes` / `AbstainHeadVotes` | Kopf-Stimmen |
| `YesValueQuota` / `NoValueQuota` / `AbstainValueQuota` | Wertquoten |
| `HeadVoteThreshold` / `ValueThreshold` | Erforderliche Ja-Stimmen |
| `HeadVotePassed` / `ValueVotePassed` | Ob Schwellwert erreicht |
| `Passed` | `*bool` – Gesamtergebnis (nil bei informativen Traktanden) |
| `VotingRightsCapApplied` / `CappedOwners` | Stimmrechtsbegrenzung angewendet |
| `NoVoters` / `AbstainVoters` | Nachnamen der Nein/Enthaltung-Stimmenden (für Protokoll) |
| `CandidateTally` / `Winner` | Wahlergebnis bei `ELECTION` |
| `IsInformational` | Kein Ja/Nein-Ergebnis (z. B. `FREE_TEXT`) |
| `IsInherited` | MEG-Ergebnis von verknüpften STWEGs geerbt |

### Defensive Normalisierung

Der `QuorumEngine` normalisiert Eingaben defensiv: leere Gemeinschaften liefern ein informatives Ergebnis (`zeroVoterCommunityResult`), fehlende Stimmen zählen als implizites Nein, und `float64`-Rundungsfehler werden mit einem Epsilon (1e-9) absorbiert.

### Gesamt-Ergebnis

`OverallPassed` ist `true`, wenn **alle** Gemeinschaften das Quorum erreichen. Geerbte MEG-Ergebnisse (`IsInherited`) werden nicht doppelt gezählt.

## Live-Quorum-Service

Der `LiveQuorumEngine` (`internal/domain/service/live_quorum.go`) beantwortet die Frage «ist die Versammlung beschlussfähig?» in Echtzeit, basierend auf aktueller Präsenz – unabhängig von abgegebenen Stimmen.

### Beschlussfähigkeit

Die Versammlung ist beschlussfähig, wenn **mehr als die Hälfte** der Kopf-Stimmen **und** mehr als die Hälfte der Wertquoten anwesend/vertreten sind, plus die Mindestanzahl Eigentümer. «Mehr als die Hälfte» ist eine **strikte** Ungleichung: bei gerader Gesamtzahl N ist der Schwellwert `N/2 + 1` (z. B. 4 Eigentümer → 3 nötig). Exakt 50% reicht nicht.

### Voting-Rights-Modelle

Welche Bedingungen gelten, hängt vom `VotingRightsModel` der Gemeinschaft:

| Modell | Kopf-Bedingung | Wertquoten-Bedingung |
|--------|---------------|---------------------|
| `HEAD_AND_VALUE` / `CUSTOM_SHARES` | ja | ja |
| `HEAD_ONLY` | ja | übersprungen |
| `VALUE_ONLY` | übersprungen | ja |

### Injizierbare Clock

`LiveQuorumEngine` akzeptiert eine `Clock`-Schnittstelle (`NewLiveQuorumEngine(clock ...Clock)`). Im Produktivbetrieb verwendet er `SystemClock`; in Tests kann eine kontrollierbare Clock injiziert werden, um deterministische Zeitstempel zu erzeugen.

### Ausgabe

`LiveQuorumState` pro Gemeinschaft:

- `HeadQuorumMet`, `ValueQuorumMet`, `MinOwnersMet`, `OverallQuorumMet`
- `RequiredHeadVotes`, `RequiredValueQuota`
- `MissingHeadVotes`, `MissingValueQuota`, `MissingOwners`

`IsQuorumReached` ist `true`, wenn alle Gemeinschaften das Quorum erreichen.

## Präsenz-Berechnung

Der `presenceBuilder` (`internal/application/presence_builder.go`) sammelt Anwesenheiten, Vollmachten und Eigentumsanteile und aggregiert sie zu `CommunityPresence`-Snapshots. Er wird von `MeetingService.GetMeetingPresence` und dem `LiveQuorumEngine` gemeinsam genutzt, sodass Live-Quorum und REST-API dieselbe Präsenz-Quelle verwenden.

### Ablauf

<Steps>
  1. **Gemeinschaften laden** – alle Gemeinschaften der Versammlung.
  2. **Anwesenheiten laden** – alle `Attendance`-Records der Versammlung.
  3. **Vollmachten laden** – alle `Proxy`-Records der Versammlung.
  4. **Lookup-Maps bauen** – `UnitID → Attendance` und `UnitID → active Proxy`.
  5. **Pro Gemeinschaft aggregieren** – für jede Gemeinschaft: Einheiten laden, Eigentumsanteile summieren, anwesende/vertretene Kopf-Stimmen und Wertquoten berechnen.
</Steps>

### Präsenz-Status

Jeder Eigentümer erhält einen `PresenceStatus` (`internal/domain/entity/presence.go`):

| Status | Bedeutung |
|--------|-----------|
| `PRESENT` | Eigentümer ist anwesend (Check-in erfolgt) |
| `REPRESENTED` | Eigentümer wird durch einen Bevollmächtigten vertreten |
| `ABSENT` | Eigentümer fehlt |

`CommunityPresence` fasst zusammen: `TotalOwners`, `TotalHeadVotes`, `TotalValueQuota`, `PresentOwners`, `PresentHeadVotes`, `PresentValueQuota`, `PresenceHeadPct`, `PresenceValuePct`.

### Vollmachten (Proxy)

Ein Eigentümer kann eine andere Person bevollmächtigen. Der `VoteValidator` prüft:

- Nur der Bevollmächtigte (`GranteeID`) darf digital abstimmen, nicht der Vollmachtgeber (`GrantorID`).
- Die Vollmacht muss das Traktandum abdecken (`CoversAgendaItem`).
- Mandatierte Stimmabgaben müssen mit der Weisung übereinstimmen (`MandatedVote`).

## Quorum-Snapshots

Beim Öffnen eines Traktandums friert `LiveQuorumEngine.CreateSnapshot` die aktuelle Präsenz und den Quorum-Status ein. Der Snapshot dient als Quorum-Basis für dieses Traktandum.

### Persistenz

`QuorumSnapshotRecord` (`internal/domain/entity/quorum_snapshot.go`) speichert den Snapshot in der Datenbank (Tabelle `quorum_snapshots`):

| Feld | Bedeutung |
|------|-----------|
| `AgendaItemID` | eindeutig pro Traktandum (`uniqueIndex`) |
| `MeetingID` | Versammlung |
| `SnapshotJSON` | vollständiger Snapshot als JSONB |
| `SnapshotTakenAt` | Zeitpunkt der Momentaufnahme |
| `QuorumMetAtOpen` | war die Versammlung beim Öffnen beschlussfähig? |

Der Snapshot überlebt Server-Neustarts und ist die Grundlage für den `VoteValidator`-Check.

## Community-Typen und Standards

### STWEG vs MEG

Die Entität `Community` (`internal/domain/entity/community.go`) unterscheidet zwei Typen:

| Typ | Bedeutung | Standard-Quorum (Kopf/Wert/Min Owners) |
|-----|-----------|---------------------------------------|
| `STWEG` | Stockwerkeigentümergemeinschaft | 50% / 50% / 2 |
| `MEG` | Miteigentümergemeinschaft | 50% / 50% / 1 |

Die Standards werden in `LiveQuorumEngine.GetQuorumRequirements` gesetzt. Reglement-Felder (`ReglementHeadQuorumPct`, `ReglementValueQuorumPct`, `ReglementMinOwners`) überschreiben die Standards, wenn sie nicht `NULL` sind.

### Voting-Rights-Modelle

| Modell | Beschreibung |
|--------|-------------|
| `HEAD_AND_VALUE` | Kopf-Stimmen + Wertquoten (STWEG-Standard) |
| `HEAD_ONLY` | Nur Kopf-Stimmen (1 Einheit = 1 Stimme) |
| `VALUE_ONLY` | Nur Wertquoten |
| `CUSTOM_SHARES` | Benutzerdefinierte Anteile pro Einheit (MEG-spezifisch) |

### MEG erbt Eigentümer von STWEG

Ein MEG kann Eigentümer von verknüpften STWEGs erben:

- **`InheritsOwners`** – `bool`, nur relevant für MEG. Wenn `true`, verwaltet das MEG keine eigenen Einheiten/Eigentümer, sondern erbt sie von verknüpften STWEGs.
- **`ShouldInheritSTWEGUnits`** – gibt `true` zurück, wenn das MEG `InheritsOwners = true` hat **und** keine eigenen Einheiten besitzt. Dies verhindert Doppelzählungen.
- **`CommunityLink`** – Join-Tabelle (`community_links`) für die M:N-Beziehung zwischen STWEGs und MEGs.

Geerbte MEG-Ergebnisse werden im `AgendaItemResult` als `IsInherited = true` markiert und nicht in `OverallPassed` doppelt gezählt.

### Überbauungen (Developments)

Die Entität `Development` (`internal/domain/entity/community.go`) gruppiert mehrere Gemeinschaften (STWEG und/oder MEG). Eine Versammlung kann mehrere Gemeinschaften einer Überbauung umfassen (`Meeting.Communities` via `meeting_communities`-Join-Tabelle).

## Weiterführende Links

<LinkCard title="Abstimmung" href="/guides/abstimmung/" description="Stimmabgabe, Validierung und Ergebnisse." />
<LinkCard title="Datenmodell" href="/reference/datenmodell/" description="Entitäten und Beziehungen im Detail." />
