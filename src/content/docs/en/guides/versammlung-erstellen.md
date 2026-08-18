---
title: Create a Meeting
description: Create a meeting, define agenda items, and publish — from draft to invitation.
---

import { Steps, Aside, CardGrid, Card } from '@astrojs/starlight/components';

This guide is intended for `tenant_admin` and `meeting_chair`. It describes how to create a meeting in the `DRAFT` state, populate it with agenda items, and ultimately publish it.

## Meeting Lifecycle

Every meeting follows a fixed status workflow. State transitions are validated by the state machine in the backend.

| Status | Meaning |
| --- | --- |
| `DRAFT` | Preparation phase — meeting is not yet visible. |
| `PUBLISHED` | Invitations have been sent. |
| `CHECK_IN` | Check-in phase is open. |
| `IN_PROGRESS` | Meeting is in progress, agenda items are being handled. |
| `CLOSED` | Meeting has been ended. |
| `ARCHIVED` | Meeting is archived. |

Valid transitions: `DRAFT → PUBLISHED`, `PUBLISHED → CHECK_IN`, `CHECK_IN → IN_PROGRESS`, `IN_PROGRESS → CLOSED`, `CLOSED → ARCHIVED`. No further transitions are possible from `ARCHIVED`.

## Meeting Modes

When creating a meeting, you select the meeting mode:

- **`LIVE_MEETING`** – In-person, hybrid, or online meeting in real time. Default value.
- **`CIRCULAR_RESOLUTION`** – Circular resolution (Art. 712m para. 2 ZGB). Requires the fields `circular_voting_start` and `circular_voting_end`. The start must be before the end.

## Create a Meeting

<Steps>

1. **Enter basic data.** Set the title, description, date (`scheduled_at` as an RFC3339 timestamp), and location. The system checks that no other meeting for the same tenant is already scheduled at the chosen time. A unique slug is generated automatically.

2. **Select mode and check-in method.** Set `meeting_mode` to `LIVE_MEETING` or `CIRCULAR_RESOLUTION`. Choose the check-in method (`checkin_method`):
   - `MANUAL` – the chair manually marks present owners (default).
   - `QR_CODE` – owners check themselves in via QR code.
   - `SIGNATURE` – owners sign on the administrator's tablet.

3. **Set live result visibility.** Use `live_results_visible_to` to determine who sees live results during an open vote:
   - `ALL` – all participants see intermediate results (default).
   - `CHAIR` – only `tenant_admin` and `meeting_chair` see live results.

4. **Enable vote confirmation (optional).** Set `require_vote_confirmation` to `true` if owners must explicitly confirm their vote.

5. **Link communities.** Link one or more communities to the meeting. The linking is done via the `meeting_communities` join table and allows multi-community meetings.

</Steps>

## Create Agenda Items

Each agenda item (`AgendaItem`) belongs to a meeting and has the following properties:

- **`order_number`** – order within the meeting.
- **`title`** and **`description`** – name and explanation.
- **`type`** – agenda item type:
  - `MOTION` – yes/no/abstain vote.
  - `ELECTION` – elections; requires the `candidates` field (list of candidate names).
  - `FREE_TEXT` – free-text vote.
  - `PROTOCOL` – assign minute-taker, without a vote.
- **`quorum_type`** – quorum model for this agenda item: `SIMPLE_MAJORITY`, `QUALIFIED_MAJORITY`, `UNANIMOUS`, `ABSOLUTE_MAJORITY`, or `CUSTOM`. For `CUSTOM`, you define `custom_quorum_pct` and optionally `custom_quorum_value_pct`; `custom_quorum_base` determines the basis (`PRESENT` or `ELIGIBLE`).
- **`community_id`** – community reference. An empty value (`nil`) means the agenda item applies to all communities of the meeting. The `AppliesToCommunity` method checks this: if `CommunityID` is not set, the agenda item applies to all.

For `LIVE_MEETING`, the system automatically creates the procedural agenda item "Assign minute-taker" (type `PROTOCOL`, `order_number` 0). As soon as you assign the minute-taker, the system automatically closes this agenda item.

## Configure the Minute-Taker

The minute-taker is set via `protocol_writer_type` and `protocol_writer_owner_id`:

- **`OWNER`** – an owner takes the minutes; `protocol_writer_owner_id` references the owner.
- **`TENANT_ADMIN`** – an administrator takes the minutes.

This configuration is only allowed for `LIVE_MEETING` and can no longer be changed once the meeting is `CLOSED` or `ARCHIVED`.

## Upload Attachments

Attachments can be managed at two levels:

- **Meeting attachments** – general documents for the entire meeting.
- **Agenda item attachments** – documents belonging to a specific agenda item.

Additionally, ResiVote supports online slides for presentations within an agenda item.

## Publish the Meeting

Publishing performs the state transition `DRAFT → PUBLISHED`. The following happens:

1. The state machine validates and sets the status to `PUBLISHED`.
2. The system schedules the email sequence: an immediate invitation and a reminder seven days before the meeting date.
3. Invitations are sent as promptly as possible; if sending fails, the meeting remains published nonetheless.

<Aside type="note" title="Updates">
  Meetings can only be edited in the `DRAFT` or `PUBLISHED` state. As soon as the meeting reaches `CHECK_IN` or a later state, changes to the basic data are locked.
</Aside>

<CardGrid>
  <Card title="Conduct Votes" icon="seti:vote">
    How agenda items are voted on and which voting models apply.
  </Card>
  <Card title="Check-in and Attendance" icon="seti:check">
    How owners become present at the meeting.
  </Card>
</CardGrid>
