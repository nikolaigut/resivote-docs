---
title: Features
description: An overview of the key features of ResiVote — digital, transparent, and legally compliant.
---

import { CardGrid, Card, LinkCard } from '@astrojs/starlight/components';

ResiVote provides all the tools to conduct owners' meetings digitally, transparently, and in compliance with the law. Every feature is implemented in the codebase and can be secured via audit logs.

## Digital Meetings

ResiVote supports two meeting modes (`MeetingMode` in `internal/domain/entity/meeting.go`):

- **`LIVE_MEETING`** — Live meeting (in-person, digital, or hybrid). Owners participate live via web browser and vote in real time.
- **`CIRCULAR_RESOLUTION`** — Circular resolution (Art. 712m para. 2 ZGB). Asynchronous voting with a defined start and end date (`circular_voting_start`, `circular_voting_end`).

A meeting can span multiple communities (STWEG/MEG) (`meeting_communities` join table). The meeting lifecycle goes through the states `DRAFT` → `PUBLISHED` → `CHECK_IN` → `IN_PROGRESS` → `CLOSED` → `ARCHIVED`.

## Votes and Resolutions

Each agenda item (`AgendaItem`) defines a vote type:

- **`MOTION`** — Yes/no/abstain
- **`ELECTION`** — Candidate election (`candidates` list, `CANDIDATE` choice)
- **`FREE_TEXT`** — Free-text proposal (`FREE_TEXT` choice)
- **`PROTOCOL`** — Assign minute-taker (without a vote)

Vote weight is determined by the community's voting rights model (`VotingRightsModel`):

- **`HEAD_AND_VALUE`** — Head vote and value quota (STWEG standard)
- **`HEAD_ONLY`** — One unit, one vote
- **`VALUE_ONLY`** — Value quota only (MEA/thousandths)
- **`CUSTOM_SHARES`** — Custom shares per unit (MEG-specific)

Additional voting features:

- **Analog bulk votes** — Chair/admin records votes for present owners who do not vote digitally (`CastAnalogVote`, `CastBulkAnalogVotes`)
- **Pre-voting** — Asynchronous pre-voting (`PRE_VOTING` state, `IsPreVote` flag on votes)
- **Live result visibility** — Configurable per meeting: `ALL` (all participants) or `CHAIR` (chair/admin only)
- **Vote confirmation** — `RequireVoteConfirmation` forces a vote confirmation
- **Quorum override** — Chair can lift the quorum for an agenda item (`QuorumOverride` with mandatory `QuorumOverrideReason`)
- **Vote immutability** — Changed votes are marked as `IsSuperseded=true`; a new vote record is created

## Proxies

Owners transfer their voting right digitally to a proxy (`Proxy` in `internal/domain/entity/proxy.go`):

- **`FULL`** — Proxy for the entire meeting
- **`RESTRICTED`** — Proxy for specific agenda items

For `RESTRICTED`, `ProxyInstruction` defines a mandatory vote (`mandated_vote`) for a specific agenda item. The proxy must vote according to the instruction — a violation triggers `PROXY_INSTRUCTION_VIOLATION`.

Proxies are defined per unit (`UnitID`) and per meeting (`MeetingID`) and can be revoked (`RevokedAt`).

## Check-in

Three check-in methods (`CheckinMethod`):

- **`MANUAL`** — Chair/admin marks participants manually (always available)
- **`QR_CODE`** — Owner scans a QR code with their smartphone and performs a self-check-in (`SelfCheckIn`). The QR token is a signed JWT with `meeting_id` claim.
- **`SIGNATURE`** — Owner selects themselves on the admin's tablet and signs digitally; all own units (and proxy units) are marked as present

Check-in tokens are signed with `CHECKIN_TOKEN_SIGNING_KEY` (HMAC-SHA-256, >= 32 bytes in production) and have a configurable validity period (`CHECKIN_TOKEN_EXPIRY`, default 30m).

## Minutes

- **Live editor** — Minutes notes per agenda item (`DiscussionNotes`, `UpdateAgendaItemNotes`)
- **AI suggestions** — AI-generated minutes suggestions (`SuggestProtocolNotes`); providers: `mistral`, `ollama`, `llama`, `mock`, `disabled`
- **Minute-taker** — Assignable per meeting (`ProtocolWriterOwnerID`, `ProtocolWriterType`: `OWNER` or `TENANT_ADMIN`)
- **PDF reports** — Minutes as PDF (`DownloadMeetingProtocolPDF`), invitation as PDF (`DownloadInvitationPDF`), proxy card as PDF (`DownloadProxyCardPDF`)
- **Evidence package** — PDF + JSON + integrity verification per meeting (`EvidenceHandler`)

## Documents

The customer portal (`portal_enabled`) offers document management:

- **Folders** — Hierarchical folder structure (`Folder`, visibility `PUBLIC` or `RESTRICTED`)
- **Categories** — `PROTOCOL`, `INVITATION`, `ANNUAL_ACCOUNT`, `REGULATION`, `NOTICE`, `FORM`, `OTHER`
- **Regulations import** — Two-phase: extract (`reglement-extract`) → confirm (`reglement-confirm`); uses AI provider for LLM extraction
- **Encryption at rest** — Tenant-specific DEKs (Data Encryption Keys) are wrapped with the `DOCUMENT_ENCRYPTION_MASTER_KEY` (`TenantKeyProvider`, `DocumentEncryption`)
- **Storage backends** — Local filesystem (`./uploads`) or S3-compatible (`STORAGE_TYPE=s3`)
- **PDF conversion** — LibreOffice (`soffice`) for document-to-PDF conversion (`CONVERTER_ENABLED`)

## Quorum

Five quorum types per agenda item (`QuorumType` in `internal/domain/entity/agenda_item.go`):

- **`SIMPLE_MAJORITY`** — YES > 50% of present/represented head votes
- **`QUALIFIED_MAJORITY`** — YES > 50% of present/represented owners (heads) AND > 50% of all eligible value quotas (Art. 647b/d/e, Art. 712g para. 3 ZGB)
- **`UNANIMOUS`** — 100% of all registered owners and value quotas must vote YES (Art. 647e ZGB)
- **`ABSOLUTE_MAJORITY`** — YES > 50% of all registered owners (regardless of attendance)
- **`CUSTOM`** — YES >= `custom_quorum_pct`% of the configured basis (`PRESENT` or `ELIGIBLE`)

The live quorum engine (`LiveQuorumEngine`, `LiveQuorumService`) calculates the quorum in real time and publishes updates via WebSocket. Regulation overrides (`reglement_head_quorum_pct`, `reglement_value_quorum_pct`, `reglement_min_owners`) override the community type defaults (STWEG: 50/50/2, MEG: 50/50/1).

## Forum & Tickets

- **Forum** — Public community forum for owners and administration (`ForumHandler`: create topics, reply, delete)
- **Tickets** — Private support requests between owner and administration (`TicketHandler`: create, add messages, update status, download attachments)

Both features are available in the customer portal (`/api/v1/portal/...`) and require `portal_enabled=true`.

## Messages

The message center (`MessageHandler`, `MessageService`) enables broadcasts to communities:

- Messages with recipient preview (`PreviewRecipientCount`)
- Draft and send status management
- Owner inbox in the portal (`ListForOwner`, `MarkRead`, `Archive`)

## Notifications

- **In-app** — Notifications list, unread count, mark as read
- **Email** — Integration via Resend API
- **Web push** — Browser push notifications via VAPID (`WebPushSender`); manage push subscriptions (`SubscribePush`, `UnsubscribePush`)
- **Settings** — Configurable notification settings per owner

## Billing

- **Billing worker** — Creates monthly invoices for all active tenants (`BILLING_WORKER_INTERVAL`, default 1h)
- **Invoices** — PDF export (`DownloadInvoicePDF`), tenant-specific sender overrides
- **SaaS metrics** — Super admin billing overview (`/api/v1/admin/billing/tenants`)
- **Cost distribution** — Distribution keys and cost statements for MEG (`CostDistributionHandler`, PDF/CSV export)

## Audit Log

- **Immutable hash chain** — Every audit entry is chained with HMAC-SHA-256 (`AUDIT_HASH_KEY`)
- **Fail-closed** — On tamper detection, the server refuses service (`AUDIT_FAIL_CLOSED`, threshold `AUDIT_FAIL_CLOSED_THRESHOLD`)
- **Startup verification** — Chain integrity is checked at startup; on break with fail-closed, `os.Exit(1)` is called
- **Periodic verification** — Every `AUDIT_VERIFY_INTERVAL` (5m), the chain is checked
- **Immutability enforcement** — DB triggers and non-superuser role are verified at startup
- **Export** — Audit log as PDF or JSON (`DownloadAuditPDF`, `DownloadAuditJSON`)
- **ZertES/nDSG** — Integrity proof against database manipulation requires HMAC key >= 32 bytes

## Multilingual

The frontend supports the languages **DE**, **FR**, **IT**, and **EN** (`SUPPORTED_LANGUAGES` in `language.store.ts`, default: `de`). The language is resolved from `localStorage`, browser language, or default. Document categories are synchronized with i18n keys.

## Global Search

The `/api/v1/search` endpoint searches tenant-scoped (for `tenant_admin`) or platform-wide (for `super_admin`) across all indexed resources (`SearchService`, `SearchHandler`).

## Demo Mode

The optional demo mode (`DemoResetConfig`) rotates a demo tenant daily:

- Worker runs at 00:00 UTC + `DEMO_RESET_RESET_OFFSET`
- Hard-delete (`DEMO_RESET_HARD_DELETE`) or archiving of the old demo tenant
- Re-seeding with sample data (tenant, community, owners, units)
- Manual trigger via `POST /internal/demo-reset` (API-key-protected) or `POST /api/v1/admin/system/demo-reset` (super admin)
- Demo slug must be `demo` (`Config.Validate`)

<CardGrid>
<Card title="REST API" href="../reference/api/">Endpoints and middlewares</Card>
<Card title="Configuration" href="../reference/konfiguration/">Environment variables</Card>
<Card title="Deployment" href="../reference/deployment/">Development and production</Card>
<Card title="Glossary" href="../reference/glossar/">Terms and abbreviations</Card>
</CardGrid>
