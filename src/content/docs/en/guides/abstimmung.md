---
title: Conduct Votes
description: Open agenda items, vote digitally and by analog means, and manage quorums and live results.
---

import { Steps, Aside, CardGrid, Card, LinkCard } from '@astrojs/starlight/components';

This guide describes the voting process — from opening an agenda item to the result. It is intended for `tenant_admin` and `meeting_chair`.

## Agenda Item Status

Each agenda item goes through its own status workflow, validated by the state machine:

| Status | Meaning |
| --- | --- |
| `PENDING` | Not yet handled. |
| `PRESENTING` | Presentation and discussion phase; no voting. |
| `PRE_VOTING` | Asynchronous pre-voting in progress. |
| `OPEN` | Voting is open. |
| `CLOSED` | Voting completed. |
| `SKIPPED` | Agenda item was skipped. |

Valid transitions: `PENDING → PRESENTING / PRE_VOTING / OPEN / SKIPPED`, `PRESENTING → OPEN / CLOSED / PENDING / SKIPPED`, `PRE_VOTING → PRESENTING / OPEN / PENDING / CLOSED`, `OPEN → CLOSED / PRESENTING / PENDING`. Closed agenda items can be reopened or presented again.

## Vote Types

The vote type is determined by the agenda item type (`type`):

- **`MOTION`** – choice between `YES`, `NO`, and `ABSTAIN`.
- **`ELECTION`** – candidate election; `choice` is `CANDIDATE`, the candidate name is stored in `candidate_name`.
- **`FREE_TEXT`** – free text; `choice` is `FREE_TEXT`, the text in `free_text_value`.

## Voting Rights Models

Each community defines its voting rights model (`voting_rights_model`):

- **`HEAD_AND_VALUE`** – head votes and value quotas (STWEG standard).
- **`HEAD_ONLY`** – head votes only (1 unit = 1 vote).
- **`VALUE_ONLY`** – value quotas only.
- **`CUSTOM_SHARES`** – custom shares per unit (MEG-specific).

### Head Vote and Value Quota

For each vote: **1 unit = 1 head vote** (Art. 712o ZGB). The `head_vote_value` field is always `1`. The value quota (`value_quota`) and any `custom_shares` are captured as a snapshot in the vote record at the time of voting. This keeps the vote traceable even if ownership conditions change later.

## Pre-Voting

For asynchronous voting, an agenda item can be transitioned to the `PRE_VOTING` state. Owners can vote in advance without being present. These votes are marked with `is_pre_vote = true`. When voting closes, they are included in the result. Pre-voting can be reset to `PENDING` at any time; votes already cast are retained but only counted when the agenda item is opened or pre-voting is restarted.

## Digital Voting

<Steps>

1. **Open the agenda item.** The chair opens the agenda item. The system checks resolution capability (quorum) based on current attendance. If the quorum is not met, the system blocks opening — unless the chair has set a quorum override.

2. **Cast a vote.** The owner selects their unit and their voting option. The system automatically creates an attendance record (`Method = VOTE`) if the unit was not yet checked in — casting a vote implies attendance.

3. **Change a vote.** Votes are immutable (audit-safe). When a vote is changed, the system marks the old vote with `is_superseded = true` and creates a new vote record. This keeps every vote change fully traceable.

4. **Close the agenda item.** The chair closes the agenda item. The system calculates the quorum, stores the result (`result_passed`, `result_details`), and stops any presentation timer.

</Steps>

## Analog Voting

Owners who cannot vote digitally are recorded by analog means. The chair enters the vote on their behalf.

- **Single analog vote** – `CastAnalogVote` records a vote for a present unit. If the unit is not checked in but is represented by an active proxy, the proxy votes — provided they are present themselves.
- **Bulk voting** – `CastBulkAnalogVotesRequest` records multiple show-of-hands votes in a single step. All inputs are validated and saved in a single database transaction. If one vote fails, no votes are persisted.

Analog voting is only allowed in the `OPEN` state. Only one active vote is possible per unit; a vote already cast is not overwritten during analog recording.

## Live Results

Live result visibility is controlled by `live_results_visible_to` at the meeting level:

- **`ALL`** – all participants see intermediate results while the vote is open.
- **`CHAIR`** – only `tenant_admin` and `meeting_chair` see live results for open agenda items.

Closed results are visible to all participants. Non-privileged owners see aggregated quorum figures but not the identity of no-voters or abstentions.

## Vote Confirmation

If `require_vote_confirmation` is active, owners must explicitly confirm their vote before it is finally recorded.

## Quorum Override

The chair can lift a quorum block for an agenda item. Setting `quorum_override` to `true` accepts votes even if resolution capability was not met when opening. The `quorum_override_reason` field is mandatory in this case. Every change to the override is logged in the audit log (`QUORUM_OVERRIDE_GRANTED` or `QUORUM_OVERRIDE_REVOKED`).

## Presentation Timer

Each agenda item has a countdown timer for the presentation phase. The `timer_started_at` and `timer_duration_seconds` fields store the start time and duration. This allows clients to synchronize the timer after a WebSocket reconnect or page reload. When the agenda item is closed, the timer is automatically stopped and reset.

<Aside type="note" title="Proxies">
  Proxies can vote on behalf of represented units. For details, see the guide <a href="/guides/vollmachten/">Manage Proxies</a>.
</Aside>

<LinkCard title="Quorum Reference" href="/reference/quorum/" description="Technical details on quorum types and calculation." />
