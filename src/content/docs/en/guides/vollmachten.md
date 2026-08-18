---
title: Manage Proxies
description: Grant, restrict, and revoke proxies — from full to instructed voting.
---

import { Aside, Steps, CardGrid, Card } from '@astrojs/starlight/components';

This guide describes how proxies (powers of attorney) work in ResiVote. It is intended for `tenant_admin`, `meeting_chair`, and owners.

## Proxy Entity

A proxy (`Proxy`) transfers the voting right for a specific unit and meeting from one owner to another. It consists of the following fields:

- **`grantor_id`** – the grantor (owner granting the proxy).
- **`grantee_id`** – the proxy (owner receiving the proxy).
- **`unit_id`** – the unit for which the proxy applies. Proxies are unique per unit and meeting.
- **`meeting_id`** – the meeting to which the proxy refers.

An owner cannot authorize themselves. Only one active proxy is allowed per unit and meeting.

## Proxy Scope

The scope of a proxy is defined via `scope`:

- **`FULL`** – the proxy applies to the entire meeting. The proxy may vote on all agenda items.
- **`RESTRICTED`** – the proxy is limited to specific agenda items. The `CoversAgendaItem` method checks whether an agenda item is covered: always for `FULL`, for `RESTRICTED` only if an instruction exists for the agenda item.

## Instructed Voting (Instructions)

For restricted proxies, each `ProxyInstruction` defines a mandatory vote for a specific agenda item:

- **`agenda_item_id`** – the agenda item to which the instruction applies.
- **`mandated_vote`** – the prescribed voting option (`YES`, `NO`, `ABSTAIN`, `CANDIDATE`, or `FREE_TEXT`).

<Aside type="warning" title="Binding Instruction">
  An instructed vote is binding. The proxy must vote in accordance with the instruction. The system enforces this at the time of voting.
</Aside>

## Grant a Proxy

<Steps>

1. **Meeting in the correct state.** Proxies can only be created while the meeting has the status `PUBLISHED`, `CHECK_IN`, `IN_PROGRESS`, or `OPEN`. Creation is blocked in `DRAFT`, `CLOSED`, or `ARCHIVED`.

2. **Verify owner and unit.** The system verifies that the grantor actively owns the unit and that the unit belongs to the community scope of the meeting. The proxy must be a legitimate owner in the meeting's communities. For MEG units, MEG delegates without direct ownership in the MEG community may also be authorized as proxies.

3. **Define scope and instructions.** Choose `FULL` or `RESTRICTED`. For `RESTRICTED`, add an instruction per agenda item with the mandated voting option.

4. **Save the proxy.** The system creates the proxy and immediately updates attendance and the live quorum, since the representation changes.

</Steps>

## Revoke a Proxy

A proxy is revoked via `Revoke`. The system sets `revoked_at` to the current time; the `IsActive` method then returns `false`. A revocation also immediately updates attendance and the live quorum.

## Representation During Voting

During voting, the system automatically takes active proxies into account:

- The proxy must be present at the meeting themselves (checked in under any unit) for the representation to count.
- When the proxy votes for a represented unit, `voter_id` is set to the proxy and `proxy_id` references the proxy.
- If the owner is directly present (physical presence), this takes precedence over the proxy — the owner votes themselves.
- The same rules apply to analog voting: if the unit is not checked in but is represented by an active proxy and the proxy is present, the proxy votes.

## Representation at Check-in

Proxies automatically affect attendance. The presence builder marks represented units as `REPRESENTED`, provided the proxy is present somewhere in the meeting. The represented unit is included in head vote and value quota calculations. For details, see the guide <a href="/guides/checkin/">Check-in and Attendance</a>.

<CardGrid>
  <Card title="Check-in and Attendance" icon="seti:check">
    How represented units are recorded at check-in.
  </Card>
  <Card title="Conduct Votes" icon="seti:vote">
    How proxies vote on behalf of represented units.
  </Card>
</CardGrid>
