---
title: Datenmodell
description: Referenzdokumentation der ResiVote-Entitäten, Beziehungen und Datenbank-Migrationen.
---

import { Aside, LinkCard } from '@astrojs/starlight/components';

ResiVote verwaltet 31 Entitäten in `internal/domain/entity/`. Alle tenant-scoped Entitäten tragen ein `TenantID`-Feld (UUID), das PostgreSQL Row-Level Security (RLS) zur Isolation nutzt. Die Migrationen liegen im Verzeichnis `migrations/` und werden mit `golang-migrate` angewendet.

## Kern-Entitäten

### Tenant

Isolierte Liegenschaftsverwaltungs-Organisation. Jeder Tenant verwaltet eigene Communities, Owners und Meetings.

| Feld | Typ | Beschreibung |
|---|---|---|
| `ID` | UUID | Primärschlüssel |
| `Name` | string | Anzeigename |
| `Slug` | string (max 12) | Eindeutiger Slug, z. B. `mueller-hv` |
| `IsActive` | bool | Aktiv-Status |
| `PortalEnabled` | bool | Customer-Portal aktiviert |
| `MeetingEnabled` | bool | Digital-Meeting-Feature aktiviert |
| `EncryptedDEK` | *string | Base64-verschlüsselter Data Encryption Key (AES-GCM) |
| `DEKKeyVersion` | int | Schlüsselversion |
| `InvoiceSenderName/Street/City/VatNumber/QrIban` | string | Rechnungsabsender-Overrides |

### Community

Repräsentiert eine STWEG (Stockwerkeigentümergemeinschaft) oder MEG (Miteigentümergemeinschaft).

| Feld | Typ | Beschreibung |
|---|---|---|
| `ID` | UUID | Primärschlüssel |
| `TenantID` | UUID | Tenant-Zuordnung (FK) |
| `Name` | string | Name der Gemeinschaft |
| `Type` | CommunityType | `STWEG` oder `MEG` |
| `VotingRightsModel` | VotingRightsModel | `HEAD_AND_VALUE`, `HEAD_ONLY`, `VALUE_ONLY`, `CUSTOM_SHARES` |
| `TotalValueQuota` | int | Summe aller Wertquoten (z. B. 1000 für Tausendstel) |
| `EnableVotingRightsCap` | bool | Stimmrechtsbegrenzung aktiviert (Art. 712g ZGB) |
| `VotingRightsCapPct` | float64 | Maximaler Stimmrechtsanteil in Prozent |
| `ReglementHeadQuorumPct` | *float64 | Reglement-Override Kopfquorum |
| `ReglementValueQuorumPct` | *float64 | Reglement-Override Wertquorum |
| `ReglementMinOwners` | *int | Reglement-Override Mindestanzahl Owner |
| `InheritsOwners` | bool | MEG erbt Owner von verknüpften STWEGs |
| `DevelopmentID` | *uuid.UUID | Optionale Gruppierung unter Überbauung |

### Development (Überbauung)

Gruppiert eine oder mehrere Communities (STWEG und/oder MEG).

| Feld | Typ | Beschreibung |
|---|---|---|
| `ID` | UUID | Primärschlüssel |
| `TenantID` | UUID | Tenant-Zuordnung |
| `Name` | string | Name der Überbauung |
| `Address` | string | Adresse |

### CommunityLink

M:N-Joint-Tabelle zwischen STWEGs und MEGs.

| Feld | Typ | Beschreibung |
|---|---|---|
| `STWEGID` | UUID | FK auf Community (STWEG) |
| `MEGID` | UUID | FK auf Community (MEG) |
| `TenantID` | UUID | Tenant-Zuordnung |

### Unit

Einzelne Liegenschaftseinheit (Einheit/Objekt) innerhalb einer Community.

| Feld | Typ | Beschreibung |
|---|---|---|
| `ID` | UUID | Primärschlüssel |
| `CommunityID` | UUID | FK auf Community |
| `Designation` | string | Bezeichnung, z. B. "Wohnung 3.OG links" |
| `UnitNumber` | string | Einheitsnummer, z. B. "301" |
| `ValueQuota` | int | Wertquote in Tausendstel (STWEG) |
| `CustomShares` | int | Custom Shares (MEG) |
| `HeadVoteCount` | int | Anzeige-only; Quorum-Engine nutzt immer 1 (Art. 712o ZGB) |
| `ValidFrom` | time.Time | Gültig ab |
| `ValidUntil` | *time.Time | Gültig bis (optional) |
| `LandRegistryNumber` | string | Grundbuchnummer |
| `LandRegistryOffice` | string | Grundbuchamt/-kreis |

### Owner

Eigentümer (Eigentümer) innerhalb eines Tenants. Ein Owner kann Units in mehreren Communities besitzen, aber nur innerhalb desselben Tenants.

| Feld | Typ | Beschreibung |
|---|---|---|
| `ID` | UUID | Primärschlüssel |
| `TenantID` | UUID | Tenant-Zuordnung |
| `ExternalUserID` | string | Globale User-Identity (ZITADEL sub) |
| `UserID` | *uuid.UUID | Optionaler FK auf `users`-Tabelle |
| `FirstName` / `LastName` | string | Name |
| `Email` | string | Email |
| `IsArchived` | bool | Archiviert |
| `ArchivedAt` | *time.Time | Archivierungszeitpunkt |

### Ownership

M:N-Beziehung zwischen Owner und Unit. Unterstützt Miteigentum mit Bruchteilen.

| Feld | Typ | Beschreibung |
|---|---|---|
| `UnitID` | UUID | FK auf Unit |
| `OwnerID` | UUID | FK auf Owner |
| `ShareNumerator` | int | Zähler, z. B. 1 |
| `ShareDenominator` | int | Nenner, z. B. 2 → 50% |
| `IsPrimaryVoter` | bool | Primärer Stimmberechtigter bei Miteigentum |
| `ValidFrom` | time.Time | Gültig ab |
| `ValidUntil` | *time.Time | Gültig bis |

## Meeting und Abstimmung

### Meeting

Versammlung, die mehrere Communities umfassen kann.

| Feld | Typ | Beschreibung |
|---|---|---|
| `ID` | UUID | Primärschlüssel |
| `TenantID` | UUID | Tenant-Zuordnung |
| `Slug` | string (max 12) | Eindeutiger Slug pro Tenant |
| `Title` | string | Titel |
| `State` | MeetingState | `DRAFT`, `PUBLISHED`, `CHECK_IN`, `IN_PROGRESS`, `CLOSED`, `ARCHIVED` |
| `Mode` | MeetingMode | `LIVE_MEETING` oder `CIRCULAR_RESOLUTION` (Art. 712m Abs. 2 ZGB) |
| `ScheduledAt` | time.Time | Geplanter Termin |
| `CheckinMethod` | *CheckinMethod | `MANUAL`, `QR_CODE`, `SIGNATURE` |
| `ProtocolWriterType` | *ProtocolWriterType | `OWNER` oder `TENANT_ADMIN` |
| `LiveResultsVisibleTo` | *LiveResultsVisibility | `ALL` oder `CHAIR` |
| `RequireVoteConfirmation` | bool | Bestätigungspflicht für Stimmen |

**M:N-Beziehung:** `MeetingCommunity` (Join-Tabelle `meeting_communities`) verknüpft Meetings mit mehreren Communities.

### AgendaItem

Traktandum innerhalb eines Meetings.

| Feld | Typ | Beschreibung |
|---|---|---|
| `MeetingID` | UUID | FK auf Meeting |
| `CommunityID` | *uuid.UUID | NULL = alle Communities des Meetings |
| `OrderNumber` | int | Reihenfolge |
| `Type` | AgendaItemType | `MOTION`, `ELECTION`, `FREE_TEXT`, `PROTOCOL` |
| `State` | AgendaItemState | `PENDING`, `PRESENTING`, `PRE_VOTING`, `OPEN`, `CLOSED`, `SKIPPED` |
| `QuorumType` | QuorumType | `SIMPLE_MAJORITY`, `QUALIFIED_MAJORITY`, `UNANIMOUS`, `ABSOLUTE_MAJORITY`, `CUSTOM` |
| `CustomQuorumPct` | *float64 | Custom Quorum Prozent |
| `Candidates` | pq.StringArray | Kandidaten bei ELECTION |
| `QuorumOverride` | bool | Vorsitz kann Quorum-Block aufheben |
| `QuorumOverrideReason` | string | Begründung (Pflicht bei Override) |
| `TimerStartedAt` | *time.Time | Präsentations-Timer Start |
| `TimerDurationSeconds` | int | Timer-Dauer |

### Vote

Einzelne Stimme pro Unit pro Agenda-Item. **Immutable** — bei Änderung wird die alte Stimme als `IsSuperseded=true` markiert und eine neue Stimme erstellt.

| Feld | Typ | Beschreibung |
|---|---|---|
| `AgendaItemID` | UUID | FK auf AgendaItem |
| `UnitID` | UUID | FK auf Unit |
| `VoterID` | UUID | Owner, der abgestimmt hat |
| `ProxyID` | *uuid.UUID | Bei Stimmabgabe via Vollmacht |
| `Choice` | VoteChoice | `YES`, `NO`, `ABSTAIN`, `CANDIDATE`, `FREE_TEXT` |
| `CandidateName` | *string | Bei ELECTION |
| `FreeTextValue` | *string | Bei FREE_TEXT |
| `HeadVoteValue` | int | Standard 1 (Art. 712o ZGB) |
| `ValueQuota` | int | Snapshot der Unit-Wertquote zum Abstimmungszeitpunkt |
| `CustomShares` | int | Snapshot der Custom Shares |
| `IsPreVote` | bool | Stimme aus PRE_VOTING-Phase |
| `IsSuperseded` | bool | Durch neuere Stimme ersetzt |

### QuorumSnapshot

Friert den Anwesenheits-/Quorum-Zustand beim Öffnen eines Agenda-Items ein. Überdauert Server-Neustarts.

| Feld | Typ | Beschreibung |
|---|---|---|
| `AgendaItemID` | UUID | Eindeutig pro Agenda-Item |
| `SnapshotJSON` | json.RawMessage | Vollständiger Quorum-Snapshot als JSONB |
| `QuorumMetAtOpen` | bool | Quorum war beim Öffnen erfüllt |

## Vollmacht und Anwesenheit

### Proxy

Vollmacht eines Owners an einen anderen für ein Meeting und eine Unit.

| Feld | Typ | Beschreibung |
|---|---|---|
| `MeetingID` | UUID | FK auf Meeting |
| `GrantorID` | UUID | Owner, der die Vollmacht erteilt |
| `GranteeID` | UUID | Owner, der die Vollmacht erhält |
| `UnitID` | UUID | Betroffene Unit |
| `Scope` | ProxyScope | `FULL` (ganzes Meeting) oder `RESTRICTED` (spezifische TOPs) |
| `RevokedAt` | *time.Time | Widerrufszeitpunkt |

### ProxyInstruction

Mandatorye Stimmabgabe-Anweisung für eine Vollmacht.

| Feld | Typ | Beschreibung |
|---|---|---|
| `ProxyID` | UUID | FK auf Proxy |
| `AgendaItemID` | UUID | FK auf AgendaItem |
| `MandatedVote` | VoteChoice | Vorgeschriebene Stimmabgabe |

### Attendance

Check-in eines Owners für ein Meeting.

| Feld | Typ | Beschreibung |
|---|---|---|
| `MeetingID` | UUID | FK auf Meeting |
| `OwnerID` | UUID | FK auf Owner |
| `UnitID` | UUID | FK auf Unit |
| `Method` | AttendanceMethod | `CHECKIN`, `SELF_CHECKIN`, `SIGNATURE`, `VOTE` |
| `CheckedInAt` | time.Time | Check-in-Zeitpunkt |

### Presence und Signature

`PresenceRecord` und `CommunityPresence` sind berechnete DTOs (keine DB-Tabellen), die der `PresenceBuilder` aus Attendance-, Ownership- und Proxy-Daten aggregiert.

`Signature` speichert eine digitale Unterschrift aus dem Tablet-Check-in-Flow in einer separaten Tabelle. `SignatureUnit` verknüpft die Signatur mit allen abgedeckten Units (eigene + Vollmacht-Units). Beide Tabellen sind DB-level immutable (Trigger blocken UPDATE/DELETE/TRUNCATE).

## Dokumentenverwaltung

### Document

Datei im Customer-Portal. Zugriff wird über den zugeordneten Folder gesteuert.

| Feld | Typ | Beschreibung |
|---|---|---|
| `CommunityID` | *uuid.UUID | NULL = tenant-weit |
| `FolderID` | UUID | FK auf Folder |
| `Category` | string | `PROTOCOL`, `INVITATION`, `ANNUAL_ACCOUNT`, `REGULATION`, `NOTICE`, `FORM`, `OTHER` |
| `StorageKey` | string | Blob-Storage-Key (nicht serialisiert) |
| `FileName` | string | Originaldateiname |
| `MimeType` | string | MIME-Typ |
| `SizeBytes` | int64 | Dateigröße |

### Folder

Hierarchische Ordnerstruktur innerhalb einer Community oder eines Tenants.

| Feld | Typ | Beschreibung |
|---|---|---|
| `CommunityID` | uuid.NullUUID | NULL = tenant-weit |
| `ParentFolderID` | uuid.NullUUID | NULL = Root-Ordner |
| `OwnerID` | uuid.NullUUID | NULL = öffentlich; gesetzt = persönlicher Ordner |
| `Visibility` | string | `PUBLIC` oder `RESTRICTED` |
| `Path` | string | Materialisierter Pfad |

## Audit und Benutzer

### AuditEntry

Immutable Audit-Log-Einträge mit Hash-Chain. Jeder Eintrag enthält `PreviousHash` und `Hash` (HMAC-SHA-256 in Produktion). Drei Hash-Versionen: v1 (plain SHA-256, deprecated), v2 (alle Felder + optional HMAC), v3 (v2 + `ImpersonatedByID`).

| Feld | Typ | Beschreibung |
|---|---|---|
| `EntityType` | string | z. B. "vote", "meeting" |
| `EntityID` | UUID | Betroffene Entität |
| `Action` | string | z. B. "CREATED", "STATE_CHANGED", "VOTE_CAST" |
| `ActorID` | UUID | Ausführender Benutzer |
| `ImpersonatedByID` | *uuid.UUID | Super-Admin bei Impersonation |
| `OldValue` / `NewValue` | *string | JSON-Diff |
| `PreviousHash` | string | Hash des Vorgängereintrags |
| `Hash` | string | Eigener Hash |
| `HashVersion` | int | 1, 2 oder 3 |

### User

Authentifizierte Plattform-Identität (ZITADEL sub). Entkoppelt von Owner-Datensätzen.

| Feld | Typ | Beschreibung |
|---|---|---|
| `TenantID` | *uuid.UUID | Nullable für `super_admin` (global) |
| `ExternalUserID` | string | ZITADEL sub |
| `Email` | string | Email |
| `Role` | string | `tenant_admin`, `super_admin`, `meeting_chair`, `owner` |

### UserTenantRole

Source of Truth für Tenant-Zuweisungen. Ein User kann mehrere Einträge haben — einen pro Tenant. `super_admin` wird hier nicht gespeichert (globaler JWT-Claim).

| Feld | Typ | Beschreibung |
|---|---|---|
| `UserID` | UUID | FK auf User |
| `TenantID` | UUID | FK auf Tenant |
| `Role` | string | `tenant_admin`, `meeting_chair`, `owner` |

### UserInvitation

Ausstehende Einladung für einen neuen oder bestehenden User.

| Feld | Typ | Beschreibung |
|---|---|---|
| `TenantID` | UUID | FK auf Tenant |
| `Email` | string | Email des Eingeladenen |
| `Code` | string | Einladungscode |
| `Role` | string | Zugewiesene Rolle |
| `ExpiresAt` | time.Time | Ablaufzeitpunkt |

## Kommunikation und Portal

### Message und MessageCommunity

Broadcast-Kommunikation der Verwaltung an Communities. `MessageCommunity` ist die M:N-Join-Tabelle.

| Feld | Typ | Beschreibung |
|---|---|---|
| `AuthorID` | UUID | FK auf User |
| `Subject` / `Body` | string | Betreff und Inhalt |
| `Priority` | MessagePriority | `normal`, `important`, `pinned` |
| `ChannelInApp` / `ChannelEmail` / `ChannelPush` | bool | Versandkanäle |

### Notification und PushSubscription

In-App- und Push-Benachrichtigungen für Portal-User.

| Feld | Typ | Beschreibung |
|---|---|---|
| `UserID` | UUID | FK auf User |
| `Type` | NotificationType | `DOCUMENT`, `FORUM`, `TICKET`, `ANNOUNCEMENT` |
| `IsRead` | bool | Gelesen-Status |

`PushSubscription` speichert Browser-Push-Endpunkte (VAPID).

### Forum (ForumPost)

Öffentliches Community-Forum. Top-Level-Posts haben `ParentID == nil`; Replies referenzieren ihren Parent.

| Feld | Typ | Beschreibung |
|---|---|---|
| `CommunityID` | UUID | FK auf Community |
| `ParentID` | *uuid.UUID | NULL = Top-Level |
| `AuthorType` | ForumAuthorType | `OWNER` oder `ADMIN` |
| `IsPinned` | bool | Angepinnt |

### Ticket und TicketMessage

Privates Support-Ticket zwischen Owner und Verwaltung.

| Feld | Typ | Beschreibung |
|---|---|---|
| `CommunityID` | UUID | FK auf Community |
| `OwnerID` | UUID | FK auf Owner |
| `Category` | TicketCategory | `GENERAL`, `REQUEST`, `DEFECT`, `TENANT_CHANGE`, `COMPLAINT`, `ACCESS`, `OTHER` |
| `Status` | TicketStatus | `OPEN`, `RESOLVED`, `CLOSED` |

`TicketMessage` speichert Antworten. `TicketAttachment` speichert angehängte Dateien.

## Kostenverteilung und Abrechnung

### CostDistributionKey und CostDistributionUnitShare

Definiert eine Kostenart (Kostenart) für eine MEG und deren Verteilung auf Units.

| Feld | Typ | Beschreibung |
|---|---|---|
| `CommunityID` | UUID | FK auf Community |
| `Name` | string | z. B. "Allgemeine Anlagen" |
| `Type` | CostDistributionType | `EQUAL_PER_UNIT`, `VALUE_QUOTA`, `CUSTOM_SHARES`, `SELF_BORNE`, `BY_RESOLUTION` |

`CostDistributionUnitShare` definiert explizite Anteile pro Unit (nur `CUSTOM_SHARES` und `SELF_BORNE`).

### CostStatement und CostStatementPosition

Konkrete Abrechnung: ein Gesamtbetrag angewendet auf einen CostDistributionKey. Beim Erstellen werden automatisch `CostStatementPosition`-Einträge pro Unit berechnet und persistiert. Positionen sind immutable nach Erstellung.

### Invoice und InvoiceLineItem

SaaS-Abonnements-Rechnung für einen Tenant. Enthält eine `InvoiceLineItem` pro Community im Abrechnungszeitraum.

| Feld | Typ | Beschreibung |
|---|---|---|
| `PeriodStart` / `PeriodEnd` | time.Time | Abrechnungszeitraum |
| `TotalAmountCents` | int64 | Gesamtbetrag in Rappen |
| `Status` | InvoiceStatus | `DRAFT`, `PENDING`, `PAID`, `VOID` |
| `Source` | InvoiceSource | `AUTO` oder `MANUAL` |

### ScheduledEmail

Terminierte transaktionale Email für ein Meeting. Ein Background-Worker verarbeitet fällige Einträge.

| Feld | Typ | Beschreibung |
|---|---|---|
| `MeetingID` | UUID | FK auf Meeting |
| `Type` | ScheduledEmailType | `INVITATION`, `REMINDER`, `CLOSED` |
| `DeliveryStatus` | ScheduledEmailDeliveryStatus | `pending`, `sent`, `failed`, `dead_letter` |
| `RetryCount` | int | Anzahl Versuche |
| `NextRetryAt` | *time.Time | Nächster Retry-Zeitpunkt |

## Anhänge und Präsentation

### AgendaItemAttachment und AgendaItemSlide

Datei- oder Slide-Deck-Anhang für ein Traktandum. `Kind`: `DOCUMENT`, `PRESENTATION`, `SLIDES`. `AgendaItemSlide` speichert einzelne Slides als JSONB-Content.

### MeetingAttachment

Datei, die einem Meeting als Ganzes zugeordnet ist (nicht einem spezifischen Traktandum).

## Migrationen und RLS

Das Verzeichnis `migrations/` enthält 43 versionierte SQL-Migrationen (golang-migrate-Format, `NNNNNN_description.up.sql` / `.down.sql`).

<Aside type="note" title="RLS-Policies">
Migration `000001` definiert die initialen RLS-Policies (`tenant_isolation_policy`) mit `USING`-Klausel für Lesezugriff. Migration `000004` ergänzt alle Policies um `WITH CHECK`-Klauseln, die auch Schreibzugriff (INSERT/UPDATE) validieren — ein fehlerhafter Application-Code kann keine Zeilen in den Tenant-Raum eines anderen Tenants schreiben.
</Aside>

Weitere wichtige Migrationen:

- `000005` — `quorum_snapshots`-Tabelle
- `000012` — `agenda_item_attachments`-Tabelle
- `000014`/`000015` — `portal_enabled`/`meeting_enabled` auf Tenant
- `000016` — Portal-Dokumente
- `000017` — Forum-Posts
- `000018` — Tickets
- `000019`/`000020` — Notifications + RLS
- `000027` — Invoices
- `000028` — Messages
- `000031` — Developments (Überbauungen)
- `000038` — Meeting-Attachments
- `000043` — Tenant-Meeting-Slugs

Audit- und Signature-Tabellen haben DB-Level-Trigger, die `UPDATE`, `DELETE` und `TRUNCATE` blockieren (Migration `000001`). Ein Event-Trigger (`audit_entries_ddl_guard`) blockiert DDL auf `audit_entries`, ausgenommen im Wartungsmodus (`app.maintenance=on`).

<LinkCard title="Architektur" description="Schichten, Request-Flow und Technologie-Stack" href="/reference/architektur/" />
