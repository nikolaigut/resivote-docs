---
title: Quorum and Presence
description: Quorum types, resolution capability, presence calculation, and community models in ResiVote.
---

import { Steps, Aside, CardGrid, Card, LinkCard } from '@astrojs/starlight/components';

ResiVote calculates quorums according to Swiss property law (ZGB). Resolution capability is tracked live during the meeting and frozen as a snapshot when an agenda item is opened.

## Quorum Types

Each agenda item defines its quorum type in the `QuorumType` field (`internal/domain/entity/agenda_item.go`):

| Type | Meaning | Legal Basis |
|-----|-----------|-----------------|
| `SIMPLE_MAJORITY` | Yes > 50% of present head votes. Abstentions and uncast votes count as implicit no. | — |
| `QUALIFIED_MAJORITY` | Yes > 50% of present owners (heads) **and** > 50% of **all** eligible value quotas. | Art. 647b/d/e, 712g para. 3 ZGB |
| `UNANIMOUS` | 100% of **all** registered owners (heads) and value quotas must vote yes. Absences without a positive proxy count as no. | Art. 647e ZGB |
| `ABSOLUTE_MAJORITY` | Yes > 50% of **all** registered owners (regardless of attendance). | — |
| `CUSTOM` | Yes >= `CustomQuorumPct`% of the configured basis. | Regulations |

### CUSTOM Quorum

For `CUSTOM`, the agenda item holds three fields:

- **`CustomQuorumPct`** – threshold in % (e.g. 66.67)
- **`CustomQuorumValuePct`** – optional separate threshold for value quotas
- **`CustomQuorumBase`** – `PRESENT` (present) or `ELIGIBLE` (all eligible)

### Quorum Override

The chair can lift a quorum block. The agenda item holds:

- **`QuorumOverride`** – `bool`. When `true`, votes are accepted even if `QuorumMetAtOpen` is `false`.
- **`QuorumOverrideReason`** – mandatory reason text when `QuorumOverride = true`.

The `VoteValidator` (`internal/domain/service/vote_validator.go`) checks in step 2a: if `QuorumMet` is `nil` (no snapshot), the check is skipped. If `QuorumMet` is `false` and `QuorumOverride` is not set, the vote is rejected with `QuorumNotMet`.

## Quorum Engine

The `QuorumEngine` (`internal/domain/service/quorum_engine.go`) is the core component for vote evaluation. It calculates a `CommunityQuorumResult` per community and aggregates them into an `AgendaItemResult`.

### Inputs

- Agenda item (`AgendaItem` with `QuorumType`, `CustomQuorumPct`, etc.)
- Communities of the meeting
- Units and ownership shares (`Ownership`)
- Attendances (`Attendance`)
- Proxies (`Proxy`)
- Cast votes (`Vote`)

### Outputs per Community

| Field | Meaning |
|------|-----------|
| `YesHeadVotes` / `NoHeadVotes` / `AbstainHeadVotes` | Head votes |
| `YesValueQuota` / `NoValueQuota` / `AbstainValueQuota` | Value quotas |
| `HeadVoteThreshold` / `ValueThreshold` | Required yes votes |
| `HeadVotePassed` / `ValueVotePassed` | Whether threshold was met |
| `Passed` | `*bool` – overall result (nil for informational agenda items) |
| `VotingRightsCapApplied` / `CappedOwners` | Voting rights cap applied |
| `NoVoters` / `AbstainVoters` | Last names of no/abstain voters (for minutes) |
| `CandidateTally` / `Winner` | Election result for `ELECTION` |
| `IsInformational` | No yes/no result (e.g. `FREE_TEXT`) |
| `IsInherited` | MEG result inherited from linked STWEGs |

### Defensive Normalization

The `QuorumEngine` normalizes inputs defensively: empty communities produce an informational result (`zeroVoterCommunityResult`), missing votes count as implicit no, and `float64` rounding errors are absorbed with an epsilon (1e-9).

### Overall Result

`OverallPassed` is `true` when **all** communities meet the quorum. Inherited MEG results (`IsInherited`) are not double-counted.

## Live Quorum Service

The `LiveQuorumEngine` (`internal/domain/service/live_quorum.go`) answers the question "is the meeting capable of passing resolutions?" in real time, based on current presence — independent of cast votes.

### Resolution Capability

The meeting is capable of passing resolutions when **more than half** of the head votes **and** more than half of the value quotas are present/represented, plus the minimum number of owners. "More than half" is a **strict** inequality: for an even total N, the threshold is `N/2 + 1` (e.g. 4 owners → 3 required). Exactly 50% is not sufficient.

### Voting Rights Models

Which conditions apply depends on the community's `VotingRightsModel`:

| Model | Head Condition | Value Quota Condition |
|--------|---------------|---------------------|
| `HEAD_AND_VALUE` / `CUSTOM_SHARES` | yes | yes |
| `HEAD_ONLY` | yes | skipped |
| `VALUE_ONLY` | skipped | yes |

### Injectable Clock

`LiveQuorumEngine` accepts a `Clock` interface (`NewLiveQuorumEngine(clock ...Clock)`). In production it uses `SystemClock`; in tests, a controllable clock can be injected to produce deterministic timestamps.

### Output

`LiveQuorumState` per community:

- `HeadQuorumMet`, `ValueQuorumMet`, `MinOwnersMet`, `OverallQuorumMet`
- `RequiredHeadVotes`, `RequiredValueQuota`
- `MissingHeadVotes`, `MissingValueQuota`, `MissingOwners`

`IsQuorumReached` is `true` when all communities meet the quorum.

## Presence Calculation

The `presenceBuilder` (`internal/application/presence_builder.go`) collects attendances, proxies, and ownership shares and aggregates them into `CommunityPresence` snapshots. It is shared between `MeetingService.GetMeetingPresence` and the `LiveQuorumEngine`, so live quorum and REST API use the same presence source.

### Process

<Steps>
  1. **Load communities** – all communities of the meeting.
  2. **Load attendances** – all `Attendance` records of the meeting.
  3. **Load proxies** – all `Proxy` records of the meeting.
  4. **Build lookup maps** – `UnitID → Attendance` and `UnitID → active Proxy`.
  5. **Aggregate per community** – for each community: load units, sum ownership shares, calculate present/represented head votes and value quotas.
</Steps>

### Presence Status

Each owner receives a `PresenceStatus` (`internal/domain/entity/presence.go`):

| Status | Meaning |
|--------|-----------|
| `PRESENT` | Owner is present (check-in completed) |
| `REPRESENTED` | Owner is represented by a proxy |
| `ABSENT` | Owner is absent |

`CommunityPresence` summarizes: `TotalOwners`, `TotalHeadVotes`, `TotalValueQuota`, `PresentOwners`, `PresentHeadVotes`, `PresentValueQuota`, `PresenceHeadPct`, `PresenceValuePct`.

### Proxies

An owner can authorize another person as a proxy. The `VoteValidator` checks:

- Only the proxy (`GranteeID`) may vote digitally, not the grantor (`GrantorID`).
- The proxy must cover the agenda item (`CoversAgendaItem`).
- Instructed votes must match the instruction (`MandatedVote`).

## Quorum Snapshots

When an agenda item is opened, `LiveQuorumEngine.CreateSnapshot` freezes the current presence and quorum status. The snapshot serves as the quorum basis for that agenda item.

### Persistence

`QuorumSnapshotRecord` (`internal/domain/entity/quorum_snapshot.go`) stores the snapshot in the database (table `quorum_snapshots`):

| Field | Meaning |
|------|-----------|
| `AgendaItemID` | unique per agenda item (`uniqueIndex`) |
| `MeetingID` | Meeting |
| `SnapshotJSON` | complete snapshot as JSONB |
| `SnapshotTakenAt` | time of the snapshot |
| `QuorumMetAtOpen` | was the meeting capable of passing resolutions when opened? |

The snapshot survives server restarts and is the basis for the `VoteValidator` check.

## Community Types and Standards

### STWEG vs MEG

The `Community` entity (`internal/domain/entity/community.go`) distinguishes two types:

| Type | Meaning | Default Quorum (Head/Value/Min Owners) |
|-----|-----------|---------------------------------------|
| `STWEG` | Condominium owners' association | 50% / 50% / 2 |
| `MEG` | Co-owners' association | 50% / 50% / 1 |

The defaults are set in `LiveQuorumEngine.GetQuorumRequirements`. Regulation fields (`ReglementHeadQuorumPct`, `ReglementValueQuorumPct`, `ReglementMinOwners`) override the defaults when they are not `NULL`.

### Voting Rights Models

| Model | Description |
|--------|-------------|
| `HEAD_AND_VALUE` | Head votes + value quotas (STWEG standard) |
| `HEAD_ONLY` | Head votes only (1 unit = 1 vote) |
| `VALUE_ONLY` | Value quotas only |
| `CUSTOM_SHARES` | Custom shares per unit (MEG-specific) |

### MEG Inherits Owners from STWEG

A MEG can inherit owners from linked STWEGs:

- **`InheritsOwners`** – `bool`, only relevant for MEG. When `true`, the MEG does not manage its own units/owners but inherits them from linked STWEGs.
- **`ShouldInheritSTWEGUnits`** – returns `true` if the MEG has `InheritsOwners = true` **and** no own units. This prevents double counting.
- **`CommunityLink`** – join table (`community_links`) for the M:N relationship between STWEGs and MEGs.

Inherited MEG results are marked in `AgendaItemResult` with `IsInherited = true` and are not double-counted in `OverallPassed`.

### Developments

The `Development` entity (`internal/domain/entity/community.go`) groups multiple communities (STWEG and/or MEG). A meeting can span multiple communities of a development (`Meeting.Communities` via the `meeting_communities` join table).

## Further Reading

<LinkCard title="Voting" href="/guides/abstimmung/" description="Casting votes, validation, and results." />
<LinkCard title="Data Model" href="/reference/datenmodell/" description="Entities and relationships in detail." />
