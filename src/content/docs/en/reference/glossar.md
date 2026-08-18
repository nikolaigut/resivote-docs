---
title: Glossary
description: Key terms related to ResiVote and Swiss owners' meetings.
---

import { LinkCard } from '@astrojs/starlight/components';

## Absolute Majority (ABSOLUTE_MAJORITY)

A quorum type requiring YES > 50% of all registered owners (regardless of attendance). Abstentions and absences count as an implicit NO. See [Features — Quorum](../reference/funktionen/#quorum).

## Audit Log

An immutable, chained log of all security-relevant actions. Each entry is hashed with HMAC-SHA-256 (`AUDIT_HASH_KEY`) and chained with the previous entry (hash chain). On tamper detection, the server refuses service (fail-closed). See [Features — Audit Log](../reference/funktionen/#audit-log).

## Check-in

The process by which owners register their attendance at a meeting. Three methods: `MANUAL` (chair marks manually), `QR_CODE` (self-check-in via QR token), `SIGNATURE` (digital signature on tablet). See [Features — Check-in](../reference/funktionen/#check-in).

## DEK (Data Encryption Key)

A tenant-specific AES key that encrypts documents at rest. DEKs are wrapped with the `DOCUMENT_ENCRYPTION_MASTER_KEY` (master key) and stored in the database. See `internal/infrastructure/encryption/tenant_key.go`.

## Simple Majority (SIMPLE_MAJORITY)

A quorum type requiring YES > 50% of the present/represented head votes. Abstentions and uncast votes count as an implicit NO.

## Head-and-Value (HEAD_AND_VALUE)

A voting rights model that considers both head votes and value quotas. Standard for STWEG communities. See [Features — Votes](../reference/funktionen/#abstimmungen-und-beschlüsse).

## IsSuperseded

A flag on vote records (`IsSuperseded`). Votes are immutable — when changed, the old vote is marked as `IsSuperseded=true` and a new vote record is created. `IsActive()` returns `!IsSuperseded`. See `internal/domain/entity/vote.go`.

## Kopfstimme (Head Vote)

The voting principle "one residential unit, one vote." Corresponds to the voting rights model `HEAD_ONLY` or the head vote portion of `HEAD_AND_VALUE`.

## Live Quorum

The real-time calculation of the quorum during a meeting. The `LiveQuorumEngine` calculates presence (present + represented via proxy) and publishes quorum updates via WebSocket. See [Features — Quorum](../reference/funktionen/#quorum).

## Master Key

The `DOCUMENT_ENCRYPTION_MASTER_KEY` — a base64-encoded 32-byte AES key that wraps and unwraps tenant-specific DEKs. See [DEK](#dek-data-encryption-key).

## MEG (Miteigentümergemeinschaft)

A community of co-owners (`CommunityType = "MEG"`). MEG communities can inherit owners from linked STWEGs (`InheritsOwners`) and use custom distribution keys (`CUSTOM_SHARES`).

## MEA (Miteigentumsanteil)

A co-ownership share in a property. The value quota (in thousandths) determines the vote weight in value-quota-dependent votes.

## Miteigentumsanteil

See [MEA](#mea-miteigentumsanteil).

## Präsenz (Presence)

The sum of present owners and owners represented by proxy. The `PresenceBuilder` calculates presence as the basis for the live quorum.

## Pre-Voting

An asynchronous pre-voting phase (`AgendaItemState = "PRE_VOTING"`). Owners can vote in advance; votes receive the `IsPreVote` flag. Pre-voting can be started (`start-pre-voting`) and canceled (`cancel-pre-voting`).

## Qualified Majority (QUALIFIED_MAJORITY)

A quorum type requiring YES > 50% of present/represented owners (heads) AND > 50% of all eligible value quotas (Art. 647b/d/e, Art. 712g para. 3 ZGB).

## Quorum

The required minimum number of voting-eligible participants or the required majority for a meeting to be legally valid or for a resolution to be passed. ResiVote supports five quorum types: `SIMPLE_MAJORITY`, `QUALIFIED_MAJORITY`, `UNANIMOUS`, `ABSOLUTE_MAJORITY`, `CUSTOM`. See [Features — Quorum](../reference/funktionen/#quorum).

## Quorum Override

The ability of the chair to lift the quorum for a specific agenda item (`QuorumOverride = true`). Requires a mandatory reason (`QuorumOverrideReason`). Votes are accepted even if `QuorumMetAtOpen` is false.

## RLS (Row Level Security)

PostgreSQL Row Level Security. The `DBTransactionMiddleware` sets `SET LOCAL app.current_tenant_id` per request, so the database prevents cross-tenant access at the row level (defense-in-depth). Migration `000004` adds `WITH CHECK` clauses to all RLS policies.

## STWEG (Stockwerkeigentümergemeinschaft)

A community of condominium owners (`CommunityType = "STWEG"`). Default voting rights model: `HEAD_AND_VALUE`.

## Voting Rights Cap (Stimmrechtsbegrenzung)

A regulatory configuration (`EnableVotingRightsCap`, `VotingRightsCapPct`) that limits the maximum vote weight of a single owner (cf. Art. 712g ZGB). Not a legal requirement; must be explicitly enabled.

## Tenant (Mandant)

An isolated customer context. Each tenant has its own communities, owners, meetings, and data. Isolation is enforced by RLS at the database level.

## TOP

An **agenda item** or agenda point (`AgendaItem`). Each TOP is discussed and, if necessary, voted on. A TOP has a type (`MOTION`, `ELECTION`, `FREE_TEXT`, `PROTOCOL`) and a state (`PENDING`, `PRESENTING`, `PRE_VOTING`, `OPEN`, `CLOSED`, `SKIPPED`).

## Traktandum

See [TOP](#top).

## Überbauung (Development)

A grouping of multiple communities (STWEG/MEG) under a common development name (`Development` entity). The development tree (`/developments/tree`) shows the hierarchy.

## Unanimous (Einstimmigkeit)

A quorum type requiring 100% of all registered owners (heads) and value quotas to vote YES (Art. 647e ZGB). Absences without a positive proxy count as an implicit NO.

## Versammlung (Meeting)

An owners' meeting (`Meeting`) where participants convene in person, digitally, or in hybrid form to pass resolutions. Modes: `LIVE_MEETING` or `CIRCULAR_RESOLUTION`. See [Features — Digital Meetings](../reference/funktionen/#digitale-versammlungen).

## Vollmacht (Proxy)

The transfer of voting right from an owner (grantor) to a proxy (grantee) for a specific meeting and unit. Scopes: `FULL` (entire meeting) or `RESTRICTED` (specific agenda items). For `RESTRICTED`, `ProxyInstruction` can prescribe a mandatory vote. See [Features — Proxies](../reference/funktionen/#vollmachten).

## WebSocket

A bidirectional communication protocol for live updates. ResiVote uses WebSocket at `/ws/meetings/:meetingId` for live meeting status, voting progress, and quorum updates. Ping/pong cycle: 54s/60s. See [REST API — WebSocket](../reference/api/#websocket-wsmeetingsmeetingid).

## Wertquote (MEA)

The **co-ownership shares** in thousandths that determine the vote weight in value-quota-dependent votes. Corresponds to the voting rights model `VALUE_ONLY` or the value quota portion of `HEAD_AND_VALUE`.

## ZITADEL

The OIDC identity provider for ResiVote. ZITADEL handles authentication, user, and role management. ResiVote validates JWT access tokens against the ZITADEL JWKS. See [Configuration — Auth](../reference/konfiguration/#auth-zitadel).

## Circular Resolution (Zirkularbeschluss, CIRCULAR_RESOLUTION)

A meeting mode for asynchronous resolution without a physical meeting (Art. 712m para. 2 ZGB). Defined by `circular_voting_start` and `circular_voting_end`. See [Features — Digital Meetings](../reference/funktionen/#digitale-versammlungen).

<LinkCard title="Features" href="../reference/funktionen/" description="Detailed feature descriptions." />
<LinkCard title="REST API" href="../reference/api/" description="API endpoints and middlewares." />
