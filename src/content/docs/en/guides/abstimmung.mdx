---
title: Conduct Votes
description: Open agenda items, vote digitally and by analog means, and manage quorums and live results.
---

import { Steps, Aside, CardGrid, Card, LinkCard } from '@astrojs/starlight/components';

This guide describes the voting process — from opening an agenda item to the result. It is intended for tenant administrators and meeting chairs.

## Agenda Item Status

Each agenda item goes through its own status workflow, validated by the backend:

| Status | Meaning |
| --- | --- |
| Pending | Not yet handled. |
| Presenting | Presentation and discussion phase; no voting. |
| Pre-voting | Asynchronous pre-voting in progress. |
| Open | Voting is open. |
| Closed | Voting completed. |
| Skipped | Agenda item was skipped. |

Valid transitions: Pending → Presenting / Pre-voting / Open / Skipped, Presenting → Open / Closed / Pending / Skipped, Pre-voting → Presenting / Open / Pending / Closed, Open → Closed / Presenting / Pending. Closed agenda items can be reopened or presented again.

## Vote Types

The vote type is determined by the agenda item type:

- **Motion** – choice between yes, no, and abstain.
- **Election** – candidate election; the candidate name is stored with the vote.
- **Free text** – free text; the text is stored with the vote.

## Voting Rights Models

Each community defines its voting rights model:

- **Head and value** – head votes and value quotas (STWEG standard).
- **Head only** – head votes only (1 unit = 1 vote).
- **Value only** – value quotas only.
- **Custom shares** – custom shares per unit (MEG-specific).

### Head Vote and Value Quota

For each vote: **1 unit = 1 head vote** (Art. 712o ZGB). The value quota and any custom shares are captured as a snapshot in the vote record at the time of voting. This keeps the vote traceable even if ownership conditions change later.

## Pre-Voting

For asynchronous voting, an agenda item can be transitioned to the pre-voting state. Owners can vote in advance without being present. These votes are marked as pre-votes. When voting closes, they are included in the result. Pre-voting can be reset to pending at any time; votes already cast are retained but only counted when the agenda item is opened or pre-voting is restarted.

## Digital Voting

<Steps>

1. **Open the agenda item.** The chair opens the agenda item. The system checks resolution capability (quorum) based on current attendance. If the quorum is not met, the system blocks opening — unless the chair has set a quorum override.

2. **Cast a vote.** The owner selects their unit and their voting option. The system automatically creates an attendance record if the unit was not yet checked in — casting a vote implies attendance.

3. **Change a vote.** Votes are immutable (audit-safe). When a vote is changed, the system marks the old vote as superseded and creates a new vote record. This keeps every vote change fully traceable.

4. **Close the agenda item.** The chair closes the agenda item. The system calculates the quorum, stores the result, and stops any presentation timer.

</Steps>

## Analog Voting

Owners who cannot vote digitally are recorded by analog means. The chair enters the vote on their behalf.

- **Single analog vote** – records a vote for a present unit. If the unit is not checked in but is represented by an active proxy, the proxy votes — provided they are present themselves.
- **Bulk voting** – records multiple show-of-hands votes in a single step. All inputs are validated and saved atomically. If one vote fails, no votes are persisted.

Analog voting is only allowed in the open state. Only one active vote is possible per unit; a vote already cast is not overwritten during analog recording.

## Live Results

Live result visibility is controlled at the meeting level:

- **All** – all participants see intermediate results while the vote is open.
- **Chair only** – only tenant administrators and meeting chairs see live results for open agenda items.

Closed results are visible to all participants. Non-privileged owners see aggregated quorum figures but not the identity of no-voters or abstentions.

## Vote Confirmation

If vote confirmation is active, owners must explicitly confirm their vote before it is finally recorded.

## Quorum Override

The chair can lift a quorum block for an agenda item. Setting a quorum override accepts votes even if resolution capability was not met when opening. A reason is mandatory in this case. Every change to the override is logged in the audit log.

## Presentation Timer

Each agenda item has a countdown timer for the presentation phase. This allows clients to synchronize the timer after a reconnection or page reload. When the agenda item is closed, the timer is automatically stopped and reset.

<Aside type="note" title="Proxies">
  Proxies can vote on behalf of represented units. For details, see the guide <a href="/guides/vollmachten/">Manage Proxies</a>.
</Aside>
