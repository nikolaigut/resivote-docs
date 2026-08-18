---
title: Roles and Permissions
description: Reference documentation of ResiVote roles, permission model, frontend guards, and impersonation.
---

import { Aside, LinkCard, Steps } from '@astrojs/starlight/components';

ResiVote distinguishes four roles with graduated permissions. Roles are resolved via ZITADEL JWT claims and the `user_tenant_roles` table. Frontend guards complement the backend RBAC with client-side routing protection.

## Roles

The roles are defined in `internal/domain/entity/user.go`:

| Role | Scope | Description |
|---|---|---|
| `super_admin` | Global | Platform administration, tenant management, billing |
| `tenant_admin` | Per-tenant | Management of all tenant resources |
| `meeting_chair` | Per-tenant | Meeting chair, tablet check-in, minutes |
| `owner` | Per-tenant | Owner, voting, portal access |

## User vs. Owner

ResiVote separates authentication identity from ownership:

- **User** (`users` table): Authentication identity with ZITADEL `sub`, email, and role. A user can be an owner but does not have to be.
- **Owner** (`owners` table): Owner record with ownership shares. Has an optional `UserID` FK to the `users` table. Legacy owners without `UserID` are linked via `ExternalUserID` (ZITADEL sub).

An owner can belong to multiple tenants (via `ExternalUserID`), but can only own property within the same tenant.

## UserTenantRole — Source of Truth

The `user_tenant_roles` table is the authoritative source for tenant assignments — **not** JWT claims. A user can have multiple `UserTenantRole` entries, one per tenant.

<Aside type="warning" title="super_admin is global">
`super_admin` is not stored in `user_tenant_roles`. This role remains a global JWT claim, checked by `claims.IsSuperAdmin()` in `RequireSuperAdmin`. The `TenantID` in the `User` record is nullable for `super_admin`.
</Aside>

## Tenant Isolation

The `TenantMiddleware` resolves tenant membership in the following order:

1. JWT claims `TenantMemberships` (primary — set by ZITADEL Action Script)
2. `TenantMembershipCache` (in-process cache over `user_tenant_roles`)
3. `user_tenant_roles` join table (DB fallback on cache miss)
4. `users` table single `TenantID` (legacy fallback)
5. `owners` table (legacy fallback for pre-users-table data)

Super admins (not impersonated) receive universal access with all roles (`super_admin`, `tenant_admin`, `meeting_chair`, `owner`). PostgreSQL RLS enforces per-tenant isolation additionally at the database level.

## Permissions per Role

Permissions are defined by `RequireRole` calls in `router.go` and frontend guards in `app.routes.ts`.

### super_admin

Global platform management. Routes under `/api/v1/tenants` and `/api/v1/admin/*` protected with `RequireSuperAdmin`.

- Create, list, edit, suspend, activate, delete tenants
- Retrieve tenant metrics
- Enable/disable tenant portal and meeting features
- Manage users (ZITADEL: create, assign roles)
- Multi-tenant user assignments (`/admin/users/:userId/tenant-assignments`)
- Platform health and audit integrity (`/admin/system/health`, `/admin/system/audit-integrity`)
- SaaS billing metrics (`/admin/billing/tenants`)
- Start impersonation (`/admin/impersonate`)

Frontend routes: `/super-admin/*` with `superAdminGuard`.

### tenant_admin

Tenant-wide management. Routes with `RequireRole("tenant_admin")`.

- Create/edit/delete communities and units
- Manage community links (STWEG↔MEG)
- Manage developments (Überbauungen)
- Create, import (Excel), archive, edit owners
- Manage ownerships
- Create meetings and control the complete lifecycle (publish, open, start, close, archive)
- Create and control agenda items
- Perform check-in (manual, QR code, signature)
- Record analog votes and bulk analog votes
- Manage cost distribution and cost statements
- View and export audit logs (PDF/JSON)
- Download and verify evidence packages
- Manage portal documents and folders
- Manage forum and tickets
- Create and send messages (broadcasts)
- View billing invoices

Frontend routes: `/admin/*` with `roleGuard(['tenant_admin', 'super_admin'])`.

### meeting_chair

Meeting chair. Routes with `RequireRole("meeting_chair")` or `RequireRole("tenant_admin", "meeting_chair")`.

- View meetings and perform state transitions (open, start, close)
- Control agenda items (present, open, close, skip, pre-voting)
- Edit minutes notes and request AI suggestions
- Control presentation timer
- Perform check-in (manual, QR code, signature)
- Record analog votes and bulk analog votes
- Manage attachments and slides
- Download and verify evidence packages

Frontend routes: `/meeting/:id/chair` and `/meeting/:id/tablet-checkin` with `chairGuard`.

### owner

Owner with portal access and voting rights. Routes with `RequireRole("owner")`.

- View meetings and agenda items (own communities only)
- Vote (`CastVote`)
- View own vote (`GetMyVote`)
- Self-check-in (`SelfCheckIn`)
- Grant and revoke proxies
- Download invitation and proxy card PDFs
- Download minutes PDF
- View and download portal documents
- Create and reply to forum posts
- Create and reply to tickets
- View messages
- Manage notifications

Frontend routes: `/portal/*` with `portalEnabledGuard` and `tenantSelectionGuard`.

## Frontend Guards

The Angular router guards (`frontend/src/app/app.routes.ts`) protect client-side routing:

| Guard | Function |
|---|---|
| `authGuard` | Checks OIDC authentication |
| `chairGuard` | Checks `meeting_chair` role |
| `superAdminGuard` | Checks `super_admin` role |
| `superAdminRedirectGuard` | Redirects super admins to the super admin dashboard |
| `roleGuard(['tenant_admin', 'super_admin'])` | Checks specific roles |
| `portalEnabledGuard` | Checks whether portal is enabled for the tenant |
| `portalRedirectGuard` | Redirects owners to the portal |
| `tenantSelectionGuard` | Checks whether a tenant has been selected |
| `meetingRoleRedirectGuard` | Redirects to the correct meeting view based on role |

## Community Access Middleware

The `CommunityAccessMiddleware` restricts owner access to communities, units, meetings, and agenda items that they are actually associated with. The middleware loads the owner's ownership data and stores the community and unit ID sets in the request context.

`tenant_admin` and `meeting_chair` are exempt — they may access all resources within their tenant.

Proxy holders (proxy grantees) gain access to meetings whose communities they represent via an active proxy — even if they are not direct owners in the community.

## Impersonation

A super admin can assume the identity of another user (impersonation) via ZITADEL Token Exchange (RFC 8693). The `ImpersonationService` (`internal/application/impersonation_service.go`) exchanges the super admin token for a JWT containing an `act` claim with the super admin identity.

<Aside type="note" title="Security Measures">
- `RequireSuperAdmin` blocks impersonated tokens — no privilege escalation possible.
- `RequireSuperAdminOrImpersonated` allows only the stop-impersonation endpoint for impersonated tokens.
- The `TenantMiddleware` enforces normal membership resolution of the target user for impersonated tokens.
- The `ImpersonatorSub` is stored in the context (`WithImpersonatorID`) and in the audit log (`ImpersonatedByID`).
</Aside>

## Tenant Membership Cache

The `TenantMembershipCache` (`internal/application/tenant_membership_cache.go`) avoids repeated DB queries in the `TenantMiddleware` when JWT claims do not contain `tenant_memberships` (production case — ZITADEL provides only authentication, tenant membership is in the DB).

| Configuration | Env Variable | Default |
|---|---|---|
| `Enabled` | `TENANT_CACHE_ENABLED` | `true` |
| `TTL` | `TENANT_CACHE_TTL` | 5 minutes |

The cache is invalidated on role changes, tenant suspension, and demo reset.

<LinkCard title="Manage Users" description="Guide to user management and role assignment" href="/guides/benutzer/" />
<LinkCard title="Security and Compliance" description="Authentication, RLS, encryption, and audit" href="/reference/sicherheit/" />
