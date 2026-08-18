---
title: Protokoll und Berichte
description: Live-Protokoll, KI-Vorschläge, Beweispakete und PDF-Berichte in ResiVote.
---

import { Steps, Aside, CardGrid, Card, LinkCard } from '@astrojs/starlight/components';

ResiVote führt das Versammlungsprotokoll während der Sitzung live und erzeugt am Ende prüffähige PDF-Berichte. Jede Protokollaktion wird auditiert und in einer manipulationssicheren Hash-Kette gespeichert.

## Live-Protokoll-Editor

Das Backend speichert Protokollnotizen pro Traktandum im Feld `DiscussionNotes` der `AgendaItem`-Entität (`internal/domain/entity/agenda_item.go`). Der Frontend-Editor (Angular, TipTap-basiert) sendet HTML an die API, die es als `text`-Spalte persistiert.

### Protokollführer festlegen

Die Versammlung legt zu Beginn fest, wer das Protokoll schreibt. Die Entität `Meeting` hält dazu zwei Felder (`internal/domain/entity/meeting.go`):

- **`ProtocolWriterType`** – `OWNER` oder `TENANT_ADMIN`
- **`ProtocolWriterOwnerID`** – zwingend bei `OWNER`, verboten bei `TENANT_ADMIN`

Der Service `meetingService` validiert die Kombination in `normalizeAndValidateProtocolWriter` (`internal/application/meeting_service.go`). Bei `OWNER` prüft er, dass die Person Eigentümer einer der Versammlungs-Gemeinschaften ist. Das Setzen des Protokollführers schliesst automatisch das prozedurale Traktandum «Protokollführung festlegen» (`AgendaItemTypeProtocol`), damit es nicht im finalen Protokoll erscheint.

### Schreibberechtigung

Die Methode `canWriteLiveProtocol` (`internal/application/meeting_service.go`) gewährt Schreibzugriff, wenn:

1. der Aufrufer die Rolle `tenant_admin` hat, oder
2. `ProtocolWriterType` = `OWNER` ist und der Aufrufer mit `ProtocolWriterOwnerID` übereinstimmt und der Versammlung angehört.

<Aside type="note" title="Protokollführer nur für Live-Versammlungen">
Der Protokollführer kann nur für `LIVE_MEETING`-Versammlungen gesetzt werden, nicht für `CIRCULAR_RESOLUTION` (Zirkularbeschluss). Die Methode `UpdateProtocolWriter` weist Änderungen an geschlossenen oder archivierten Versammlungen ab.
</Aside>

## KI-Protokollvorschläge

Der Service `meetingService.SuggestProtocolNotes` (`internal/application/meeting_ai_service.go`) generiert Entwürfe für Protokollpassagen. Der Aufrufer muss Schreibberechtigung am Live-Protokoll besitzen.

### Ablauf

<Steps>
  1. **Kontext sammeln** – Der Service lädt Versammlung, Traktandum, Anwesenheit und Abstimmungsergebnis.
  2. **Prompt bauen** – `buildSystemPrompt` und `buildUserPrompt` erzeugen einen deutschen System-Prompt (schweizerisches STWEG/MEG-Kontext) und einen User-Prompt mit Traktandum, Quorum, Anwesenheit und Ergebnis.
  3. **LLM aufrufen** – `AIProvider.GenerateProtocolNotes` sendet `AIGenerateRequest` (SystemPrompt, UserPrompt, MaxTokens 1024, Temperature 0.3) an den konfigurierten Provider.
  4. **HTML bereinigen** – `sanitizeHTML` filtert die Antwort durch bluemonday und erlaubt nur `<p>`, `<br>`, `<ul>`, `<ol>`, `<li>`, `<strong>`, `<em>`, `<u>`, `<h1>`, `<h2>`, `<h3>`, `<a>`.
  5. **Ergebnis zurückgeben** – `ProtocolNotesSuggestion` mit bereinigtem HTML, `TokensUsed` und `Provider`.
</Steps>

### Intents

Der Aufrufer übergibt einen `AIProtocolIntent` (`internal/application/ai_provider.go`), der steuert, was die KI tun soll:

| Intent | Beschreibung |
|--------|-------------|
| `continue` | Notizen als formellen Protokollabsatz weiterschreiben |
| `summarize` | Notizen und Diskussion als knapper Absatz zusammenfassen |
| `resolution` | Klaren Beschlusstext aus Abstimmungsergebnis formulieren |

### AI-Provider

Die Factory `ai.NewProvider` (`internal/infrastructure/ai/factory.go`) erzeugt den Provider aus der Konfiguration:

| Provider-Wert | Implementierung |
|---------------|----------------|
| `""` / `disabled` | `disabledProvider` – gibt `ServiceUnavailable` zurück |
| `mock` | `mockProvider` – statische Testantwort |
| `mistral` | `mistralProvider` – Mistral AI (EU-Endpoint, `mistral-small-latest`) |
| `ollama` | `ollamaProvider` – lokales Ollama (`llama3.1`, `localhost:11434`) |
| `llama` / `llama.cpp` | `mistralProvider` mit lokalem llama.cpp-Endpoint |

Wenn `LogOnly` aktiv ist, wird immer `mockProvider` verwendet – unabhängig vom konfigurierten Provider.

## Beweispakete (Evidence Service)

Der `EvidenceService` (`internal/application/evidence_service.go`) exportiert die manipulationssichere Audit-Hash-Kette einer Versammlung.

### Funktionen

- **`GenerateMeetingEvidencePDF`** – PDF mit allen Audit-Einträgen (Zeitstempel, Entität, Aktion, Akteur, IP, SHA-256-Hash-Auszug) und Integritätsstatus.
- **`GenerateMeetingEvidenceJSON`** – JSON-Export mit Versammlungsmetadaten, Verifizierungsstatus und allen Audit-Einträgen.
- **`VerifyMeetingEvidenceIntegrity`** – rechnet jede Hash-Kette nach (`ComputeHashWith` mit HMAC-Schlüssel) und meldet `valid`, `total_entries` und ggf. `broken_at_id`.

Die Hash-Kette verwendet Versionen v1 (SHA-256, ohne IP/UserAgent), v2 (SHA-256/HMAC, alle Felder) und v3 (v2 + `ImpersonatedByID`). Details zur Audit-Entität siehe `/reference/sicherheit/`.

## PDF-Berichte

Der `ReportService` (`internal/application/report_service.go`) erzeugt PDFs mit `gofpdf` (jung-kurt/gofpdf). Alle Berichte verwenden das ResiVote-Farbschema und binden das Logo ein.

### Verfügbare Berichte

<CardGrid>
  <Card title="Versammlungsprotokoll PDF" icon="document">
    `GenerateMeetingProtocolPDF` – vollständiges Protokoll mit Traktanden, Abstimmungsergebnissen, Anwesenheit und Stimmrechtsbegrenzung. Prozedurale `PROTOCOL`-Traktanden werden ausgefiltert.
  </Card>
  <Card title="Einladung PDF" icon="envelope">
    `GenerateInvitationPDF` – Einladungsdokument mit Datum, Ort und Tagesordnung.
  </Card>
  <Card title="Vollmachtskarte PDF" icon="id-card">
    `GenerateProxyCardPDF` – personalisierte Vollmachtskarte pro Eigentümer und Versammlung.
  </Card>
  <Card title="Kostenabrechnung PDF" icon="receipt">
    `GenerateCostStatementPDF` – Kostenabrechnung mit prozentualer Verteilung pro Einheit.
  </Card>
  <Card title="Kostenabrechnung CSV" icon="table">
    `GenerateCostStatementCSV` – dieselbe Abrechnung als CSV-Export.
  </Card>
  <Card title="Beweispaket PDF" icon="shield">
    `GenerateMeetingEvidencePDF` – Audit-Hash-Kette als PDF (via EvidenceService).
  </Card>
</CardGrid>

### PDF-Infrastruktur

Die PDF-Generierung basiert auf `github.com/jung-kurt/gofpdf` (Pure-Go, keine externen Binaries). Das Logo wird via `frontend.DistFS` (embed FS) geladen; falls nicht gefunden, sucht `loadLogo` alternative Pfade relativ zum Arbeitsverzeichnis und zur Executable.

Für die **Textextraktion aus Reglement-PDFs** nutzt ResiVote `internal/infrastructure/pdf/extractor.go`: zuerst `pdftotext` (poppler-utils, `-layout`), dann Fallback auf `github.com/ledongthuc/pdf`. Scanned-PDFs ohne Textlayer werden erkannt und zurückgewiesen.

## Audit-Log-Anbindung

Jede signifikante Aktion erzeugt einen `AuditEntry` (`internal/domain/entity/audit_entry.go`):

- **Append-only** – Einträge werden nie aktualisiert oder gelöscht.
- **Hash-Kette** – jeder Eintrag verweist auf `PreviousHash` und berechnet `Hash` über alle Felder.
- **Impersonation** – `ImpersonatedByID` protokolliert, wenn ein Super-Admin die Identität eines anderen Benutzers annimmt (Hash-Version v3).
- **Protokoll-Ereignisse** – Traktandum-Statuswechsel, Abstimmungsergebnisse und Protokollfinalisierung werden auditiert.

Details zur Hash-Berechnung und Integritätsprüfung siehe `/reference/sicherheit/`.

## Protokoll finalisieren

Nach Abschluss der Versammlung (`CLOSED`) finalisiert der Administrator das Protokoll:

<Steps>
  1. **Protokoll prüfen** – Der Administrator durchgeht alle Traktand-Notizen im Live-Editor.
  2. **PDF generieren** – `GenerateMeetingProtocolPDF` erzeugt das bindende Protokoll-Dokument.
  3. **Beweispaket exportieren** – `GenerateMeetingEvidencePDF` oder `-JSON` sichert die Audit-Kette.
  4. **Versammlung archivieren** – Statuswechsel `CLOSED` → `ARCHIVED`.
</Steps>

<Aside type="warning" title="Keine Nachträglichen Änderungen">
Nach dem Status `ARCHIVED` sind keine Änderungen mehr möglich. Die Audit-Hash-Kette macht jede nachträgliche Manipulation nachweisbar.
</Aside>

## Weiterführende Links

<LinkCard title="Sicherheit und Audit" href="/reference/sicherheit/" description="Hash-Ketten, HMAC und Integritätsprüfung." />
<LinkCard title="Quorum und Präsenz" href="/guides/quorum/" description="Beschlussfähigkeit und Quorum-Berechnung." />
