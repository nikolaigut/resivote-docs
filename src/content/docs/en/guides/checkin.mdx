---
title: Check-in and Attendance
description: Check-in methods, QR tokens, tablet signatures, and attendance calculation with proxies.
---

import { Steps, Aside, CardGrid, Card } from '@astrojs/starlight/components';

This guide describes how owners become present at a meeting and how ResiVote calculates attendance. It is intended for tenant administrators, meeting chairs, and owners.

## Check-in Methods

Each meeting defines its check-in method. An empty value means manual.

| Method | Description |
| --- | --- |
| Manual | The chair or administrator manually marks present owners. |
| QR code | Owners check themselves in by scanning a QR code with their smartphone. |
| Signature | Owners select themselves from a dropdown on the administrator's tablet and sign digitally. |

## Prerequisite: Check-in Phase

Check-in requires the meeting to be in the check-in phase. When opening the meeting for check-in, the system verifies for the QR code and signature methods that check-in is properly configured.

## Manual Check-in

The chair manually records the attendance of a unit. The system creates an attendance record and rejects duplicate check-ins with a conflict error.

## QR Code Self-Check-in

<Steps>

1. **Generate QR token.** The administrator generates a signed check-in token for the meeting. The token contains the meeting reference, the check-in method, and the tenant slug. The validity period is configurable (default: 30 minutes).

2. **Validate token.** Before login, the frontend can validate the token to resolve the meeting. The token itself does not grant access — the owner must authenticate afterwards.

3. **Perform self-check-in.** The authenticated owner checks in one or more of their units. The system verifies that the owner actively owns the unit and that the unit is not yet checked in. Already checked-in units are skipped — self-check-in is idempotent.

</Steps>

<Aside type="note" title="Method Check">
  Self-check-in is only allowed if the meeting's check-in method is QR code (or empty, which allows self-check-in for backward compatibility).
</Aside>

## Tablet Signature Check-in

The signature check-in runs in two steps on the administrator's tablet:

### Step 1: Retrieve Preview

The system shows the owner which units are covered by their signature:

- **Own units** – all active ownerships within the community scope of the meeting.
- **Represented units** – units for which the owner is the proxy of an active proxy. For each represented unit, the grantor is shown.
- **Total** – the covered units and their value quotas are summed.

### Step 2: Capture Signature

The system stores the digital signature:

- The administrator operating the tablet is recorded.
- The signature image is stored.
- Own units receive an attendance record with the signature method.
- Represented units do not receive their own attendance. They are automatically marked as represented via the proxy. All covered units (own and represented) are documented for audit purposes.

The signature is stored separately from attendance, so that the image data remains tamper-proof and independently verifiable.

## Attendance

Each attendance records when and how a unit was checked in:

- **Owner** – the owner.
- **Unit** – the checked-in unit.
- **Method** – the check-in method: manual, self-check-in (QR), signature (tablet), or automatic via voting.

A unit is considered present as soon as an attendance record exists.

## Attendance Calculation

The system aggregates attendance, proxies, and ownership into community-scoped snapshots. Per community, it calculates:

- Total owners, total head votes (number of units), and total value quota.
- Present owners, present head votes, and present value quota.
- Attendance percentages for both head votes and value quotas.

Each owner receives a status:

- **Present** – owner is directly checked in.
- **Represented** – owner is represented by an active proxy. Prerequisite: the proxy is present somewhere in the meeting.
- **Absent** – neither present nor represented.

MEG communities without their own units inherit the units of linked STWEGs, provided inheritance is active and the MEG has no own units.

## Automatic Attendance via Voting

Casting a vote implies attendance: if an owner votes without having checked in beforehand, the system automatically creates an attendance record. When voting via a proxy, attendance is set for the proxy.

<CardGrid>
  <Card title="Manage Proxies" icon="seti:doc">
    How represented units are automatically recorded at check-in.
  </Card>
  <Card title="Create a Meeting" icon="seti:settings">
    Configure the check-in method when creating a meeting.
  </Card>
</CardGrid>
