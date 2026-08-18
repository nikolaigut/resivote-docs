---
title: So funktioniert ResiVote
description: Der Ablauf einer digitalen Eigentümerversammlung mit ResiVote – vom Entwurf bis zum archivierten Protokoll.
---

import { Steps, Aside, CardGrid, Card, LinkCard } from '@astrojs/starlight/components';

ResiVote begleitet euch vom Entwurf bis zum signierten Protokoll – alles in einem digitalen Raum. Eine Versammlung durchläuft eine definierte Zustandsmaschine (`internal/domain/entity/meeting.go`):

`DRAFT` → `PUBLISHED` → `CHECK_IN` → `IN_PROGRESS` → `CLOSED` → `ARCHIVED`

Neben der Live-Versammlung unterstützt ResiVote den Zirkularbeschluss (`CIRCULAR_RESOLUTION`, Art. 712m Abs. 2 ZGB) als Alternative.

## 1. Versammlung vorbereiten

Die Versammlung startet im Zustand `DRAFT`. Der Administrator legt Datum, Uhrzeit, Ort und Titel fest.

### Mehrere Gemeinschaften

Eine Versammlung kann mehrere Gemeinschaften umfassen (`Meeting.Communities` via `meeting_communities`-Join-Tabelle). Gemeinschaften können zu einer Überbauung (`Development`) gruppiert sein – ein STWEG plus ein zugehöriges MEG in derselben Versammlung.

### Traktanden

Jedes Traktandum (`AgendaItem`) definiert:

- **Typ** – `MOTION` (Ja/Nein/Enthaltung), `ELECTION` (Wahl), `FREE_TEXT` (Freitext-Vorschlag), `PROTOCOL` (Protokollführung festlegen, ohne Abstimmung)
- **Quorum** – `SIMPLE_MAJORITY`, `QUALIFIED_MAJORITY`, `UNANIMOUS`, `ABSOLUTE_MAJORITY` oder `CUSTOM` mit eigenem Prozentsatz
- **Gemeinschaft** – `CommunityID` = `nil` bedeutet «alle Gemeinschaften der Versammlung»

Details zu Quorum-Typen siehe `/guides/quorum/`.

## 2. Teilnehmer einladen

Der Wechsel zu `PUBLISHED` verschickt die Einladungen.

### Geplante E-Mails

Einladungen werden als `ScheduledEmail` (`internal/domain/entity/scheduled_email.go`) persistiert. Ein Background-Worker holt fällige Zeilen ab und sendet sie. Typen: `INVITATION`, `REMINDER`, `CLOSED`. Status: `pending` → `sent` (oder `failed`/`dead_letter` mit Retry).

### Einladungs-PDF und Vollmachtskarte

Der `ReportService` erzeugt pro Empfänger eine Einladungs-PDF (`GenerateInvitationPDF`) und eine personalisierte Vollmachtskarte (`GenerateProxyCardPDF`). Beide werden als Anhang mitgesendet.

### OIDC-Login

Die Authentifizierung erfolgt über ZITADEL (OIDC). Eigentümer melden sich mit ihrem persönlichen Link an. Die Zuordnung von ZITADEL-Identität (`ExternalUserID`/`sub`) zu Eigentümer-Record erfolgt beim ersten Login automatisch (`LinkAllExternalUsersByEmail`).

## 3. Versammlung durchführen

Der Administrator öffnet die Versammlung (`CHECK_IN`), dann startet er sie (`IN_PROGRESS`).

### Check-in-Methoden

Die Versammlung konfiguriert eine `CheckinMethod` (`internal/domain/entity/meeting.go`):

| Methode | Ablauf |
|---------|--------|
| `MANUAL` | Vorsitz/Admin markiert Teilnehmer manuell (Standard) |
| `QR_CODE` | Eigentümer scannen einen QR-Code mit dem Smartphone (Self-Check-in) |
| `SIGNATURE` | Eigentümer wählen sich aus einem Dropdown auf dem Tablet des Admins und signieren digital; alle eigenen Einheiten und Vollmacht-Einheiten werden als anwesend markiert |

### Vorsitz-Dashboard und Live-Protokoll

Der Vorsitz (`meeting_chair`) steuert die Versammlung über ein Dashboard: Traktanden öffnen/schliessen, Abstimmungen starten, Live-Ergebnisse einsehen. Das Live-Protokoll wird parallel geführt – der Protokollführer (`OWNER` oder `TENANT_ADMIN`) schreibt Notizen pro Traktandum.

### WebSocket-Live-Updates

Präsenz, Quorum-Status und Abstimmungsergebnisse werden in Echtzeit über WebSocket an alle Teilnehmer gepusht. Der `presenceBuilder` (`internal/application/presence_builder.go`) ist an den WebSocket-Hub angebunden und broadcastet Präsenz-Änderungen sofort.

## 4. Beschlüsse fassen

Jedes Traktandum durchläuft Zustände (`internal/domain/entity/agenda_item.go`):

`PENDING` → `PRESENTING` → `PRE_VOTING` (optional) → `OPEN` → `CLOSED` (oder `SKIPPED`)

### Stimmabgabe

Der `VoteValidator` (`internal/domain/service/vote_validator.go`) prüft vor jeder Stimmabgabe:

1. Versammlung ist `IN_PROGRESS` (oder `PRE_VOTING` bei asynchroner Vorabstimmung)
2. Traktandum ist `OPEN` oder `PRE_VOTING`
3. Quorum beim Öffnen war erreicht – oder der Vorsitz hat einen `QuorumOverride` erteilt
4. Einheit gehört zu einer Gemeinschaft der Versammlung
5. Traktandum gilt für die Gemeinschaft der Einheit
6. Wähler ist Hauptwähler (`PrimaryOwnership`) oder Bevollmächtigter (`Proxy.GranteeID`)
7. Bei Vollmacht: deckt das Traktandum ab? Stimmt die Stimmabgabe mit der Weisung überein?
8. Check-in erforderlich (falls `RequirePreCheckin`)

### Kopf-Stimmen und Wertquoten

Je nach `VotingRightsModel` der Gemeinschaft zählen Kopf-Stimmen (`HEAD_AND_VALUE`, `HEAD_ONLY`), Wertquoten (`HEAD_AND_VALUE`, `VALUE_ONLY`) oder benutzerdefinierte Anteile (`CUSTOM_SHARES`). Die Stimmrechtsbegrenzung (`EnableVotingRightsCap`, Art. 712g ZGB) kappelt Kopf-Stimmen bei Überschreitung des reglementarischen Prozentsatzes.

### Quorum-Engine und Ergebnisse

Der `QuorumEngine` (`internal/domain/service/quorum_engine.go`) berechnet pro Gemeinschaft Kopf-Stimmen und Wertquoten, vergleicht mit dem Schwellwert und erzeugt ein `AgendaItemResult` mit `OverallPassed`. Details siehe `/guides/quorum/`.

### Live-Ergebnis-Sichtbarkeit

`LiveResultsVisibleTo` steuert, wer Live-Ergebnisse sieht: `ALL` (alle Teilnehmer) oder `CHAIR` (nur Vorsitz/Admin).

## 5. Protokoll abschliessen

Nach dem letzten Traktandum wechselt die Versammlung zu `CLOSED`, dann zu `ARCHIVED`.

### Protokoll-PDF

`GenerateMeetingProtocolPDF` erzeugt das bindende Protokoll mit allen Traktanden, Abstimmungsergebnissen, Anwesenheiten und Stimmrechtsbegrenzungen. Prozedurale `PROTOCOL`-Traktanden werden ausgefiltert. Details siehe `/guides/protokoll/`.

### Audit-Log und Beweispaket

Jede Aktion wurde während der Versammlung in der Audit-Hash-Kette protokolliert (`AuditEntry`, SHA-256/HMAC). Das Beweispaket (`GenerateMeetingEvidencePDF`/`-JSON`) exportiert die komplette Kette mit Integritätsverifikation. Details siehe `/reference/sicherheit/`.

### Archivierung

Nach `ARCHIVED` sind keine Änderungen mehr möglich. Die Audit-Hash-Kette macht jede nachträgliche Manipulation nachweisbar.

<Aside type="note" title="Zirkularbeschluss">
Im Modus `CIRCULAR_RESOLUTION` entfallen Check-in und Live-Sitzung. Eigentümer stimmen asynchron innerhalb eines Zeitfensters (`CircularVotingStart`/`CircularVotingEnd`) ab. Die Quorum-Engine und das Protokoll funktionieren analog.
</Aside>

## Weiterführende Links

<LinkCard title="Protokoll und Berichte" href="/guides/protokoll/" description="Live-Protokoll, KI-Vorschläge und PDF-Berichte." />
<LinkCard title="Quorum und Präsenz" href="/guides/quorum/" description="Beschlussfähigkeit und Quorum-Berechnung." />
<LinkCard title="Benutzer und Berechtigungen" href="/guides/benutzer/" description="Rollen, Mandanten und Zugriffskontrolle." />
