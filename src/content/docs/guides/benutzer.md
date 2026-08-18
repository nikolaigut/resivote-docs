---
title: Benutzer und Berechtigungen
description: Rollen, Mandanten-Isolation, Eigentümer-Verwaltung und Impersonation in ResiVote.
---

import { Aside, CardGrid, Card, LinkCard } from '@astrojs/starlight/components';

ResiVote trennt die Authentifizierungs-Identität (`User`) von der Eigentümer-Identität (`Owner`). Rollen werden mandantenbezogen in der Datenbank gespeichert, nicht aus JWT-Claims abgeleitet. Alle Daten sind mandanten-isoliert.

## User vs Owner

ResiVote entkoppelt bewusst die Login-Identität vom Eigentum:

- **`User`** (`internal/domain/entity/user.go`) – die Authentifizierungs-Identität. Enthält die ZITADEL-`sub` (`ExternalUserID`), E-Mail, Name und eine Rolle. `TenantID` ist nullable (`nil` für `super_admin`).
- **`Owner`** (`internal/domain/entity/owner.go`) – die Eigentums-Identität. Enthält Namen, E-Mail, Telefon und einen optionalen `UserID`-FK zur `users`-Tabelle. Ein Owner kann Einheiten in mehreren Gemeinschaften desselben Mandanten besitzen.

Die Verknüpfung passiert beim ersten Login: `LinkAllExternalUsersByEmail` verknüpft die ZITADEL-`sub` mit allen User-Records derselben E-Mail, die noch keine `ExternalUserID` haben.

### Owner-Eigenschaften

| Feld | Bedeutung |
|------|-----------|
| `ExternalUserID` | Globale Identität (mandantenübergreifend) |
| `UserID` | Optionaler FK zu `users` (nullable für Legacy-Daten) |
| `IsArchived` / `ArchivedAt` | Eigentümer als archiviert markiert |
| `TenantID` | Mandant – Eigentümer können nur innerhalb desselben Mandanten Einheiten besitzen |

## Rollen

ResiVote kennt vier Rollen (`internal/domain/entity/user.go`):

### tenant_admin

Der Mandanten-Administrator bereitet Versammlungen vor, lädt Teilnehmer ein, verwaltet Gemeinschaften und Einheiten und führt das Protokoll. Er sieht nur Daten seines eigenen Mandanten (`TenantID` gesetzt).

### super_admin

Der Super-Admin ist global (`TenantID = nil`). Er verwaltet Mandanten, hat Zugriff auf Super-Admin-Routen und kann Benutzer impersonieren. Die Rolle `super_admin` wird **nicht** in `UserTenantRole` gespeichert, sondern bleibt ein globaler JWT-Claim.

### meeting_chair

Der Vorsitzende leitet die Versammlung über das Vorsitz-Dashboard: er öffnet und schliesst Traktanden, startet Abstimmungen, erteilt Quorum-Overrides und steuert die Live-Ergebnis-Sichtbarkeit. Ein Frontend-Guard (`chair guard`) schützt die Vorsitz-Funktionen.

### owner

Der Eigentümer nimmt an Versammlungen teil, stimmt ab und sieht seine Dokumente im Portal. Die Eigentümer-Rolle ist die Standardrolle für stimmberechtigte Personen.

## UserTenantRole

`UserTenantRole` (`internal/domain/entity/user_tenant_role.go`) ist die **Wahrheitsquelle** für Mandanten-Zuordnungen – nicht die JWT-Claims. Ein Benutzer kann mehrere Einträge haben, einen pro Mandant.

<Aside type="warning" title="super_admin nicht hier gespeichert">
Die Rolle `super_admin` wird bewusst nicht in `UserTenantRole` abgelegt. Sie bleibt ein globaler JWT-Claim, da Super-Admins mandantenübergreifend operieren.
</Aside>

Erlaubte Rollen in `UserTenantRole`: `tenant_admin`, `meeting_chair`, `owner`.

## Mandanten-Isolation

ResiVote ist Multi-Tenant. Jede Entität trägt ein `TenantID`-Feld:

- `Owner.TenantID` – Eigentümer sind mandantenbezogen.
- `Document.TenantID` – Dokumente sind mandanten-isoliert.
- `Folder.TenantID` – Ordner sind mandanten-isoliert.
- `Meeting.TenantID` – Versammlungen gehören zu einem Mandanten.
- `AuditEntry.TenantID` – Audit-Logs sind mandanten-isoliert.

Super-Admins (`TenantID = nil`) operieren global. Alle anderen Benutzer sehen nur Daten ihres Mandanten. Die Mandanten-Isolation wird auf Datenbankebene (Row-Level Security) und auf Anwendungsebene (`ctxutil.TenantIDFromContext`) durchgesetzt.

## Eigentümer verwalten

Eigentümer sind stimmberechtigte Personen oder Organisationen, die eine oder mehrere Wohneinheiten besitzen. Sie werden mit Namen, Adresse und E-Mail erfasst und den entsprechenden Einheiten via `Ownership` zugeordnet.

Ein Eigentümer kann Einheiten in mehreren Gemeinschaften desselben Mandanten besitzen. Die Eigentumsanteile (`ShareNumerator`/`ShareDenominator`) bestimmen die Wertquote. `IsPrimaryVoter` markiert den Hauptwähler einer Einheit.

Archivierte Eigentümer (`IsArchived = true`) werden in der Verwaltung ausgeblendet, bleiben aber für historische Protokolle erhalten.

## Bevollmächtigte

Ein Eigentümer kann eine andere Person mit einer Vollmacht (`Proxy`) beauftragen, an seiner Stelle an der Versammlung teilzunehmen und abzustimmen. Vollmachten können frei oder mandatiert vergeben werden.

Der `VoteValidator` stellt sicher, dass nur der Bevollmächtigte (`GranteeID`) digital abstimmt – der Vollmachtgeber (`GrantorID`) wird gesperrt, solange eine aktive Vollmacht besteht. Mandatierte Stimmabgaben müssen mit der Weisung (`MandatedVote`) übereinstimmen.

## Impersonation

Super-Admins können die Identität eines anderen Benutzers annehmen (`internal/application/impersonation_service.go`). Der Vorgang nutzt ZITADEL Token Exchange (RFC 8693):

- Der Super-Admin tauscht seinen Access-Token gegen einen neuen JWT ein, der die Identität des Zielbenutzers annimmt.
- Der resultierende JWT enthält einen `act`-Claim, der den Impersonator identifiziert.
- Jede Aktion während der Impersonation wird im Audit-Log mit `ImpersonatedByID` protokolliert (Hash-Version v3).

<Aside type="note" title="Vollständige Nachvollziehbarkeit">
Die Impersonation ist im Audit-Log lückenlos nachvollziehbar. Die Hash-Kette (v3) bindet die Impersonator-Identität in jeden Audit-Eintrag ein.
</Aside>

## Zugang sicher gestalten

Jeder Benutzer meldet sich über ZITADEL (OIDC) an. Die Authentifizierung erfolgt über persönliche Links oder Einladungs-Codes (`RedeemInvitation`). Mandanten-Administratoren sehen nur die Daten ihres eigenen Mandanten.

Details zur Audit-Hash-Kette und Integritätsprüfung siehe `/reference/sicherheit/`.

## Weiterführende Links

<LinkCard title="Rollen-Referenz" href="/reference/rollen/" description="Detaillierte Rollen- und Berechtigungsdefinitionen." />
<LinkCard title="Sicherheit und Audit" href="/reference/sicherheit/" description="Hash-Ketten, Impersonation-Protokollierung und Integritätsprüfung." />
