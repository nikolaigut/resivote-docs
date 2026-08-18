---
title: Rollen und Berechtigungen
description: Referenzdokumentation der ResiVote-Rollen, Berechtigungsmodells, Frontend-Guards und Impersonation.
---

import { Aside, LinkCard, Steps } from '@astrojs/starlight/components';

ResiVote unterscheidet vier Rollen mit abgestuften Berechtigungen. Die Rollen werden über ZITADEL-JWT-Claims und die `user_tenant_roles`-Tabelle aufgelst. Die Frontend-Guards ergänzen das Backend-RBAC mit clientseitigem Routing-Schutz.

## Rollen

Die Rollen sind in `internal/domain/entity/user.go` definiert:

| Rolle | Scope | Beschreibung |
|---|---|---|
| `super_admin` | Global | Plattform-Administration, Tenant-Management, Billing |
| `tenant_admin` | Pro-Tenant | Verwaltung aller Tenant-Ressourcen |
| `meeting_chair` | Pro-Tenant | Versammlungsleitung, Tablet-Check-in, Protokollführung |
| `owner` | Pro-Tenant | Eigentümer, Stimmabgabe, Portal-Zugriff |

## User vs. Owner

ResiVote trennt Authentifizierungs-Identität von Eigentümerschaft:

- **User** (`users`-Tabelle): Authentifizierungs-Identität mit ZITADEL `sub`, Email und Rolle. Ein User kann Eigentümer sein, muss aber nicht.
- **Owner** (`owners`-Tabelle): Eigentümer-Datensatz mit Eigentumsanteilen. Hat ein optionales `UserID`-FK auf die `users`-Tabelle. Legacy-Owner ohne `UserID` werden über `ExternalUserID` (ZITADEL sub) verknüpft.

Ein Owner kann mehreren Tenants angehören (über `ExternalUserID`), aber immer nur innerhalb desselben Tenants Eigentum haben.

## UserTenantRole — Source of Truth

Die Tabelle `user_tenant_roles` ist die verbindliche Quelle für Tenant-Zuweisungen — **nicht** JWT-Claims. Ein User kann mehrere `UserTenantRole`-Einträge haben, einen pro Tenant.

<Aside type="warning" title="super_admin ist global">
`super_admin` wird nicht in `user_tenant_roles` gespeichert. Diese Rolle bleibt ein globaler JWT-Claim, geprüft durch `claims.IsSuperAdmin()` in `RequireSuperAdmin`. Die `TenantID` im `User`-Datensatz ist für `super_admin` nullable.
</Aside>

## Tenant-Isolation

Die `TenantMiddleware` löst die Tenant-Mitgliedschaft in folgender Reihenfolge auf:

1. JWT-Claims `TenantMemberships` (primär — gesetzt durch ZITADEL Action Script)
2. `TenantMembershipCache` (In-Process-Cache über `user_tenant_roles`)
3. `user_tenant_roles`-Join-Tabelle (DB-Fallback bei Cache-Miss)
4. `users`-Tabelle einzelne `TenantID` (Legacy-Fallback)
5. `owners`-Tabelle (Legacy-Fallback für pre-users-table Daten)

Super-Admins (nicht impersoniert) erhalten universellen Zugriff mit allen Rollen (`super_admin`, `tenant_admin`, `meeting_chair`, `owner`). Die PostgreSQL RLS erzwingt die Per-Tenant-Isolation zusätzlich auf Datenbankebene.

## Berechtigungen pro Rolle

Die Berechtigungen werden durch `RequireRole`-Aufrufe in `router.go` und Frontend-Guards in `app.routes.ts` definiert.

### super_admin

Globale Plattform-Verwaltung. Routen unter `/api/v1/tenants` und `/api/v1/admin/*` mit `RequireSuperAdmin` geschützt.

- Tenants erstellen, auflisten, bearbeiten, suspendieren, aktivieren, löschen
- Tenant-Metriken abrufen
- Tenant-Portal- und Meeting-Feature aktivieren/deaktivieren
- Benutzer verwalten (ZITADEL: erstellen, Rollen zuweisen)
- Multi-Tenant-User-Assignments (`/admin/users/:userId/tenant-assignments`)
- Plattform-Health und Audit-Integrität (`/admin/system/health`, `/admin/system/audit-integrity`)
- SaaS-Billing-Metriten (`/admin/billing/tenants`)
- Impersonation starten (`/admin/impersonate`)

Frontend-Routen: `/super-admin/*` mit `superAdminGuard`.

### tenant_admin

Tenant-weite Verwaltung. Routen mit `RequireRole("tenant_admin")`.

- Communities und Units erstellen/bearbeiten/löschen
- Community-Links (STWEG↔MEG) verwalten
- Developments (Überbauungen) verwalten
- Owners erstellen, importieren (Excel), archivieren, bearbeiten
- Ownerships verwalten
- Meetings erstellen und kompletten Lifecycle steuern (Publish, Open, Start, Close, Archive)
- Agenda-Items erstellen und steuern
- Check-in (manuell, QR-Code, Signatur) durchführen
- Analog-Votes und Bulk-Analog-Votes erfassen
- Kostenverteilung und Kostenabrechnungen verwalten
- Audit-Logs einsehen und exportieren (PDF/JSON)
- Evidence-Package herunterladen und verifizieren
- Portal-Dokumente und Folder verwalten
- Forum und Tickets verwalten
- Messages (Broadcasts) erstellen und versenden
- Billing-Invoices einsehen

Frontend-Routen: `/admin/*` mit `roleGuard(['tenant_admin', 'super_admin'])`.

### meeting_chair

Versammlungsleitung. Routen mit `RequireRole("meeting_chair")` oder `RequireRole("tenant_admin", "meeting_chair")`.

- Meetings einsehen und Status-Transitionen durchführen (Open, Start, Close)
- Agenda-Items steuern (Present, Open, Close, Skip, Pre-Voting)
- Protokoll-Notizen bearbeiten und AI-Vorschläge anfordern
- Präsentations-Timer steuern
- Check-in durchführen (manuell, QR-Code, Signatur)
- Analog-Votes und Bulk-Analog-Votes erfassen
- Attachments und Slides verwalten
- Evidence-Package herunterladen und verifizieren

Frontend-Routen: `/meeting/:id/chair` und `/meeting/:id/tablet-checkin` mit `chairGuard`.

### owner

Eigentümer mit Portal-Zugriff und Stimmrecht. Routen mit `RequireRole("owner")`.

- Meetings und Agenda-Items einsehen (nur eigene Communities)
- Abstimmen (`CastVote`)
- Eigene Stimme einsehen (`GetMyVote`)
- Self-Check-in (`SelfCheckIn`)
- Vollmachten erteilen und widerrufen
- Einladungs- und Vollmachtskarten-PDF herunterladen
- Protokoll-PDF herunterladen
- Portal-Dokumente einsehen und herunterladen
- Forum-Beiträge erstellen und beantworten
- Tickets erstellen und beantworten
- Messages einsehen
- Benachrichtigungen verwalten

Frontend-Routen: `/portal/*` mit `portalEnabledGuard` und `tenantSelectionGuard`.

## Frontend-Guards

Die Angular-Router-Guards (`frontend/src/app/app.routes.ts`) schützen das clientseitige Routing:

| Guard | Funktion |
|---|---|
| `authGuard` | Prüft OIDC-Authentifizierung |
| `chairGuard` | Prüft `meeting_chair`-Rolle |
| `superAdminGuard` | Prüft `super_admin`-Rolle |
| `superAdminRedirectGuard` | Leitet Super-Admins zum Super-Admin-Dashboard weiter |
| `roleGuard(['tenant_admin', 'super_admin'])` | Prüft spezifische Rollen |
| `portalEnabledGuard` | Prüft ob Portal für Tenant aktiviert ist |
| `portalRedirectGuard` | Leitet Owner zum Portal weiter |
| `tenantSelectionGuard` | Prüft ob ein Tenant ausgewählt wurde |
| `meetingRoleRedirectGuard` | Leitet basierend auf Rolle zur richtigen Meeting-Ansicht |

## Community-Access-Middleware

Die `CommunityAccessMiddleware` beschränkt Owner-Zugriff auf Communities, Units, Meetings und Agenda-Items, mit denen sie tatsächlich verknüpft sind. Die Middleware lädt die Ownership-Daten des Owners und speichert die Community- und Unit-ID-Sets im Request-Context.

`tenant_admin` und `meeting_chair` sind exempt — sie dürfen alle Ressourcen innerhalb ihres Tenants zugreifen.

Vollmacht-Inhaber (Proxy-Grantee) erhalten Zugriff auf Meetings, deren Communities sie über eine aktive Vollmacht vertreten — auch wenn sie keine direkten Owner in der Community sind.

## Impersonation

Ein Super-Admin kann die Identität eines anderen Users annehmen (Impersonation) via ZITADEL Token Exchange (RFC 8693). Der Service `ImpersonationService` (`internal/application/impersonation_service.go`) tauscht das Super-Admin-Token gegen ein JWT aus, das einen `act`-Claim mit der Super-Admin-Identität enthält.

<Aside type="note" title="Sicherheitsmaßnahmen">
- `RequireSuperAdmin` blockiert impersonierte Tokens — kein Privilege Escalation möglich.
- `RequireSuperAdminOrImpersonated` erlaubt nur den Stop-Impersonation-Endpunkt für impersonierte Tokens.
- Die `TenantMiddleware` erzwingt für impersonierte Tokens die normale Membership-Auflösung des Ziel-Users.
- Der `ImpersonatorSub` wird im Context (`WithImpersonatorID`) und im Audit-Log (`ImpersonatedByID`) gespeichert.
</Aside>

## Tenant-Membership-Cache

Der `TenantMembershipCache` (`internal/application/tenant_membership_cache.go`) vermeidet wiederholte DB-Queries in der `TenantMiddleware`, wenn JWT-Claims keine `tenant_memberships` enthalten (Produktionsfall — ZITADEL liefert nur Authentifizierung, Tenant-Membership liegt in der DB).

| Konfiguration | Env-Variable | Standard |
|---|---|---|
| `Enabled` | `TENANT_CACHE_ENABLED` | `true` |
| `TTL` | `TENANT_CACHE_TTL` | 5 Minuten |

Der Cache wird bei Rollenänderungen, Tenant-Suspendierung und Demo-Reset invalidiert.

<LinkCard title="Benutzer verwalten" description="Anleitung zur Benutzerverwaltung und Rollenzuweisung" href="/guides/benutzer/" />
<LinkCard title="Sicherheit und Compliance" description="Authentifizierung, RLS, Verschlüsselung und Audit" href="/reference/sicherheit/" />
