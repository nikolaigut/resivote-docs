---
title: Funktionen
description: Die wichtigsten Funktionen von ResiVote im Überblick – digital, transparent und rechtskonform.
---

import { CardGrid, Card, LinkCard } from '@astrojs/starlight/components';

ResiVote bietet alle Werkzeuge, um Eigentümerversammlungen digital, transparent und rechtskonform durchzuführen. Jede Funktion ist in der Codebasis implementiert und durch Audit-Logs absicherbar.

## Digitale Versammlungen

ResiVote unterstützt zwei Versammlungsmodi (`MeetingMode` in `internal/domain/entity/meeting.go`):

- **`LIVE_MEETING`** — Live-Versammlung (physisch, digital oder hybrid). Eigentümer nehmen per Webbrowser live teil und stimmen in Echtzeit ab.
- **`CIRCULAR_RESOLUTION`** — Zirkularbeschluss (Art. 712m Abs. 2 ZGB). Asynchrone Abstimmung mit definiertem Start- und Enddatum (`circular_voting_start`, `circular_voting_end`).

Eine Versammlung kann mehrere Communities (STWEG/MEG) umfassen (`meeting_communities`-Join-Tabelle). Der Versammlungs-Lebenszyklus durchläuft die Zustände `DRAFT` → `PUBLISHED` → `CHECK_IN` → `IN_PROGRESS` → `CLOSED` → `ARCHIVED`.

## Abstimmungen und Beschlüsse

Jedes Traktandum (`AgendaItem`) definiert einen Abstimmungstyp:

- **`MOTION`** — Ja/Nein/Enthaltung
- **`ELECTION`** — Kandidatenwahl (`candidates`-Liste, `CANDIDATE`-Choice)
- **`FREE_TEXT`** — Freitext-Vorschlag (`FREE_TEXT`-Choice)
- **`PROTOCOL`** — Protokollführung festlegen (ohne Abstimmung)

Das Stimmgewicht richtet sich nach dem Stimmrechtsmodell der Community (`VotingRightsModel`):

- **`HEAD_AND_VALUE`** — Kopfstimme und Wertquote (STWEG-Standard)
- **`HEAD_ONLY`** — Eine Unit, eine Stimme
- **`VALUE_ONLY`** — Nur Wertquote (MEA/Tausendstel)
- **`CUSTOM_SHARES`** — Benutzerdefinierte Anteile pro Unit (MEG-spezifisch)

Zusätzliche Abstimmungsfeatures:

- **Analoge Bulk-Stimmen** — Chair/Admin erfasst Stimmen für anwesende Eigentümer, die nicht digital abstimmen (`CastAnalogVote`, `CastBulkAnalogVotes`)
- **Pre-Voting** — Asynchrone Vorabstimmung (`PRE_VOTING`-Zustand, `IsPreVote`-Flag auf Votes)
- **Live-Ergebnissichtbarkeit** — Konfigurierbar pro Versammlung: `ALL` (alle Teilnehmer) oder `CHAIR` (nur Chair/Admin)
- **Stimmbestätigung** — `RequireVoteConfirmation` erzwingt eine Bestätigung der Stimme
- **Quorum-Override** — Chair kann das Quorum für ein Traktandum aufheben (`QuorumOverride` mit obligatorischer `QuorumOverrideReason`)
- **Stimmen-Immutabilität** — Geänderte Stimmen werden als `IsSuperseded=true` markiert; eine neue Vote-Record wird erstellt

## Vollmachten

Eigentümer übertragen ihr Stimmrecht digital an einen Bevollmächtigten (`Proxy` in `internal/domain/entity/proxy.go`):

- **`FULL`** — Vollmacht für die gesamte Versammlung
- **`RESTRICTED`** — Vollmacht für spezifische Traktanden

Bei `RESTRICTED` definiert `ProxyInstruction` eine obligatorische Stimmabgabe (`mandated_vote`) für ein spezifisches Traktandum. Der Bevollmächtigte muss gemäss Anweisung abstimmen — ein Verstoß löst `PROXY_INSTRUCTION_VIOLATION` aus.

Vollmachten sind pro Unit (`UnitID`) und pro Versammlung (`MeetingID`) definiert und können widerrufen werden (`RevokedAt`).

## Check-in

Drei Check-in-Methoden (`CheckinMethod`):

- **`MANUAL`** — Chair/Admin markiert Teilnehmer manuell (immer verfügbar)
- **`QR_CODE`** — Eigentümer scannt einen QR-Code mit dem Smartphone und führt einen Self-Check-in durch (`SelfCheckIn`). Der QR-Token ist ein signiertes JWT mit `meeting_id`-Claim.
- **`SIGNATURE`** — Eigentümer wählt sich auf dem Tablet des Admins aus und unterschreibt digital; alle eigenen Units (und Vollmacht-Units) werden als anwesend markiert

Check-in-Tokens werden mit `CHECKIN_TOKEN_SIGNING_KEY` (HMAC-SHA-256, >= 32 Bytes in Produktion) signiert und haben eine konfigurierbare Gültigkeitsdauer (`CHECKIN_TOKEN_EXPIRY`, Default 30m).

## Protokolle

- **Live-Editor** — Protokollnotizen pro Traktandum (`DiscussionNotes`, `UpdateAgendaItemNotes`)
- **AI-Vorschläge** — KI-generierte Protokollvorschläge (`SuggestProtocolNotes`); Provider: `mistral`, `ollama`, `llama`, `mock`, `disabled`
- **Protokollführer** — Zuweisbar pro Versammlung (`ProtocolWriterOwnerID`, `ProtocolWriterType`: `OWNER` oder `TENANT_ADMIN`)
- **PDF-Reports** — Protokoll als PDF (`DownloadMeetingProtocolPDF`), Einladung als PDF (`DownloadInvitationPDF`), Vollmachtskarte als PDF (`DownloadProxyCardPDF`)
- **Beweispaket** — PDF + JSON + Integritätsverifikation pro Versammlung (`EvidenceHandler`)

## Dokumente

Das Kundenportal (`portal_enabled`) bietet Dokumentenverwaltung:

- **Ordner** — Hierarchische Ordnerstruktur (`Folder`, Visibility `PUBLIC` oder `RESTRICTED`)
- **Kategorien** — `PROTOCOL`, `INVITATION`, `ANNUAL_ACCOUNT`, `REGULATION`, `NOTICE`, `FORM`, `OTHER`
- **Reglement-Import** — Zweiphasig: extrahieren (`reglement-extract`) → bestätigen (`reglement-confirm`); verwendet AI-Provider für LLM-Extraktion
- **Verschlüsselung at Rest** — Mandanten-spezifische DEKs (Data Encryption Keys) werden mit dem `DOCUMENT_ENCRYPTION_MASTER_KEY` gewrappt (`TenantKeyProvider`, `DocumentEncryption`)
- **Storage-Backends** — Local Filesystem (`./uploads`) oder S3-kompatibel (`STORAGE_TYPE=s3`)
- **PDF-Konvertierung** — LibreOffice (`soffice`) für Dokument-zu-PDF-Konvertierung (`CONVERTER_ENABLED`)

## Quorum

Fünf Quorum-Typen pro Traktandum (`QuorumType` in `internal/domain/entity/agenda_item.go`):

- **`SIMPLE_MAJORITY`** — JA > 50% der anwesenden/vertretenen Kopfstimmen
- **`QUALIFIED_MAJORITY`** — JA > 50% der anwesenden/vertretenen Eigentümer (Köpfe) UND > 50% aller berechtigten Wertquoten (Art. 647b/d/e, Art. 712g Abs. 3 ZGB)
- **`UNANIMOUS`** — 100% aller registrierten Eigentümer und Wertquoten müssen JA stimmen (Art. 647e ZGB)
- **`ABSOLUTE_MAJORITY`** — JA > 50% aller registrierten Eigentümer (unabhängig von Anwesenheit)
- **`CUSTOM`** — JA >= `custom_quorum_pct`% der konfigurierten Basis (`PRESENT` oder `ELIGIBLE`)

Der Live-Quorum-Engine (`LiveQuorumEngine`, `LiveQuorumService`) berechnet das Quorum in Echtzeit und publiziert Updates via WebSocket. Reglement-Overrides (`reglement_head_quorum_pct`, `reglement_value_quorum_pct`, `reglement_min_owners`) überschreiben die Community-Typ-Defaults (STWEG: 50/50/2, MEG: 50/50/1).

## Forum & Tickets

- **Forum** — Öffentliches Community-Forum für Eigentümer und Verwaltung (`ForumHandler`: Themen erstellen, antworten, löschen)
- **Tickets** — Private Support-Anfragen zwischen Eigentümer und Verwaltung (`TicketHandler`: erstellen, Nachrichten hinzufügen, Status aktualisieren, Anhänge herunterladen)

Beide Features sind im Kundenportal (`/api/v1/portal/...`) verfügbar und erfordern `portal_enabled=true`.

## Nachrichten

Das Nachrichten-Center (`MessageHandler`, `MessageService`) ermöglicht Broadcasts an Communities:

- Nachrichten mit Empfänger-Vorschau (`PreviewRecipientCount`)
- Entwurf- und Sendestatus-Verwaltung
- Eigentümer-Posteingang im Portal (`ListForOwner`, `MarkRead`, `Archive`)

## Notifications

- **In-App** — Notifications-Liste, ungelesene Anzahl, als gelesen markieren
- **E-Mail** — Integration via Resend-API
- **Web Push** — Browser-Push-Notifications via VAPID (`WebPushSender`); Push-Abonnements verwalten (`SubscribePush`, `UnsubscribePush`)
- **Einstellungen** — Pro Eigentümer konfigurierbare Notification-Settings

## Abrechnung

- **Billing-Worker** — Erstellt monatlich Rechnungen für alle aktiven Tenants (`BILLING_WORKER_INTERVAL`, Default 1h)
- **Rechnungen** — PDF-Export (`DownloadInvoicePDF`), Tenant-spezifische Absender-Overrides
- **SaaS-Metriken** — Super-Admin-Billing-Übersicht (`/api/v1/admin/billing/tenants`)
- **Kostenverteilung** — Verteilungsschlüssel und Kostenabrechnungen für MEG (`CostDistributionHandler`, PDF/CSV-Export)

## Audit-Log

- **Immutable Hash-Chain** — Jeder Audit-Eintrag wird mit HMAC-SHA-256 (`AUDIT_HASH_KEY`) verkettet
- **Fail-Closed** — Bei Tamper-Erkennung verweigert der Server den Dienst (`AUDIT_FAIL_CLOSED`, Schwellwert `AUDIT_FAIL_CLOSED_THRESHOLD`)
- **Startup-Verifikation** — Chain-Integrität wird beim Start geprüft; bei Bruch und Fail-Closed erfolgt `os.Exit(1)`
- **Periodische Verifikation** — Alle `AUDIT_VERIFY_INTERVAL` (5m) wird die Chain geprüft
- **Immutability-Enforcement** — DB-Trigger und Non-Superuser-Role werden beim Startup verifiziert
- **Export** — Audit-Log als PDF oder JSON (`DownloadAuditPDF`, `DownloadAuditJSON`)
- **ZertES/nDSG** — Integritätsnachweis gegen Datenbank-Manipulation erfordert HMAC-Schlüssel >= 32 Bytes

## Mehrsprachig

Das Frontend unterstützt die Sprachen **DE**, **FR**, **IT** und **EN** (`SUPPORTED_LANGUAGES` in `language.store.ts`, Default: `de`). Die Sprache wird aus `localStorage`, Browser-Sprache oder Default aufgelöst. Dokument-Kategorien sind mit i18n-Keys synchronisiert.

## Globale Suche

Die `/api/v1/search`-Endpoint durchsucht mandanten-scoped (für `tenant_admin`) oder plattformweit (für `super_admin`) alle indizierten Ressourcen (`SearchService`, `SearchHandler`).

## Demo-Modus

Der optionale Demo-Modus (`DemoResetConfig`) rotiert täglich einen Demo-Tenant:

- Worker läuft um 00:00 UTC + `DEMO_RESET_RESET_OFFSET`
- Hard-Delete (`DEMO_RESET_HARD_DELETE`) oder Archivierung des alten Demo-Tenants
- Re-Seeding mit Beispieldaten (Tenant, Community, Owners, Units)
- Manueller Trigger via `POST /internal/demo-reset` (API-Key-geschützt) oder `POST /api/v1/admin/system/demo-reset` (Super-Admin)
- Demo-Slug muss `demo` sein (`Config.Validate`)

<CardGrid>
<Card title="REST API" href="../reference/api/">Endpunkte und Middlewares</Card>
<Card title="Konfiguration" href="../reference/konfiguration/">Umgebungsvariablen</Card>
<Card title="Deployment" href="../reference/deployment/">Entwicklung und Produktion</Card>
<Card title="Glossar" href="../reference/glossar/">Begriffe und Abkürzungen</Card>
</CardGrid>
