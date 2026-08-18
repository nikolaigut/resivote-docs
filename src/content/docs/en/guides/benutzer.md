---
title: Users and Permissions
description: Roles, tenant isolation, owner management, and impersonation in ResiVote.
---

import { Aside, CardGrid, Card, LinkCard } from '@astrojs/starlight/components';

ResiVote separates the authentication identity (`User`) from the ownership identity (`Owner`). Roles are stored per tenant in the database, not derived from JWT claims. All data is tenant-isolated.

## User vs Owner

ResiVote deliberately decouples the login identity from ownership:

- **`User`** (`internal/domain/entity/user.go`) – the authentication identity. Contains the ZITADEL `sub` (`ExternalUserID`), email, name, and a role. `TenantID` is nullable (`nil` for `super_admin`).
- **`Owner`** (`internal/domain/entity/owner.go`) – the ownership identity. Contains name, email, phone, and an optional `UserID` foreign key to the `users` table. An owner can own units in multiple communities within the same tenant.

The linking happens on first login: `LinkAllExternalUsersByEmail` links the ZITADEL `sub` to all user records with the same email that do not yet have an `ExternalUserID`.

### Owner Properties

| Field | Meaning |
|------|-----------|
| `ExternalUserID` | Global identity (cross-tenant) |
| `UserID` | Optional FK to `users` (nullable for legacy data) |
| `IsArchived` / `ArchivedAt` | Owner marked as archived |
| `TenantID` | Tenant — owners can only own units within the same tenant |

## Roles

ResiVote has four roles (`internal/domain/entity/user.go`):

### tenant_admin

The tenant administrator prepares meetings, invites participants, manages communities and units, and takes the minutes. They only see data from their own tenant (`TenantID` set).

### super_admin

The super admin is global (`TenantID = nil`). They manage tenants, have access to super admin routes, and can impersonate users. The `super_admin` role is **not** stored in `UserTenantRole` but remains a global JWT claim.

### meeting_chair

The chair leads the meeting via the chair dashboard: opens and closes agenda items, starts votes, grants quorum overrides, and controls live result visibility. A frontend guard (`chair guard`) protects the chair functions.

### owner

The owner participates in meetings, votes, and views their documents in the portal. The owner role is the default role for voting-eligible persons.

## UserTenantRole

`UserTenantRole` (`internal/domain/entity/user_tenant_role.go`) is the **source of truth** for tenant assignments — not JWT claims. A user can have multiple entries, one per tenant.

<Aside type="warning" title="super_admin not stored here">
The `super_admin` role is deliberately not stored in `UserTenantRole`. It remains a global JWT claim, since super admins operate across tenants.
</Aside>

Allowed roles in `UserTenantRole`: `tenant_admin`, `meeting_chair`, `owner`.

## Tenant Isolation

ResiVote is multi-tenant. Every entity carries a `TenantID` field:

- `Owner.TenantID` – owners are tenant-specific.
- `Document.TenantID` – documents are tenant-isolated.
- `Folder.TenantID` – folders are tenant-isolated.
- `Meeting.TenantID` – meetings belong to a tenant.
- `AuditEntry.TenantID` – audit logs are tenant-isolated.

Super admins (`TenantID = nil`) operate globally. All other users only see data from their own tenant. Tenant isolation is enforced at the database level (row-level security) and at the application level (`ctxutil.TenantIDFromContext`).

## Managing Owners

Owners are voting-eligible persons or organizations that own one or more residential units. They are recorded with name, address, and email, and assigned to the corresponding units via `Ownership`.

An owner can own units in multiple communities within the same tenant. The ownership shares (`ShareNumerator`/`ShareDenominator`) determine the value quota. `IsPrimaryVoter` marks the primary voter of a unit.

Archived owners (`IsArchived = true`) are hidden in administration but retained for historical minutes.

## Proxies

An owner can authorize another person with a proxy (`Proxy`) to attend the meeting and vote on their behalf. Proxies can be granted as full or instructed.

The `VoteValidator` ensures that only the proxy (`GranteeID`) votes digitally — the grantor (`GrantorID`) is blocked as long as an active proxy exists. Instructed votes must match the instruction (`MandatedVote`).

## Impersonation

Super admins can assume the identity of another user (`internal/application/impersonation_service.go`). The process uses ZITADEL Token Exchange (RFC 8693):

- The super admin exchanges their access token for a new JWT that assumes the target user's identity.
- The resulting JWT contains an `act` claim identifying the impersonator.
- Every action during impersonation is logged in the audit log with `ImpersonatedByID` (hash version v3).

<Aside type="note" title="Full Traceability">
Impersonation is fully traceable in the audit log. The hash chain (v3) binds the impersonator identity into every audit entry.
</Aside>

## Securing Access

Every user logs in via ZITADEL (OIDC). Authentication is done via personal links or invitation codes (`RedeemInvitation`). Tenant administrators only see data from their own tenant.

For details on the audit hash chain and integrity verification, see `/reference/sicherheit/`.

## Further Reading

<LinkCard title="Roles Reference" href="/reference/rollen/" description="Detailed role and permission definitions." />
<LinkCard title="Security and Audit" href="/reference/sicherheit/" description="Hash chains, impersonation logging, and integrity verification." />
