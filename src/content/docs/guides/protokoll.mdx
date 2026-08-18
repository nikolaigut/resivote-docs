---
title: Protokoll und Berichte
description: Live-Protokoll, KI-Vorschläge, Beweispakete und PDF-Berichte in ResiVote.
---

import { Steps, Aside, CardGrid, Card, LinkCard } from '@astrojs/starlight/components';

ResiVote führt das Versammlungsprotokoll während der Sitzung live und erzeugt am Ende prüffähige PDF-Berichte. Jede Protokollaktion wird auditiert und in einer manipulationssicheren Hash-Kette gespeichert.

## Live-Protokoll-Editor

ResiVote speichert Protokollnotizen pro Traktandum. Der Editor sendet formatierten Text an die API, der als Text gespeichert wird.

### Protokollführer festlegen

Die Versammlung legt zu Beginn fest, wer das Protokoll schreibt:

- **Protokollführer-Typ** – Eigentümer oder Mandanten-Admin
- **Eigentümer** – zwingend bei Eigentümer, nicht erlaubt bei Mandanten-Admin

Das System validiert die Kombination. Bei Eigentümer prüft es, dass die Person Eigentümer einer der Versammlungs-Gemeinschaften ist. Das Setzen des Protokollführers schliesst automatisch das prozedurale Traktandum «Protokollführung festlegen», damit es nicht im finalen Protokoll erscheint.

### Schreibberechtigung

Schreibzugriff auf das Live-Protokoll erhalten:

1. Mandanten-Administratoren, oder
2. der festgelegte Protokollführer, sofern er der Versammlung angehört.

<Aside type="note" title="Protokollführer nur für Live-Versammlungen">
Der Protokollführer kann nur für Live-Versammlungen gesetzt werden, nicht für Zirkularbeschlüsse. Änderungen an geschlossenen oder archivierten Versammlungen werden abgewiesen.
</Aside>

## KI-Protokollvorschläge

ResiVote kann Entwürfe für Protokollpassagen generieren. Der Aufrufer muss Schreibberechtigung am Live-Protokoll besitzen.

### Ablauf

<Steps>
  1. **Kontext sammeln** – Das System lädt Versammlung, Traktandum, Anwesenheit und Abstimmungsergebnis.
  2. **Prompt bauen** – ResiVote erzeugt einen System-Prompt (schweizerisches STWEG/MEG-Kontext) und einen User-Prompt mit Traktandum, Quorum, Anwesenheit und Ergebnis.
  3. **KI aufrufen** – Der konfigurierte KI-Anbieter generiert den Vorschlag.
  4. **Bereinigen** – Die Antwort wird bereinigt, nur erlaubte Formatierungen werden übernommen.
  5. **Ergebnis zurückgeben** – bereinigter Vorschlag mit Verbrauchskennzahlen.
</Steps>

### Intents

Der Aufrufer übergibt einen Intent, der steuert, was die KI tun soll:

| Intent | Beschreibung |
|--------|-------------|
| Weiter schreiben | Notizen als formellen Protokollabsatz weiterschreiben |
| Zusammenfassen | Notizen und Diskussion als knapper Absatz zusammenfassen |
| Beschluss formulieren | Klaren Beschlusstext aus Abstimmungsergebnis formulieren |

### KI-Anbieter

Der KI-Anbieter wird aus der Konfiguration erzeugt:

| Anbieter | Beschreibung |
|----------|-------------|
| Deaktiviert | KI-Funktion nicht verfügbar |
| Mock | Statische Testantwort |
| Mistral | Mistral AI (EU-Endpoint) |
| Ollama | Lokales Ollama |
| llama.cpp | Lokaler llama.cpp-Endpoint |

Wenn die Protokollierung aktiv ist, wird immer die Mock-Antwort verwendet – unabhängig vom konfigurierten Anbieter.

## Beweispakete

ResiVote exportiert die manipulationssichere Audit-Hash-Kette einer Versammlung.

### Funktionen

- **PDF-Export** – PDF mit allen Audit-Einträgen (Zeitstempel, Entität, Aktion, Akteur, IP, Hash-Auszug) und Integritätsstatus.
- **JSON-Export** – JSON-Export mit Versammlungsmetadaten, Verifizierungsstatus und allen Audit-Einträgen.
- **Integritätsverifikation** – rechnet die Hash-Kette nach und meldet Status und ggf. die Stelle eines Bruchs.

## PDF-Berichte

ResiVote erzeugt PDFs mit dem ResiVote-Farbschema und Logo.

### Verfügbare Berichte

<CardGrid>
  <Card title="Versammlungsprotokoll PDF" icon="document">
    Vollständiges Protokoll mit Traktanden, Abstimmungsergebnissen, Anwesenheit und Stimmrechtsbegrenzung. Prozedurale Traktanden werden ausgefiltert.
  </Card>
  <Card title="Einladung PDF" icon="envelope">
    Einladungsdokument mit Datum, Ort und Tagesordnung.
  </Card>
  <Card title="Vollmachtskarte PDF" icon="id-card">
    Personalisierte Vollmachtskarte pro Eigentümer und Versammlung.
  </Card>
  <Card title="Kostenabrechnung PDF" icon="receipt">
    Kostenabrechnung mit prozentualer Verteilung pro Einheit.
  </Card>
  <Card title="Kostenabrechnung CSV" icon="table">
    Dieselbe Abrechnung als CSV-Export.
  </Card>
  <Card title="Beweispaket PDF" icon="shield">
    Audit-Hash-Kette als PDF.
  </Card>
</CardGrid>

### Textextraktion aus Reglement-PDFs

Für die Textextraktion aus Reglement-PDFs nutzt ResiVote eine Textextraktionskomponente. Scanned-PDFs ohne Textlayer werden erkannt und zurückgewiesen.

## Audit-Log-Anbindung

Jede signifikante Aktion erzeugt einen Audit-Eintrag:

- **Append-only** – Einträge werden nie aktualisiert oder gelöscht.
- **Hash-Kette** – jeder Eintrag verweist auf den vorherigen und berechnet seinen Hash über alle Felder.
- **Impersonation** – protokolliert, wenn ein Super-Admin die Identität eines anderen Benutzers annimmt.
- **Protokoll-Ereignisse** – Traktandum-Statuswechsel, Abstimmungsergebnisse und Protokollfinalisierung werden auditiert.

## Protokoll finalisieren

Nach Abschluss der Versammlung finalisiert der Administrator das Protokoll:

<Steps>
  1. **Protokoll prüfen** – Der Administrator durchgeht alle Traktand-Notizen im Live-Editor.
  2. **PDF generieren** – ResiVote erzeugt das bindende Protokoll-Dokument.
  3. **Beweispaket exportieren** – PDF- oder JSON-Export sichert die Audit-Kette.
  4. **Versammlung archivieren** – Statuswechsel von abgeschlossen zu archiviert.
</Steps>

<Aside type="warning" title="Keine nachträglichen Änderungen">
Nach der Archivierung sind keine Änderungen mehr möglich. Die Audit-Hash-Kette macht jede nachträgliche Manipulation nachweisbar.
</Aside>

## Weiterführende Links

<LinkCard title="Quorum und Präsenz" href="/guides/quorum/" description="Beschlussfähigkeit und Quorum-Berechnung." />
