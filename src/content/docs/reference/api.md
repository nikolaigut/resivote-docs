---
title: REST API
description: Referenz der ResiVote REST-API – Routengruppen, Endpunkte, Authentifizierung, Middlewares und Fehlercodes.
---

import { Tabs, TabItem, Aside, LinkCard } from '@astrojs/starlight/components';

ResiVote stellt eine REST-API unter dem Basispfad `/api/v1` bereit. Der HTTP-Router basiert auf dem Echo-Framework und ist in `internal/interfaces/http/router.go` definiert. Eine OpenAPI-3.0-Spezifikation wird automatisch generiert.

## Basispfad und OpenAPI-Spezifikation

Alle API-Endpunkte liegen unter `/api/v1`. Die OpenAPI-Spezifikation (`openapi.json`) wird durch `cmd/openapi-gen` aus den Echo-Routen generiert.

```sh
task generate-openapi   # generiert openapi.json
task generate-client    # generiert Angular-API-Client aus openapi.json
```

Der Angular-Client wird im Frontend mit `npm run generate:api` erzeugt (Task `generate-client` wickelt beide Schritte ab).

## Authentifizierung

Die API verwendet Bearer-JWT-Tokens via ZITADEL OIDC. Die `AuthMiddleware` validiert jeden Request gegen die ZITADEL-JWKS (`{BaseURL}/oauth/v2/keys`) und prüft Issuer und Audience.

- **Token-Typ:** ZITADEL-OIDC-Access-Token (Bearer)
- **Issuer-Validierung:** `iss` muss mit `ZITADEL_EXPECTED_ISSUER` (Default: `ZITADEL_BASE_URL`) übereinstimmen
- **Audience-Validierung:** `aud` muss `ZITADEL_EXPECTED_AUDIENCE` (Default: `ZITADEL_PROJECT_ID`) enthalten
- **Dev-Bypass:** In Nicht-Produktions-Builds existiert ein Signatur-Validierungs-Bypass, der im Produktions-Build (`-tags production`) kompiliert wird

Weitere Details zur Authentifizierung und zu ZITADEL siehe [Sicherheit](../reference/sicherheit/) und [Architektur](../reference/architektur/).

## Tenant-Header

Tenant-scoped Endpunkte erfordern den Header `X-Tenant-ID` (UUID) oder einen Tenant-Slug im Pfad. Die `TenantMiddleware` löst die Tenant-Mitgliedschaft des Benutzers auf und schreibt die Tenant-ID in den Request-Kontext.

## Middlewares

Die Middlewares werden in folgender Reihenfolge angewendet:

| Middleware | Zweck |
|---|---|
| `Recover` | Panic-Recovery |
| `SecurityHeadersMiddleware` | CSP, HSTS, X-Frame-Options |
| `BodyLimit` | Request-Body-Limit (Default `50M`) |
| `CORSMiddleware` | CORS-Konfiguration (`CORS_ORIGINS`) |
| `AuditMiddleware` | Audit-Logging |
| `AuthMiddleware` | JWT-Validierung (ZITADEL OIDC) |
| `TenantMiddleware` | Tenant-Auflösung und Mitgliedschafts-Check |
| `DBTransactionMiddleware` | Request-Scoped-Transaktion mit `SET LOCAL app.current_tenant_id` (PostgreSQL RLS) |
| `CommunityAccessMiddleware` | Eigentümer-Zugriff auf eigene Communities/Units; `tenant_admin` und `meeting_chair` sind exempt |
| `MeetingEnabledMiddleware` | Blockiert Live-Meeting-Endpunkte, wenn `meeting_enabled=false` |
| `PortalEnabledMiddleware` | Blockiert Portal-Endpunkte, wenn `portal_enabled=false` |
| `CustomErrorHandler` | Zentrale Fehlerbehandlung mit `AppError`-Codes |

## Routengruppen

### Öffentliche Endpunkte

Öffentliche Endpunkte benötigen keine Authentifizierung.

| Methode | Pfad | Beschreibung |
|---|---|---|
| `GET` | `/health` | Health-Check (`{"status":"UP"}`) |
| `GET` | `/auth/config` | OIDC-Konfiguration (Issuer, Client-ID, Post-Logout-URI); rate-limited (10 req/s, Burst 20) |
| `GET` | `/api/v1/checkin/:token/validate` | Check-in-Token-Validierung (JWT); rate-limited (10 req/s, Burst 20) |
| `POST` | `/api/v1/public/contact` | Kontaktformular; rate-limited (5 req/min) |
| `GET/HEAD` | `/api/v1/attachments/:id/slides/images/:imageName` | Öffentlicher Slide-Bild-Stream für `<img>`-Tags |
| `POST` | `/internal/demo-reset` | Demo-Reset (API-Key-geschützt, nur wenn `DEMO_RESET_ENABLED`) |

### Me-Routen (`/api/v1/me`)

Authentifizierte Endpunkte ohne Tenant-Scope.

| Methode | Pfad | Beschreibung |
|---|---|---|
| `GET` | `/api/v1/me` | Aktueller Benutzer: Rollen und Tenant-Mitgliedschaften; rate-limited (10 req/s, Burst 20) |
| `POST` | `/api/v1/invitations/redeem` | Einladung einlösen |

### Admin-Routen (`/api/v1/admin`, `/api/v1/tenants`)

Super-Admin-Endpunkte mit `RequireSuperAdmin`-Middleware und Rate-Limiting (30 req/min).

| Methode | Pfad | Beschreibung |
|---|---|---|
| `GET/POST` | `/api/v1/tenants` | Tenants auflisten/erstellen |
| `GET/PUT/DELETE` | `/api/v1/tenants/:id` | Tenant-Verwaltung |
| `PATCH` | `/api/v1/tenants/:id/billing` | Billing-Info aktualisieren |
| `PATCH` | `/api/v1/tenants/:id/portal` | Portal aktivieren/deaktivieren |
| `PATCH` | `/api/v1/tenants/:id/meeting` | Meeting-Feature aktivieren/deaktivieren |
| `PATCH` | `/api/v1/tenants/:id/suspend` | Tenant sperren |
| `PATCH` | `/api/v1/tenants/:id/activate` | Tenant aktivieren |
| `GET` | `/api/v1/tenants/:id/metrics` | Tenant-Metriken |
| `POST` | `/api/v1/tenants/suggest-slug` | Slug-Vorschlag |
| `GET` | `/api/v1/tenants/check-slug` | Slug-Verfügbarkeit prüfen |
| `GET/POST` | `/api/v1/tenants/:id/users` | Tenant-Benutzer auflisten/erstellen |
| `DELETE` | `/api/v1/tenants/:id/users/:email` | Tenant-Benutzer entfernen |
| `GET` | `/api/v1/admin/system/health` | System-Health |
| `GET` | `/api/v1/admin/system/audit-integrity` | Audit-Chain-Integrität |
| `GET` | `/api/v1/admin/system/config` | Laufende Konfiguration |
| `GET/POST` | `/api/v1/admin/users` | ZITADEL-Benutzer auflisten/erstellen |
| `POST` | `/api/v1/admin/users/roles` | Rollen zuweisen |
| `POST` | `/api/v1/admin/users/:userId/tenant-assignments` | Tenant-Zuweisung erstellen |
| `DELETE` | `/api/v1/admin/users/:userId/tenant-assignments/:tenantId` | Tenant-Zuweisung entfernen |
| `POST` | `/api/v1/admin/impersonate` | Impersonation starten (Token Exchange RFC 8693) |
| `POST` | `/api/v1/admin/impersonate/stop` | Impersonation beenden |
| `GET` | `/api/v1/admin/billing/tenants` | SaaS-Billing-Tenants |
| `GET` | `/api/v1/admin/billing/tenants/:id` | SaaS-Billing-Tenant-Details |

### Tenant-scoped Endpunkte (`/api/v1/...`)

Diese Endpunkte erfordern `X-Tenant-ID`, RLS-Enforcement und Community-Access-Checks.

<Tabs>
<TabItem label="Communities & Units">

| Methode | Pfad | Rollen |
|---|---|---|
| `POST` | `/communities` | `tenant_admin` |
| `GET` | `/communities` | `tenant_admin`, `meeting_chair`, `owner` |
| `GET/PUT/DELETE` | `/communities/:id` | siehe Router |
| `POST/DELETE` | `/communities/:id/megs/:megId` | `tenant_admin` (MEG-Verknüpfung) |
| `GET` | `/communities/:id/megs` | MEG-Verknüpfungen |
| `GET` | `/communities/:id/stwegs` | STWEG-Verknüpfungen |
| `GET/POST` | `/developments` | Überbauungen |
| `GET` | `/developments/tree` | Entwicklungsbaum |
| `POST` | `/communities/:communityId/units` | Unit erstellen |
| `POST` | `/communities/reglement-extract` | Reglement extrahieren (50M Body-Limit) |
| `POST` | `/communities/reglement-confirm` | Reglement bestätigen |
| `GET` | `/communities/:communityId/units` | Units auflisten |
| `GET/PUT/DELETE` | `/units/:id` | Unit-Verwaltung |

</TabItem>
<TabItem label="Kostenverteilung">

| Methode | Pfad | Beschreibung |
|---|---|---|
| `GET/POST` | `/communities/:communityId/cost-distribution-keys` | Verteilungsschlüssel (MEG) |
| `GET/PUT/DELETE` | `/communities/:communityId/cost-distribution-keys/:keyId` | Einzelner Schlüssel |
| `GET/POST` | `/communities/:communityId/cost-statements` | Kostenabrechnungen |
| `GET/DELETE` | `/communities/:communityId/cost-statements/:stmtId` | Einzelne Abrechnung |
| `GET` | `/cost-statements/:id/pdf` | Kostenabrechnung als PDF |
| `GET` | `/cost-statements/:id/csv` | Kostenabrechnung als CSV |

</TabItem>
<TabItem label="Eigentümer & Eigentumsanteile">

| Methode | Pfad | Beschreibung |
|---|---|---|
| `POST` | `/owners` | Eigentümer erstellen |
| `POST` | `/owners/import` | CSV-Import (10M Body-Limit) |
| `GET` | `/owners` | Eigentümer auflisten |
| `GET/PUT/DELETE` | `/owners/:id` | Eigentümer-Verwaltung |
| `POST` | `/owners/:id/archive` | Eigentümer archivieren |
| `GET` | `/owners/:ownerId/ownerships` | Eigentumsanteile eines Eigentümers |
| `GET` | `/profile` | Eigenes Profil |
| `POST/GET/PUT/DELETE` | `/ownerships` | Eigentumsanteile verwalten |
| `GET` | `/units/:unitId/ownerships` | Eigentumsanteile einer Unit |

</TabItem>
<TabItem label="Versammlungen">

| Methode | Pfad | Beschreibung |
|---|---|---|
| `POST/GET` | `/meetings` | Versammlung erstellen/auflisten |
| `GET/PUT/DELETE` | `/meetings/:id` | Versammlung-Verwaltung |
| `GET` | `/meetings/:id/presence` | Präsenz-Übersicht |
| `GET` | `/meetings/:id/mentions` | Erwähnbare Teilnehmer |
| `GET` | `/meetings/:id/quorum` | Live-Quorum |
| `PATCH` | `/meetings/:id/protocol-writer` | Protokollführer setzen |
| `POST` | `/meetings/:id/publish` | Versammlung veröffentlichen |
| `POST` | `/meetings/:id/open` | Versammlung öffnen (Check-in) |
| `POST` | `/meetings/:id/start` | Versammlung starten |
| `POST` | `/meetings/:id/close` | Versammlung schliessen |
| `POST` | `/meetings/:id/archive` | Versammlung archivieren |
| `GET` | `/meetings/:id/email-queue-status` | E-Mail-Warteschlangen-Status |
| `POST/DELETE/GET` | `/meetings/:id/communities` | Multi-Community-Verknüpfung |
| `GET` | `/meetings/:meetingId/eligible-grantees` | Berechtigte Vollmacht-Empfänger |
| `GET` | `/meetings/:meetingId/eligible-units` | Berechtigte Units |

</TabItem>
<TabItem label="Traktanden">

| Methode | Pfad | Beschreibung |
|---|---|---|
| `POST/GET` | `/meetings/:meetingId/agenda-items` | Traktandum erstellen/auflisten |
| `GET/PUT/DELETE` | `/agenda-items/:id` | Traktandum-Verwaltung |
| `POST` | `/agenda-items/:id/present` | Präsentation starten |
| `POST` | `/agenda-items/:id/open` | Abstimmung öffnen |
| `POST` | `/agenda-items/:id/close` | Abstimmung schliessen |
| `POST` | `/agenda-items/:id/skip` | Traktandum überspringen |
| `POST` | `/agenda-items/:id/start-pre-voting` | Pre-Voting starten |
| `POST` | `/agenda-items/:id/cancel-pre-voting` | Pre-Voting abbrechen |
| `PATCH` | `/agenda-items/:id/notes` | Notizen aktualisieren |
| `POST` | `/agenda-items/:id/ai-suggest` | AI-Protokollvorschlag |
| `POST` | `/agenda-items/:id/timer/start` | Timer starten |
| `POST` | `/agenda-items/:id/timer/stop` | Timer stoppen |
| `GET` | `/agenda-items/:id/timer` | Timer-Status |
| `GET` | `/agenda-items/:id/quorum-snapshot` | Quorum-Snapshot |

</TabItem>
<TabItem label="Anhänge & Slides">

| Methode | Pfad | Beschreibung |
|---|---|---|
| `POST` | `/agenda-items/:id/attachments` | Anhang hochladen |
| `POST` | `/agenda-items/:id/slides` | Slides-Anhang erstellen |
| `GET` | `/agenda-items/:id/attachments` | Anhänge auflisten |
| `DELETE` | `/attachments/:id` | Anhang löschen |
| `GET` | `/attachments/:id/download` | Anhang herunterladen |
| `POST/PUT/DELETE` | `/attachments/:id/slides` | Slide-Verwaltung |
| `POST` | `/attachments/:id/slides/current` | Aktuelle Slide setzen |
| `POST` | `/attachments/:id/slides/images` | Slide-Bild hochladen |
| `POST/GET/DELETE` | `/meetings/:id/attachments` | Versammlungs-Anhänge |

</TabItem>
<TabItem label="Abstimmungen & Check-in">

| Methode | Pfad | Beschreibung |
|---|---|---|
| `POST` | `/agenda-items/:agendaItemId/votes` | Stimme abgeben (`owner`) |
| `POST` | `/agenda-items/:agendaItemId/analog-votes` | Analoge Stimme (`tenant_admin`, `meeting_chair`) |
| `POST` | `/agenda-items/:agendaItemId/bulk-analog-votes` | Bulk analoge Stimmen |
| `GET` | `/agenda-items/:agendaItemId/votes` | Stimmen auflisten |
| `GET` | `/agenda-items/:agendaItemId/my-vote` | Eigene Stimme |
| `GET` | `/agenda-items/:id/result` | Abstimmungsergebnis |
| `GET` | `/agenda-items/:id/eligible-units` | Berechtigte analoge Units |
| `POST` | `/meetings/:meetingId/check-in` | Check-in (Admin) |
| `POST` | `/meetings/:meetingId/check-in/self` | Self-Check-in (`owner`) |
| `GET` | `/meetings/:meetingId/checkin-qr` | QR-Token generieren (rate-limited) |
| `GET` | `/meetings/:meetingId/attendances` | Anwesenheitsliste |
| `GET` | `/meetings/:meetingId/my-attendance` | Eigene Anwesenheit |
| `POST` | `/meetings/:meetingId/signature-checkin` | Signatur-Check-in (5M Body-Limit) |
| `GET` | `/meetings/:meetingId/signatures` | Signaturen auflisten |
| `GET` | `/meetings/:meetingId/owners/:ownerId/checkin-preview` | Check-in-Vorschau |

</TabItem>
<TabItem label="Vollmachten">

| Methode | Pfad | Beschreibung |
|---|---|---|
| `POST` | `/meetings/:meetingId/proxies` | Vollmacht erstellen |
| `GET` | `/meetings/:meetingId/proxies` | Vollmachten auflisten |
| `DELETE` | `/proxies/:id` | Vollmacht widerrufen |

</TabItem>
<TabItem label="Reports & Beweispaket">

| Methode | Pfad | Beschreibung |
|---|---|---|
| `GET` | `/meetings/:id/protocol/pdf` | Protokoll als PDF |
| `GET` | `/meetings/:id/invitation/pdf` | Einladung als PDF |
| `GET` | `/meetings/:id/proxy-card/pdf` | Vollmachtskarte als PDF |
| `GET` | `/meetings/:id/evidence-package/verify` | Beweispaket-Integrität prüfen |
| `GET` | `/meetings/:id/evidence-package/pdf` | Beweispaket als PDF |
| `GET` | `/meetings/:id/evidence-package/json` | Beweispaket als JSON |

</TabItem>
<TabItem label="Audit-Logs">

| Methode | Pfad | Beschreibung |
|---|---|---|
| `GET` | `/audit-logs` | Audit-Logs auflisten (rate-limited) |
| `GET` | `/audit-logs/verify` | Chain-Integrität prüfen |
| `GET` | `/audit-logs/export/pdf` | Audit-Log als PDF |
| `GET` | `/audit-logs/export/json` | Audit-Log als JSON |

</TabItem>
<TabItem label="Nachrichten (Broadcast)">

| Methode | Pfad | Beschreibung |
|---|---|---|
| `POST/GET` | `/messages` | Nachricht erstellen/auflisten |
| `GET` | `/messages/recipient-count` | Empfänger-Vorschau |
| `GET/PATCH/DELETE` | `/messages/:id` | Nachricht-Verwaltung |
| `POST` | `/messages/:id/send` | Nachricht versenden |

</TabItem>
<TabItem label="Billing">

| Methode | Pfad | Beschreibung |
|---|---|---|
| `POST` | `/billing/run` | Rechnung erstellen (`super_admin`) |
| `GET` | `/billing/invoices` | Rechnungen auflisten |
| `GET` | `/billing/invoices/:id` | Einzelne Rechnung |
| `GET` | `/billing/invoices/:id/pdf` | Rechnung als PDF |

</TabItem>
<TabItem label="Suche">

| Methode | Pfad | Beschreibung |
|---|---|---|
| `GET` | `/search` | Globale Suche (mit oder ohne Tenant-Kontext) |

</TabItem>
</Tabs>

### Meeting-Alias-Routen (`/api/v1/t/:tenantId/m/:meetingSlug`)

Teilbare Links mit Tenant-Slug und Meeting-Slug. Die `TenantMiddleware` löst den Slug aus dem Pfad-Parameter `:tenantId` auf.

| Methode | Pfad | Rollen |
|---|---|---|
| `GET` | `/api/v1/t/:tenantId/m/:meetingSlug` | `tenant_admin`, `meeting_chair`, `owner` |

Diese Gruppe verwendet zusätzlich `MeetingEnabledMiddleware`.

### Portal-Endpunkte (`/api/v1/portal/...`)

Kundenportal-Endpunkte erfordern `portal_enabled=true` und ein Portal-Write-Rate-Limit (1 Request / 6 s, Burst 20).

<Tabs>
<TabItem label="Ordner & Dokumente">

| Methode | Pfad | Beschreibung |
|---|---|---|
| `GET` | `/portal/communities/:community_id/folders` | Ordnerbaum |
| `POST/GET/PUT/DELETE` | `/portal/folders` | Ordner-Verwaltung |
| `GET/POST` | `/portal/documents` | Dokumente auflisten/hochladen |
| `GET/PUT/DELETE` | `/portal/documents/:id` | Dokument-Verwaltung |
| `GET` | `/portal/documents/:id/download` | Dokument herunterladen |

</TabItem>
<TabItem label="Forum & Tickets">

| Methode | Pfad | Beschreibung |
|---|---|---|
| `GET/POST` | `/portal/forum/posts` | Forum-Themen |
| `GET` | `/portal/forum/posts/:id` | Einzelnes Thema |
| `POST` | `/portal/forum/posts/:id/replies` | Antwort erstellen |
| `DELETE` | `/portal/forum/posts/:id` | Beitrag löschen |
| `GET/POST` | `/portal/tickets` | Tickets auflisten/erstellen |
| `GET` | `/portal/tickets/:id` | Einzelnes Ticket |
| `POST` | `/portal/tickets/:id/messages` | Ticket-Nachricht |
| `PATCH` | `/portal/tickets/:id/status` | Ticket-Status |
| `DELETE` | `/portal/tickets/:id` | Ticket löschen |
| `GET` | `/portal/tickets/:id/attachments/:attachmentId` | Ticket-Anhang |

</TabItem>
<TabItem label="Notifications & Nachrichten">

| Methode | Pfad | Beschreibung |
|---|---|---|
| `GET` | `/portal/notifications` | Notifications auflisten |
| `POST` | `/portal/notifications/:id/read` | Als gelesen markieren |
| `POST` | `/portal/notifications/read-all` | Alle gelesen |
| `GET` | `/portal/notifications/unread-count` | Ungelesene Anzahl |
| `GET/PATCH` | `/portal/notifications/settings` | Notification-Einstellungen |
| `GET` | `/portal/notifications/vapid-public-key` | VAPID Public Key |
| `POST/DELETE` | `/portal/notifications/push/subscribe` | Push-Abonnement |
| `GET` | `/portal/messages` | Nachrichten-Posteingang |
| `POST` | `/portal/messages/:id/read` | Nachricht gelesen |
| `POST` | `/portal/messages/:id/archive` | Nachricht archivieren |

</TabItem>
</Tabs>

### WebSocket (`/ws/meetings/:meetingId`)

WebSocket-Endpunkt für Live-Updates. Authentifizierung und Tenant/Community-Access-Checks werden beim Upgrade-Handshake angewendet.

| Methode | Pfad | Beschreibung |
|---|---|---|
| `GET` | `/ws/meetings/:meetingId` | WebSocket-Upgrade |

<Aside type="note" title="WebSocket-Konfiguration">
  Ping/Pong-Zyklus: `WS_PONG_WAIT` (60s), `WS_PING_PERIOD` (54s), `WS_WRITE_WAIT` (10s). Buffer-Grössen: `WS_READ_BUFFER_SIZE` (1024), `WS_WRITE_BUFFER_SIZE` (1024). Max. Nachrichtengrösse: `WS_MAX_MESSAGE_SIZE` (4096). In Produktion werden Browser-Origin gegen `CORS_ORIGINS` geprüft; in Entwicklung sind alle Origin erlaubt.
</Aside>

WebSocket-Nachrichten übertragen Live-Meeting-Status, Abstimmungsfortschritt und Quorum-Updates.

### Statische Dateien

Die Angular-Frontend-Assets werden via `embed.FS` eingebettet und über Echo Static Files ausgeliefert (`dist/browser`). Nicht gefundene Pfade fallen auf `index.html` zurück (SPA-Routing, HTML5 History API).

## Fehlerbehandlung

Der `CustomErrorHandler` wandelt `AppError`-Instanzen in strukturierte JSON-Antworten um. Jeder Fehler enthält einen maschinenlesbaren `code` und eine `message`.

| Code | HTTP-Status | Beschreibung |
|---|---|---|
| `NOT_FOUND` | 404 | Ressource nicht gefunden |
| `CONFLICT` | 409 | Konflikt (z.B. Zustandsübergang) |
| `VALIDATION_ERROR` | 400 / 422 | Validierungsfehler |
| `UNAUTHORIZED` | 401 | Nicht authentifiziert |
| `FORBIDDEN` | 403 | Keine Berechtigung |
| `TENANT_MISMATCH` | 403 | Cross-Tenant-Zugriff |
| `INVALID_STATE_TRANSITION` | 409 | Ungültiger Zustandsübergang |
| `QUORUM_NOT_MET` | 409 | Versammlung nicht beschlussfähig |
| `VOTE_NOT_ALLOWED` | 403 | Abstimmung nicht erlaubt |
| `PROXY_INSTRUCTION_VIOLATION` | 409 | Vollmacht-Anweisung verletzt |
| `ALREADY_VOTED` | 409 | Bereits abgestimmt |
| `NOT_CHECKED_IN` | 403 | Nicht eingecheckt |
| `MEETING_NOT_OPEN` | 403 | Versammlung nicht geöffnet |
| `AGENDA_ITEM_NOT_OPEN` | 403 | Traktandum nicht geöffnet |
| `USER_NOT_LINKED` | 403 | Benutzer nicht verknüpft |
| `INTERNAL_ERROR` | 500 / 503 | Interner Fehler |

<LinkCard title="Architektur" href="../reference/architektur/" description="Übersicht der Schichten und Komponenten." />
<LinkCard title="Sicherheit" href="../reference/sicherheit/" description="Authentifizierung, RLS, Audit-Log und Verschlüsselung." />
