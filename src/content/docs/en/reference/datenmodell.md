---
title: Data Model
description: Reference documentation of the ResiVote entities, relationships, and database migrations.
---

import { Aside, LinkCard } from '@astrojs/starlight/components';

ResiVote manages 31 entities in `internal/domain/entity/`. All tenant-scoped entities carry a `TenantID` field (UUID), which uses PostgreSQL Row-Level Security (RLS) for isolation. The migrations are in the `migrations/` directory and applied with `golang-migrate`.

## Core Entities

### Tenant

Isolated property management organization. Each tenant manages its own communities, owners, and meetings.

| Field | Type | Description |
|---|---|---|
| `ID` | UUID | Primary key |
| `Name` | string | Display name |
| `Slug` | string (max 12) | Unique slug, e.g. `mueller-hv` |
| `IsActive` | bool | Active status |
| `PortalEnabled` | bool | Customer portal enabled |
| `MeetingEnabled` | bool | Digital meeting feature enabled |
| `EncryptedDEK` | *string | Base64-encrypted Data Encryption Key (AES-GCM) |
| `DEKKeyVersion` | int | Key version |
| `InvoiceSenderName/Street/City/VatNumber/QrIban` | string | Invoice sender overrides |

### Community

Represents a STWEG (condominium owners' association) or MEG (co-owners' association).

| Field | Type | Description |
|---|---|---|
| `ID` | UUID | Primary key |
| `TenantID` | UUID | Tenant assignment (FK) |
| `Name` | string | Community name |
| `Type` | CommunityType | `STWEG` or `MEG` |
| `VotingRightsModel` | VotingRightsModel | `HEAD_AND_VALUE`, `HEAD_ONLY`, `VALUE_ONLY`, `CUSTOM_SHARES` |
| `TotalValueQuota` | int | Sum of all value quotas (e.g. 1000 for thousandths) |
| `EnableVotingRightsCap` | bool | Voting rights cap enabled (Art. 712g ZGB) |
| `VotingRightsCapPct` | float64 | Maximum voting rights share in percent |
| `ReglementHeadQuorumPct` | *float64 | Regulation override head quorum |
| `ReglementValueQuorumPct` | *float64 | Regulation override value quorum |
| `ReglementMinOwners` | *int | Regulation override minimum owners |
| `InheritsOwners` | bool | MEG inherits owners from linked STWEGs |
| `DevelopmentID` | *uuid.UUID | Optional grouping under a development |

### Development (Überbauung)

Groups one or more communities (STWEG and/or MEG).

| Field | Type | Description |
|---|---|---|
| `ID` | UUID | Primary key |
| `TenantID` | UUID | Tenant assignment |
| `Name` | string | Development name |
| `Address` | string | Address |

### CommunityLink

M:N join table between STWEGs and MEGs.

| Field | Type | Description |
|---|---|---|
| `STWEGID` | UUID | FK to Community (STWEG) |
| `MEGID` | UUID | FK to Community (MEG) |
| `TenantID` | UUID | Tenant assignment |

### Unit

Individual property unit within a community.

| Field | Type | Description |
|---|---|---|
| `ID` | UUID | Primary key |
| `CommunityID` | UUID | FK to Community |
| `Designation` | string | Designation, e.g. "Apartment 3rd floor left" |
| `UnitNumber` | string | Unit number, e.g. "301" |
| `ValueQuota` | int | Value quota in thousandths (STWEG) |
| `CustomShares` | int | Custom shares (MEG) |
| `HeadVoteCount` | int | Display-only; quorum engine always uses 1 (Art. 712o ZGB) |
| `ValidFrom` | time.Time | Valid from |
| `ValidUntil` | *time.Time | Valid until (optional) |
| `LandRegistryNumber` | string | Land registry number |
| `LandRegistryOffice` | string | Land registry office/district |

### Owner

Owner within a tenant. An owner can own units in multiple communities, but only within the same tenant.

| Field | Type | Description |
|---|---|---|
| `ID` | UUID | Primary key |
| `TenantID` | UUID | Tenant assignment |
| `ExternalUserID` | string | Global user identity (ZITADEL sub) |
| `UserID` | *uuid.UUID | Optional FK to `users` table |
| `FirstName` / `LastName` | string | Name |
| `Email` | string | Email |
| `IsArchived` | bool | Archived |
| `ArchivedAt` | *time.Time | Archival timestamp |

### Ownership

M:N relationship between owner and unit. Supports co-ownership with fractions.

| Field | Type | Description |
|---|---|---|
| `UnitID` | UUID | FK to Unit |
| `OwnerID` | UUID | FK to Owner |
| `ShareNumerator` | int | Numerator, e.g. 1 |
| `ShareDenominator` | int | Denominator, e.g. 2 → 50% |
| `IsPrimaryVoter` | bool | Primary voter for co-ownership |
| `ValidFrom` | time.Time | Valid from |
| `ValidUntil` | *time.Time | Valid until |

## Meeting and Voting

### Meeting

Meeting that can span multiple communities.

| Field | Type | Description |
|---|---|---|
| `ID` | UUID | Primary key |
| `TenantID` | UUID | Tenant assignment |
| `Slug` | string (max 12) | Unique slug per tenant |
| `Title` | string | Title |
| `State` | MeetingState | `DRAFT`, `PUBLISHED`, `CHECK_IN`, `IN_PROGRESS`, `CLOSED`, `ARCHIVED` |
| `Mode` | MeetingMode | `LIVE_MEETING` or `CIRCULAR_RESOLUTION` (Art. 712m para. 2 ZGB) |
| `ScheduledAt` | time.Time | Scheduled date |
| `CheckinMethod` | *CheckinMethod | `MANUAL`, `QR_CODE`, `SIGNATURE` |
| `ProtocolWriterType` | *ProtocolWriterType | `OWNER` or `TENANT_ADMIN` |
| `LiveResultsVisibleTo` | *LiveResultsVisibility | `ALL` or `CHAIR` |
| `RequireVoteConfirmation` | bool | Vote confirmation required |

**M:N relationship:** `MeetingCommunity` (join table `meeting_communities`) links meetings to multiple communities.

### AgendaItem

Agenda item within a meeting.

| Field | Type | Description |
|---|---|---|
| `MeetingID` | UUID | FK to Meeting |
| `CommunityID` | *uuid.UUID | NULL = all communities of the meeting |
| `OrderNumber` | int | Order |
| `Type` | AgendaItemType | `MOTION`, `ELECTION`, `FREE_TEXT`, `PROTOCOL` |
| `State` | AgendaItemState | `PENDING`, `PRESENTING`, `PRE_VOTING`, `OPEN`, `CLOSED`, `SKIPPED` |
| `QuorumType` | QuorumType | `SIMPLE_MAJORITY`, `QUALIFIED_MAJORITY`, `UNANIMOUS`, `ABSOLUTE_MAJORITY`, `CUSTOM` |
| `CustomQuorumPct` | *float64 | Custom quorum percentage |
| `Candidates` | pq.StringArray | Candidates for ELECTION |
| `QuorumOverride` | bool | Chair can lift quorum block |
| `QuorumOverrideReason` | string | Reason (mandatory for override) |
| `TimerStartedAt` | *time.Time | Presentation timer start |
| `TimerDurationSeconds` | int | Timer duration |

### Vote

Individual vote per unit per agenda item. **Immutable** — when changed, the old vote is marked as `IsSuperseded=true` and a new vote is created.

| Field | Type | Description |
|---|---|---|
| `AgendaItemID` | UUID | FK to AgendaItem |
| `UnitID` | UUID | FK to Unit |
| `VoterID` | UUID | Owner who voted |
| `ProxyID` | *uuid.UUID | When voting via proxy |
| `Choice` | VoteChoice | `YES`, `NO`, `ABSTAIN`, `CANDIDATE`, `FREE_TEXT` |
| `CandidateName` | *string | For ELECTION |
| `FreeTextValue` | *string | For FREE_TEXT |
| `HeadVoteValue` | int | Default 1 (Art. 712o ZGB) |
| `ValueQuota` | int | Snapshot of unit value quota at voting time |
| `CustomShares` | int | Snapshot of custom shares |
| `IsPreVote` | bool | Vote from PRE_VOTING phase |
| `IsSuperseded` | bool | Replaced by a newer vote |

### QuorumSnapshot

Freezes the attendance/quorum state when an agenda item is opened. Survives server restarts.

| Field | Type | Description |
|---|---|---|
| `AgendaItemID` | UUID | Unique per agenda item |
| `SnapshotJSON` | json.RawMessage | Complete quorum snapshot as JSONB |
| `QuorumMetAtOpen` | bool | Quorum was met when opened |

## Proxy and Attendance

### Proxy

Proxy from one owner to another for a meeting and a unit.

| Field | Type | Description |
|---|---|---|
| `MeetingID` | UUID | FK to Meeting |
| `GrantorID` | UUID | Owner granting the proxy |
| `GranteeID` | UUID | Owner receiving the proxy |
| `UnitID` | UUID | Affected unit |
| `Scope` | ProxyScope | `FULL` (entire meeting) or `RESTRICTED` (specific agenda items) |
| `RevokedAt` | *time.Time | Revocation timestamp |

### ProxyInstruction

Mandatory voting instruction for a proxy.

| Field | Type | Description |
|---|---|---|
| `ProxyID` | UUID | FK to Proxy |
| `AgendaItemID` | UUID | FK to AgendaItem |
| `MandatedVote` | VoteChoice | Prescribed vote |

### Attendance

Check-in of an owner for a meeting.

| Field | Type | Description |
|---|---|---|
| `MeetingID` | UUID | FK to Meeting |
| `OwnerID` | UUID | FK to Owner |
| `UnitID` | UUID | FK to Unit |
| `Method` | AttendanceMethod | `CHECKIN`, `SELF_CHECKIN`, `SIGNATURE`, `VOTE` |
| `CheckedInAt` | time.Time | Check-in time |

### Presence and Signature

`PresenceRecord` and `CommunityPresence` are computed DTOs (not DB tables) that the `PresenceBuilder` aggregates from attendance, ownership, and proxy data.

`Signature` stores a digital signature from the tablet check-in flow in a separate table. `SignatureUnit` links the signature to all covered units (own + proxy units). Both tables are DB-level immutable (triggers block UPDATE/DELETE/TRUNCATE).

## Document Management

### Document

File in the customer portal. Access is controlled via the associated folder.

| Field | Type | Description |
|---|---|---|
| `CommunityID` | *uuid.UUID | NULL = tenant-wide |
| `FolderID` | UUID | FK to Folder |
| `Category` | string | `PROTOCOL`, `INVITATION`, `ANNUAL_ACCOUNT`, `REGULATION`, `NOTICE`, `FORM`, `OTHER` |
| `StorageKey` | string | Blob storage key (not serialized) |
| `FileName` | string | Original file name |
| `MimeType` | string | MIME type |
| `SizeBytes` | int64 | File size |

### Folder

Hierarchical folder structure within a community or tenant.

| Field | Type | Description |
|---|---|---|
| `CommunityID` | uuid.NullUUID | NULL = tenant-wide |
| `ParentFolderID` | uuid.NullUUID | NULL = root folder |
| `OwnerID` | uuid.NullUUID | NULL = public; set = personal folder |
| `Visibility` | string | `PUBLIC` or `RESTRICTED` |
| `Path` | string | Materialized path |

## Audit and Users

### AuditEntry

Immutable audit log entries with hash chain. Each entry contains `PreviousHash` and `Hash` (HMAC-SHA-256 in production). Three hash versions: v1 (plain SHA-256, deprecated), v2 (all fields + optional HMAC), v3 (v2 + `ImpersonatedByID`).

| Field | Type | Description |
|---|---|---|
| `EntityType` | string | e.g. "vote", "meeting" |
| `EntityID` | UUID | Affected entity |
| `Action` | string | e.g. "CREATED", "STATE_CHANGED", "VOTE_CAST" |
| `ActorID` | UUID | Executing user |
| `ImpersonatedByID` | *uuid.UUID | Super admin during impersonation |
| `OldValue` / `NewValue` | *string | JSON diff |
| `PreviousHash` | string | Hash of the previous entry |
| `Hash` | string | Own hash |
| `HashVersion` | int | 1, 2, or 3 |

### User

Authenticated platform identity (ZITADEL sub). Decoupled from owner records.

| Field | Type | Description |
|---|---|---|
| `TenantID` | *uuid.UUID | Nullable for `super_admin` (global) |
| `ExternalUserID` | string | ZITADEL sub |
| `Email` | string | Email |
| `Role` | string | `tenant_admin`, `super_admin`, `meeting_chair`, `owner` |

### UserTenantRole

Source of truth for tenant assignments. A user can have multiple entries — one per tenant. `super_admin` is not stored here (global JWT claim).

| Field | Type | Description |
|---|---|---|
| `UserID` | UUID | FK to User |
| `TenantID` | UUID | FK to Tenant |
| `Role` | string | `tenant_admin`, `meeting_chair`, `owner` |

### UserInvitation

Pending invitation for a new or existing user.

| Field | Type | Description |
|---|---|---|
| `TenantID` | UUID | FK to Tenant |
| `Email` | string | Email of the invitee |
| `Code` | string | Invitation code |
| `Role` | string | Assigned role |
| `ExpiresAt` | time.Time | Expiry time |

## Communication and Portal

### Message and MessageCommunity

Broadcast communication from the administration to communities. `MessageCommunity` is the M:N join table.

| Field | Type | Description |
|---|---|---|
| `AuthorID` | UUID | FK to User |
| `Subject` / `Body` | string | Subject and body |
| `Priority` | MessagePriority | `normal`, `important`, `pinned` |
| `ChannelInApp` / `ChannelEmail` / `ChannelPush` | bool | Delivery channels |

### Notification and PushSubscription

In-app and push notifications for portal users.

| Field | Type | Description |
|---|---|---|
| `UserID` | UUID | FK to User |
| `Type` | NotificationType | `DOCUMENT`, `FORUM`, `TICKET`, `ANNOUNCEMENT` |
| `IsRead` | bool | Read status |

`PushSubscription` stores browser push endpoints (VAPID).

### Forum (ForumPost)

Public community forum. Top-level posts have `ParentID == nil`; replies reference their parent.

| Field | Type | Description |
|---|---|---|
| `CommunityID` | UUID | FK to Community |
| `ParentID` | *uuid.UUID | NULL = top-level |
| `AuthorType` | ForumAuthorType | `OWNER` or `ADMIN` |
| `IsPinned` | bool | Pinned |

### Ticket and TicketMessage

Private support ticket between owner and administration.

| Field | Type | Description |
|---|---|---|
| `CommunityID` | UUID | FK to Community |
| `OwnerID` | UUID | FK to Owner |
| `Category` | TicketCategory | `GENERAL`, `REQUEST`, `DEFECT`, `TENANT_CHANGE`, `COMPLAINT`, `ACCESS`, `OTHER` |
| `Status` | TicketStatus | `OPEN`, `RESOLVED`, `CLOSED` |

`TicketMessage` stores replies. `TicketAttachment` stores attached files.

## Cost Distribution and Billing

### CostDistributionKey and CostDistributionUnitShare

Defines a cost type for a MEG and its distribution across units.

| Field | Type | Description |
|---|---|---|
| `CommunityID` | UUID | FK to Community |
| `Name` | string | e.g. "General facilities" |
| `Type` | CostDistributionType | `EQUAL_PER_UNIT`, `VALUE_QUOTA`, `CUSTOM_SHARES`, `SELF_BORNE`, `BY_RESOLUTION` |

`CostDistributionUnitShare` defines explicit shares per unit (only `CUSTOM_SHARES` and `SELF_BORNE`).

### CostStatement and CostStatementPosition

Concrete settlement: a total amount applied to a CostDistributionKey. On creation, `CostStatementPosition` entries are automatically calculated and persisted per unit. Positions are immutable after creation.

### Invoice and InvoiceLineItem

SaaS subscription invoice for a tenant. Contains one `InvoiceLineItem` per community in the billing period.

| Field | Type | Description |
|---|---|---|
| `PeriodStart` / `PeriodEnd` | time.Time | Billing period |
| `TotalAmountCents` | int64 | Total amount in cents |
| `Status` | InvoiceStatus | `DRAFT`, `PENDING`, `PAID`, `VOID` |
| `Source` | InvoiceSource | `AUTO` or `MANUAL` |

### ScheduledEmail

Scheduled transactional email for a meeting. A background worker processes due entries.

| Field | Type | Description |
|---|---|---|
| `MeetingID` | UUID | FK to Meeting |
| `Type` | ScheduledEmailType | `INVITATION`, `REMINDER`, `CLOSED` |
| `DeliveryStatus` | ScheduledEmailDeliveryStatus | `pending`, `sent`, `failed`, `dead_letter` |
| `RetryCount` | int | Number of attempts |
| `NextRetryAt` | *time.Time | Next retry time |

## Attachments and Presentation

### AgendaItemAttachment and AgendaItemSlide

File or slide deck attachment for an agenda item. `Kind`: `DOCUMENT`, `PRESENTATION`, `SLIDES`. `AgendaItemSlide` stores individual slides as JSONB content.

### MeetingAttachment

File associated with a meeting as a whole (not a specific agenda item).

## Migrations and RLS

The `migrations/` directory contains 43 versioned SQL migrations (golang-migrate format, `NNNNNN_description.up.sql` / `.down.sql`).

<Aside type="note" title="RLS Policies">
Migration `000001` defines the initial RLS policies (`tenant_isolation_policy`) with `USING` clause for read access. Migration `000004` adds `WITH CHECK` clauses to all policies, which also validate write access (INSERT/UPDATE) — faulty application code cannot write rows into another tenant's space.
</Aside>

Other important migrations:

- `000005` — `quorum_snapshots` table
- `000012` — `agenda_item_attachments` table
- `000014`/`000015` — `portal_enabled`/`meeting_enabled` on tenant
- `000016` — Portal documents
- `000017` — Forum posts
- `000018` — Tickets
- `000019`/`000020` — Notifications + RLS
- `000027` — Invoices
- `000028` — Messages
- `000031` — Developments (Überbauungen)
- `000038` — Meeting attachments
- `000043` — Tenant-meeting slugs

Audit and signature tables have DB-level triggers that block `UPDATE`, `DELETE`, and `TRUNCATE` (Migration `000001`). An event trigger (`audit_entries_ddl_guard`) blocks DDL on `audit_entries`, except in maintenance mode (`app.maintenance=on`).

<LinkCard title="Architecture" description="Layers, request flow, and technology stack" href="/reference/architektur/" />
