---
title: Check-in and Attendance
description: Check-in methods, QR tokens, tablet signatures, and attendance calculation with proxies.
---

import { Steps, Aside, CardGrid, Card } from '@astrojs/starlight/components';

This guide describes how owners become present at a meeting and how ResiVote calculates attendance. It is intended for `tenant_admin`, `meeting_chair`, and owners.

## Check-in Methods

Each meeting defines its check-in method (`checkin_method`). An empty value means `MANUAL`.

| Method | Description |
| --- | --- |
| `MANUAL` | The chair or administrator manually marks present owners. |
| `QR_CODE` | Owners check themselves in by scanning a QR code with their smartphone. |
| `SIGNATURE` | Owners select themselves from a dropdown on the administrator's tablet and sign digitally. |

## Prerequisite: Status CHECK_IN

Check-in requires the meeting to be in the `CHECK_IN` state. When opening the meeting (`PUBLISHED → CHECK_IN`), the system verifies for the `QR_CODE` and `SIGNATURE` methods that check-in is properly configured.

## Manual Check-in

The chair manually records the attendance of a unit. The system creates an `Attendance` record with `method = CHECKIN` and rejects duplicate check-ins with a conflict error.

## QR Code Self-Check-in

<Steps>

1. **Generate QR token.** The administrator generates a signed check-in token for the meeting. The token is an HMAC-signed JWT (HS256) and contains the `meeting_id`, the check-in method, and the tenant slug. The validity period is controlled by the `CHECKIN_TOKEN_EXPIRY` environment variable (default: 30 minutes).

2. **Validate token.** Before login, the frontend can validate the token to resolve the meeting. The token itself does not grant access — the owner must authenticate afterwards.

3. **Perform self-check-in.** The authenticated owner checks in one or more of their units. The system verifies that the owner actively owns the unit (`ValidUntil` is not set) and that the unit is not yet checked in. Already checked-in units are skipped — self-check-in is idempotent.

</Steps>

<Aside type="note" title="Method Check">
  Self-check-in is only allowed if the meeting's check-in method is `QR_CODE` (or empty, which allows self-check-in for backward compatibility).
</Aside>

## Tablet Signature Check-in

The signature check-in runs in two steps on the administrator's tablet:

### Step 1: Retrieve Preview

The `CheckinPreview` shows the owner which units are covered by their signature:

- **Own units** (`own_units`) – all active ownerships within the community scope of the meeting.
- **Represented units** (`proxy_units`) – units for which the owner is the proxy of an active proxy. For each represented unit, the grantor (`proxy_grantor_id`) is shown.
- **Total** – `total_units` and `total_value_quota` sum the covered units and their value quotas.

### Step 2: Capture Signature

The `SignatureCheckIn` method stores the digital signature:

- **`captured_by_id`** – the administrator operating the tablet.
- **`image_data`** – the signature as JPEG or PNG image data.
- **Own units** receive an `Attendance` record with `method = SIGNATURE`.
- **Represented units** do not receive their own attendance. They are automatically marked as represented via the proxy in the presence builder. The `SignatureUnit` join table documents all covered units (own and represented) for audit purposes.

The signature is stored in a separate table (`signatures`) — separate from attendance — so that the image data remains tamper-proof and independently verifiable.

## Attendance Entity

Each attendance (`Attendance`) records when and how a unit was checked in:

- **`owner_id`** – the owner.
- **`unit_id`** – the checked-in unit.
- **`method`** – the check-in method: `CHECKIN` (manual), `SELF_CHECKIN` (QR), `SIGNATURE` (tablet), or `VOTE` (automatic via voting).

A unit is considered present as soon as an `Attendance` record exists.

## Attendance Calculation (Presence Builder)

The presence builder aggregates attendance, proxies, and ownership into community-scoped snapshots (`CommunityPresence`). Per community, it calculates:

- **`total_owners`**, **`total_head_votes`** (number of units), and **`total_value_quota`**.
- **`present_owners`**, **`present_head_votes`**, and **`present_value_quota`**.
- **`presence_head_pct`** and **`presence_value_pct`** – attendance percentages.

Each owner receives a status (`PresenceRecord`):

- **`PRESENT`** – owner is directly checked in.
- **`REPRESENTED`** – owner is represented by an active proxy; `represented_by` references the proxy. Prerequisite: the proxy is present somewhere in the meeting.
- **`ABSENT`** – neither present nor represented.

MEG communities without their own units inherit the units of linked STWEGs, provided `InheritsOwners` is active and the MEG has no own units.

## Automatic Attendance via Voting

Casting a vote implies attendance: if an owner votes without having checked in beforehand, the system automatically creates an `Attendance` record with `method = VOTE`. When voting via a proxy, attendance is set for the proxy.

<CardGrid>
  <Card title="Manage Proxies" icon="seti:doc">
    How represented units are automatically recorded at check-in.
  </Card>
  <Card title="Create a Meeting" icon="seti:settings">
    Configure the check-in method when creating a meeting.
  </Card>
</CardGrid>
