---
title: How ResiVote Works
description: The workflow of a digital owners' meeting with ResiVote — from draft to archived minutes.
---

import { Steps, Aside, CardGrid, Card, LinkCard } from '@astrojs/starlight/components';

ResiVote guides you from the draft to the signed minutes — all within a single digital space. A meeting follows a defined lifecycle:

Draft → Published → Check-in → In progress → Closed → Archived

In addition to live meetings, ResiVote supports the circular resolution (Art. 712m para. 2 ZGB) as an alternative.

## 1. Prepare the Meeting

The meeting starts in the draft state. The administrator sets the date, time, location, and title.

### Multiple Communities

A meeting can span multiple communities. Communities can be grouped into a development — for example, a STWEG plus an associated MEG in the same meeting.

### Agenda Items

Each agenda item defines:

- **Type** – motion (yes/no/abstain), election, free-text proposal, or protocol (assign minute-taker, without a vote)
- **Quorum** – simple majority, qualified majority, unanimous, absolute majority, or custom with a custom percentage
- **Community** – an empty community reference means "all communities of the meeting"

For details on quorum types, see `/guides/quorum/`.

## 2. Invite Participants

The transition to published sends out the invitations.

### Scheduled Emails

Invitations are persisted as scheduled emails and sent automatically when due. Types include invitation, reminder, and closed notifications. Status transitions from pending to sent (or failed with retry).

### Invitation PDF and Proxy Card

ResiVote generates an invitation PDF and a personalized proxy card for each recipient. Both are sent as attachments.

### Login

Authentication is handled via ZITADEL. Owners log in using their personal link. The mapping of the ZITADEL identity to the owner record happens automatically on first login.

## 3. Conduct the Meeting

The administrator opens the meeting for check-in, then starts it.

### Check-in Methods

The meeting configures a check-in method:

| Method | Process |
|---------|--------|
| Manual | Chair/admin manually marks participants as present (default) |
| QR code | Owners scan a QR code with their smartphone (self-check-in) |
| Signature | Owners select themselves from a dropdown on the admin's tablet and sign digitally; all their own units and proxy units are marked as present |

### Chair Dashboard and Live Minutes

The chair controls the meeting via a dashboard: open/close agenda items, start votes, view live results. The live minutes are maintained in parallel — the minute-taker (an owner or tenant admin) writes notes per agenda item.

### Live Updates

Presence, quorum status, and voting results are pushed to all participants in real time.

## 4. Pass Resolutions

Each agenda item goes through its own lifecycle:

Pending → Presenting → Pre-voting (optional) → Open → Closed (or skipped)

### Casting a Vote

Before each vote, the system checks:

1. Meeting is in progress (or in pre-voting for asynchronous pre-voting)
2. Agenda item is open or in pre-voting
3. Quorum was met when opened — or the chair has granted a quorum override
4. Unit belongs to a community of the meeting
5. Agenda item applies to the unit's community
6. Voter is the primary voter or a proxy
7. If voting by proxy: does the proxy cover the agenda item? Does the vote match the instruction?
8. Check-in required (if pre-check-in is required)

### Head Votes and Value Quotas

Depending on the community's voting rights model, head votes, value quotas, or custom shares are counted. The voting rights cap (Art. 712g ZGB) caps head votes when the regulatory percentage is exceeded.

### Quorum and Results

The quorum engine calculates head votes and value quotas per community, compares them against the threshold, and produces an overall pass/fail result. For details, see `/guides/quorum/`.

### Live Result Visibility

The meeting controls who sees live results: all participants or the chair/admin only.

## 5. Finalize the Minutes

After the last agenda item, the meeting transitions to closed, then to archived.

### Minutes PDF

ResiVote generates the binding minutes with all agenda items, voting results, attendances, and voting rights caps. Procedural protocol agenda items are filtered out. For details, see `/guides/protokoll/`.

### Audit Log and Evidence Package

Every action was logged during the meeting in the audit hash chain. The evidence package exports the complete chain with integrity verification.

### Archiving

After archiving, no further changes are possible. The audit hash chain makes any subsequent manipulation detectable.

<Aside type="note" title="Circular Resolution">
In circular resolution mode, check-in and the live session are omitted. Owners vote asynchronously within a time window. The quorum engine and minutes work analogously.
</Aside>

## Further Reading

<LinkCard title="Minutes and Reports" href="/guides/protokoll/" description="Live minutes, AI suggestions, and PDF reports." />
<LinkCard title="Quorum and Presence" href="/guides/quorum/" description="Resolution capability and quorum calculation." />
<LinkCard title="Users and Permissions" href="/guides/benutzer/" description="Roles, tenants, and access control." />
