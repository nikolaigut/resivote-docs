---
title: How ResiVote Works
description: The workflow of a digital owners' meeting with ResiVote — from draft to archived minutes.
---

import { Steps, Aside, CardGrid, Card, LinkCard } from '@astrojs/starlight/components';

ResiVote guides you from the draft to the signed minutes — all within a single digital space. A meeting follows a defined state machine (`internal/domain/entity/meeting.go`):

`DRAFT` → `PUBLISHED` → `CHECK_IN` → `IN_PROGRESS` → `CLOSED` → `ARCHIVED`

In addition to live meetings, ResiVote supports the circular resolution (`CIRCULAR_RESOLUTION`, Art. 712m para. 2 ZGB) as an alternative.

## 1. Prepare the Meeting

The meeting starts in the `DRAFT` state. The administrator sets the date, time, location, and title.

### Multiple Communities

A meeting can span multiple communities (`Meeting.Communities` via the `meeting_communities` join table). Communities can be grouped into a development (`Development`) — for example, a STWEG plus an associated MEG in the same meeting.

### Agenda Items

Each agenda item (`AgendaItem`) defines:

- **Type** – `MOTION` (yes/no/abstain), `ELECTION` (election), `FREE_TEXT` (free-text proposal), `PROTOCOL` (assign minute-taker, without a vote)
- **Quorum** – `SIMPLE_MAJORITY`, `QUALIFIED_MAJORITY`, `UNANIMOUS`, `ABSOLUTE_MAJORITY`, or `CUSTOM` with a custom percentage
- **Community** – `CommunityID` = `nil` means "all communities of the meeting"

For details on quorum types, see `/guides/quorum/`.

## 2. Invite Participants

The transition to `PUBLISHED` sends out the invitations.

### Scheduled Emails

Invitations are persisted as `ScheduledEmail` (`internal/domain/entity/scheduled_email.go`). A background worker picks up due entries and sends them. Types: `INVITATION`, `REMINDER`, `CLOSED`. Status: `pending` → `sent` (or `failed`/`dead_letter` with retry).

### Invitation PDF and Proxy Card

The `ReportService` generates an invitation PDF (`GenerateInvitationPDF`) and a personalized proxy card (`GenerateProxyCardPDF`) for each recipient. Both are sent as attachments.

### OIDC Login

Authentication is handled via ZITADEL (OIDC). Owners log in using their personal link. The mapping of ZITADEL identity (`ExternalUserID`/`sub`) to the owner record happens automatically on first login (`LinkAllExternalUsersByEmail`).

## 3. Conduct the Meeting

The administrator opens the meeting (`CHECK_IN`), then starts it (`IN_PROGRESS`).

### Check-in Methods

The meeting configures a `CheckinMethod` (`internal/domain/entity/meeting.go`):

| Method | Process |
|---------|--------|
| `MANUAL` | Chair/admin manually marks participants as present (default) |
| `QR_CODE` | Owners scan a QR code with their smartphone (self-check-in) |
| `SIGNATURE` | Owners select themselves from a dropdown on the admin's tablet and sign digitally; all their own units and proxy units are marked as present |

### Chair Dashboard and Live Minutes

The chair (`meeting_chair`) controls the meeting via a dashboard: open/close agenda items, start votes, view live results. The live minutes are maintained in parallel — the minute-taker (`OWNER` or `TENANT_ADMIN`) writes notes per agenda item.

### WebSocket Live Updates

Presence, quorum status, and voting results are pushed to all participants in real time via WebSocket. The `presenceBuilder` (`internal/application/presence_builder.go`) is connected to the WebSocket hub and broadcasts presence changes immediately.

## 4. Pass Resolutions

Each agenda item goes through states (`internal/domain/entity/agenda_item.go`):

`PENDING` → `PRESENTING` → `PRE_VOTING` (optional) → `OPEN` → `CLOSED` (or `SKIPPED`)

### Casting a Vote

The `VoteValidator` (`internal/domain/service/vote_validator.go`) checks before each vote:

1. Meeting is `IN_PROGRESS` (or `PRE_VOTING` for asynchronous pre-voting)
2. Agenda item is `OPEN` or `PRE_VOTING`
3. Quorum was met when opened — or the chair has granted a `QuorumOverride`
4. Unit belongs to a community of the meeting
5. Agenda item applies to the unit's community
6. Voter is the primary voter (`PrimaryOwnership`) or a proxy (`Proxy.GranteeID`)
7. If voting by proxy: does the proxy cover the agenda item? Does the vote match the instruction?
8. Check-in required (if `RequirePreCheckin`)

### Head Votes and Value Quotas

Depending on the community's `VotingRightsModel`, head votes (`HEAD_AND_VALUE`, `HEAD_ONLY`), value quotas (`HEAD_AND_VALUE`, `VALUE_ONLY`), or custom shares (`CUSTOM_SHARES`) are counted. The voting rights cap (`EnableVotingRightsCap`, Art. 712g ZGB) caps head votes when the regulatory percentage is exceeded.

### Quorum Engine and Results

The `QuorumEngine` (`internal/domain/service/quorum_engine.go`) calculates head votes and value quotas per community, compares them against the threshold, and produces an `AgendaItemResult` with `OverallPassed`. For details, see `/guides/quorum/`.

### Live Result Visibility

`LiveResultsVisibleTo` controls who sees live results: `ALL` (all participants) or `CHAIR` (chair/admin only).

## 5. Finalize the Minutes

After the last agenda item, the meeting transitions to `CLOSED`, then to `ARCHIVED`.

### Minutes PDF

`GenerateMeetingProtocolPDF` generates the binding minutes with all agenda items, voting results, attendances, and voting rights caps. Procedural `PROTOCOL` agenda items are filtered out. For details, see `/guides/protokoll/`.

### Audit Log and Evidence Package

Every action was logged during the meeting in the audit hash chain (`AuditEntry`, SHA-256/HMAC). The evidence package (`GenerateMeetingEvidencePDF`/`-JSON`) exports the complete chain with integrity verification. For details, see `/reference/sicherheit/`.

### Archiving

After `ARCHIVED`, no further changes are possible. The audit hash chain makes any subsequent manipulation detectable.

<Aside type="note" title="Circular Resolution">
In `CIRCULAR_RESOLUTION` mode, check-in and the live session are omitted. Owners vote asynchronously within a time window (`CircularVotingStart`/`CircularVotingEnd`). The quorum engine and minutes work analogously.
</Aside>

## Further Reading

<LinkCard title="Minutes and Reports" href="/guides/protokoll/" description="Live minutes, AI suggestions, and PDF reports." />
<LinkCard title="Quorum and Presence" href="/guides/quorum/" description="Resolution capability and quorum calculation." />
<LinkCard title="Users and Permissions" href="/guides/benutzer/" description="Roles, tenants, and access control." />
