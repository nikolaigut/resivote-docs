---
title: Abstimmungen durchführen
description: Traktanden öffnen, digital und analog abstimmen sowie Quoren und Live-Ergebnisse verwalten.
---

import { Steps, Aside, CardGrid, Card, LinkCard } from '@astrojs/starlight/components';

Diese Anleitung beschreibt den Abstimmungsprozess – vom Öffnen eines Traktandums bis zum Ergebnis. Sie richtet sich an `tenant_admin` und `meeting_chair`.

## Traktanden-Status

Jeder Traktandum durchläuft einen eigenen Status-Workflow, der von der State Machine validiert wird:

| Status | Bedeutung |
| --- | --- |
| `PENDING` | Noch nicht behandelt. |
| `PRESENTING` | Präsentations- und Diskussionsphase; keine Abstimmung. |
| `PRE_VOTING` | Asynchrone Vorabstimmung läuft. |
| `OPEN` | Abstimmung ist geöffnet. |
| `CLOSED` | Abstimmung abgeschlossen. |
| `SKIPPED` | Traktandum wurde übersprungen. |

Gültige Übergänge: `PENDING → PRESENTING / PRE_VOTING / OPEN / SKIPPED`, `PRESENTING → OPEN / CLOSED / PENDING / SKIPPED`, `PRE_VOTING → PRESENTING / OPEN / PENDING / CLOSED`, `OPEN → CLOSED / PRESENTING / PENDING`. Geschlossene Traktanden lassen sich wieder öffnen oder erneut präsentieren.

## Stimmarten

Die Stimmart ergibt sich aus dem Traktanden-Typ (`type`):

- **`MOTION`** – Wahl zwischen `YES`, `NO` und `ABSTAIN`.
- **`ELECTION`** – Kandidatenwahl; `choice` ist `CANDIDATE`, der Kandidatenname wird in `candidate_name` gespeichert.
- **`FREE_TEXT`** – Freitext; `choice` ist `FREE_TEXT`, der Text in `free_text_value`.

## Stimmrechtsmodelle

Jede Community definiert ihr Stimmrechtsmodell (`voting_rights_model`):

- **`HEAD_AND_VALUE`** – Kopfstimmen und Wertquoten (STWEG-Standard).
- **`HEAD_ONLY`** – nur Kopfstimmen (1 Einheit = 1 Stimme).
- **`VALUE_ONLY`** – nur Wertquoten.
- **`CUSTOM_SHARES`** – benutzerdefinierte Anteile pro Einheit (MEG-spezifisch).

### Kopfstimme und Wertquote

Pro Stimme gilt: **1 Einheit = 1 Kopfstimme** (Art. 712o ZGB). Das Feld `head_vote_value` ist stets `1`. Die Wertquote (`value_quota`) und allfällige `custom_shares` werden zum Zeitpunkt der Stimmabgabe als Snapshot im Stimmdatensatz festgehalten. So bleibt die Stimme auch nachträglich nachvollziehbar, selbst wenn sich die Eigentumsverhältnisse später ändern.

## Vorabstimmung (Pre-Voting)

Für asynchrone Abstimmungen lässt sich ein Traktandum in den Status `PRE_VOTING` überführen. Eigentümer können vorab stimmen, ohne anwesend zu sein. Diese Stimmen werden mit `is_pre_vote = true` markiert. Beim Abstimmungsabschluss fliessen sie in das Ergebnis ein. Die Vorabstimmung kann jederzeit auf `PENDING` zurückgesetzt werden; bereits abgegebene Stimmen bleiben erhalten, werden aber erst gezählt, wenn der Traktandum geöffnet oder die Vorabstimmung erneut gestartet wird.

## Digitale Stimmabgabe

<Steps>

1. **Traktandum öffnen.** Der Vorsitz öffnet den Traktandum. Das System prüft die Beschlussfähigkeit (Quorum) anhand der aktuellen Anwesenheit. Ist das Quorum nicht erreicht, blockiert das System das Öffnen – ausser der Vorsitz hat einen Quoren-Override gesetzt.

2. **Stimme abgeben.** Der Eigentümer wählt seine Einheit und seine Stimmoption. Das System legt automatisch eine Anwesenheit an (`Method = VOTE`), falls die Einheit noch nicht eingecheckt war – eine Stimmabgabe impliziert Anwesenheit.

3. **Stimme ändern.** Stimmen sind unveränderlich (Audit-sicher). Wird eine Stimme geändert, markiert das System die alte Stimme mit `is_superseded = true` und erstellt einen neuen Stimmdatensatz. So bleibt jeder Stimmwechsel lückenlos nachvollziehbar.

4. **Traktandum schliessen.** Der Vorsitz schliesst den Traktandum. Das System berechnet das Quorum, speichert das Ergebnis (`result_passed`, `result_details`) und stoppt einen allfälligen Präsentations-Timer.

</Steps>

## Analoge Stimmabgabe

Eigentümer, die nicht digital abstimmen können, werden analog erfasst. Der Vorsitz gibt die Stimme stellvertretend ein.

- **Einzelne analoge Stimme** – `CastAnalogVote` erfasst eine Stimme für eine anwesende Einheit. Ist die Einheit nicht eingecheckt, aber über eine aktive Vollmacht vertreten, stimmt der Bevollmächtigte – sofern er selbst anwesend ist.
- **Sammelabstimmung** – `CastBulkAnalogVotesRequest` erfasst mehrere Handzeichen-Stimmen in einem Schritt. Alle Eingaben werden validiert und in einer einzigen Datenbank-Transaktion gespeichert. Schlägt eine Stimme fehl, wird keine Stimme persistiert.

Analoge Stimmabgabe ist nur im Status `OPEN` erlaubt. Pro Einheit ist nur eine aktive Stimme möglich; eine bereits abgegebene Stimme wird bei der analogen Erfassung nicht überschrieben.

## Live-Ergebnisse

Die Sichtbarkeit der Live-Ergebnisse steuert `live_results_visible_to` auf Versammlungsebene:

- **`ALL`** – alle Teilnehmer sehen die Zwischenergebnisse, während die Abstimmung offen ist.
- **`CHAIR`** – nur `tenant_admin` und `meeting_chair` sehen Live-Ergebnisse bei offenen Traktanden.

Geschlossene Ergebnisse sind für alle Teilnehmer sichtbar. Nicht-privilegierte Eigentümer sehen aggregierte Quoren-Zahlen, aber nicht die Identität von Nein-Stimmenden oder Enthaltungen.

## Stimmabgabe-Bestätigung

Ist `require_vote_confirmation` aktiv, müssen Eigentümer ihre Stimmabgabe explizit bestätigen, bevor sie final erfasst wird.

## Quoren-Override

Der Vorsitz kann eine Quoren-Sperre für einen Traktandum aufheben. Setzt er `quorum_override` auf `true`, werden Stimmen akzeptiert, auch wenn die Beschlussfähigkeit beim Öffnen nicht gegeben war. Das Feld `quorum_override_reason` ist dabei zwingend erforderlich. Jede Änderung des Overrides wird im Audit-Log protokolliert (`QUORUM_OVERRIDE_GRANTED` bzw. `QUORUM_OVERRIDE_REVOKED`).

## Präsentations-Timer

Jeder Traktandum besitzt einen Countdown-Timer für die Präsentationsphase. Die Felder `timer_started_at` und `timer_duration_seconds` speichern den Startzeitpunkt und die Dauer. So können Clients nach einem WebSocket-Reconnect oder Seitenreload den Timer synchronisieren. Beim Schliessen des Traktandums wird der Timer automatisch gestoppt und zurückgesetzt.

<Aside type="note" title="Vollmachten">
  Bevollmächtigte können für vertretene Einheiten abstimmen. Details dazu findet ihr in der Anleitung <a href="/guides/vollmachten/">Vollmachten verwalten</a>.
</Aside>

<LinkCard title="Quoren-Referenz" href="/reference/quorum/" description="Technische Details zu Quoren-Typen und Berechnung." />
