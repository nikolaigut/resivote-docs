---
title: Versammlung erstellen
description: Versammlung anlegen, Traktanden definieren und veröffentlichen – vom Entwurf bis zur Einladung.
---

import { Steps, Aside, CardGrid, Card } from '@astrojs/starlight/components';

Diese Anleitung richtet sich an `tenant_admin` und `meeting_chair`. Sie beschreibt, wie ihr eine Versammlung im Status `DRAFT` anlegt, mit Traktanden bestückt und schliesslich veröffentlicht.

## Lebenszyklus einer Versammlung

Jede Versammlung durchläuft einen festen Status-Workflow. Die Zustandsübergänge validiert die State Machine im Backend.

| Status | Bedeutung |
| --- | --- |
| `DRAFT` | Vorbereitungsphase – Versammlung ist noch nicht sichtbar. |
| `PUBLISHED` | Einladungen wurden verschickt. |
| `CHECK_IN` | Check-in-Phase ist geöffnet. |
| `IN_PROGRESS` | Versammlung läuft, Traktanden werden behandelt. |
| `CLOSED` | Versammlung wurde beendet. |
| `ARCHIVED` | Versammlung ist archiviert. |

Gültige Übergänge: `DRAFT → PUBLISHED`, `PUBLISHED → CHECK_IN`, `CHECK_IN → IN_PROGRESS`, `IN_PROGRESS → CLOSED`, `CLOSED → ARCHIVED`. Aus `ARCHIVED` sind keine weiteren Übergänge möglich.

## Versammlungsmodi

Beim Anlegen wählt ihr den Modus der Versammlung:

- **`LIVE_MEETING`** – Präsenz-, Hybrid- oder Online-Versammlung in Echtzeit. Standardwert.
- **`CIRCULAR_RESOLUTION`** – Zirkularbeschluss (Art. 712m Abs. 2 ZGB). Erfordert zwingend die Felder `circular_voting_start` und `circular_voting_end`. Der Start muss vor dem Ende liegen.

## Versammlung anlegen

<Steps>

1. **Grunddaten erfassen.** Legt Titel, Beschreibung, Datum (`scheduled_at` als RFC3339-Zeitstempel) und Ort fest. Das System prüft, ob am gewählten Zeitpunkt nicht bereits eine andere Versammlung desselben Mandanten geplant ist. Ein eindeutiger Slug wird automatisch generiert.

2. **Modus und Check-in-Methode wählen.** Setzt `meeting_mode` auf `LIVE_MEETING` oder `CIRCULAR_RESOLUTION`. Wählt die Check-in-Methode (`checkin_method`):
   - `MANUAL` – der Vorsitz markiert anwesende Eigentümer manuell (Standard).
   - `QR_CODE` – Eigentümer checken sich selbst per QR-Code ein.
   - `SIGNATURE` – Eigentümer unterschreiben auf dem Tablet des Administrators.

3. **Sichtbarkeit der Live-Ergebnisse festlegen.** Mit `live_results_visible_to` bestimmt ihr, wer Live-Ergebnisse während einer offenen Abstimmung sieht:
   - `ALL` – alle Teilnehmer sehen die Zwischenergebnisse (Standard).
   - `CHAIR` – nur `tenant_admin` und `meeting_chair` sehen Live-Ergebnisse.

4. **Stimmabgabe-Bestätigung aktivieren (optional).** Setzt `require_vote_confirmation` auf `true`, wenn Eigentümer ihre Stimmabgabe explizit bestätigen müssen.

5. **Communities verknüpfen.** Verknüpft eine oder mehrere Communities mit der Versammlung. Die Verknüpfung erfolgt über die Join-Tabelle `meeting_communities` und erlaubt Mehr-Community-Versammlungen.

</Steps>

## Traktanden anlegen

Jeder Traktandum (`AgendaItem`) gehört zu einer Versammlung und besitzt folgende Eigenschaften:

- **`order_number`** – Reihenfolge innerhalb der Versammlung.
- **`title`** und **`description`** – Bezeichnung und Erläuterung.
- **`type`** – Traktandentyp:
  - `MOTION` – Ja/Nein/Enthaltung-Abstimmung.
  - `ELECTION` – Wahlen; erfordert das Feld `candidates` (Liste von Kandidatennamen).
  - `FREE_TEXT` – Freitext-Abstimmung.
  - `PROTOCOL` – Protokollführung festlegen, ohne Abstimmung.
- **`quorum_type`** – Quorenmodell für diesen Traktandum: `SIMPLE_MAJORITY`, `QUALIFIED_MAJORITY`, `UNANIMOUS`, `ABSOLUTE_MAJORITY` oder `CUSTOM`. Bei `CUSTOM` definiert ihr `custom_quorum_pct` und optional `custom_quorum_value_pct`; `custom_quorum_base` bestimmt die Basis (`PRESENT` oder `ELIGIBLE`).
- **`community_id`** – Community-Bezug. Ein leerer Wert (`nil`) bedeutet, dass der Traktandum für alle Communities der Versammlung gilt. Die Methode `AppliesToCommunity` prüft dies: ist `CommunityID` nicht gesetzt, gilt der Traktandum für alle.

Bei `LIVE_MEETING` erstellt das System automatisch den prozeduralen Traktandum «Protokollführung festlegen» (Typ `PROTOCOL`, `order_number` 0). Sobald ihr den Protokollschreiber festlegt, schliesst das System diesen Traktandum automatisch.

## Protokollschreiber konfigurieren

Der Protokollschreiber wird über `protocol_writer_type` und `protocol_writer_owner_id` festgelegt:

- **`OWNER`** – ein Eigentümer führt das Protokoll; `protocol_writer_owner_id` referenziert den Eigentümer.
- **`TENANT_ADMIN`** – ein Administrator führt das Protokoll.

Die Konfiguration ist nur für `LIVE_MEETING` erlaubt und nicht mehr änderbar, sobald die Versammlung `CLOSED` oder `ARCHIVED` ist.

## Anhänge hochladen

Anhänge lassen sich auf zwei Ebenen verwalten:

- **Versammlungs-Anhänge** – allgemeine Dokumente für die gesamte Versammlung.
- **Traktanden-Anhänge** – Dokumente, die zu einem spezifischen Traktandum gehören.

Zusätzlich unterstützt ResiVote Online-Slides für Präsentationen innerhalb eines Traktandums.

## Versammlung veröffentlichen

Die Veröffentlichung vollzieht den Zustandsübergang `DRAFT → PUBLISHED`. Dabei passiert Folgendes:

1. Die State Machine validiert und setzt den Status auf `PUBLISHED`.
2. Das System plant die E-Mail-Sequenz: eine sofortige Einladung und eine Erinnerung sieben Tage vor dem Versammlungstermin.
3. Die Einladungen werden möglichst sofort versendet; schlägt der Versand fehl, bleibt die Versammlung dennoch veröffentlicht.

<Aside type="note" title="Aktualisierungen">
  Versammlungen lassen sich nur im Status `DRAFT` oder `PUBLISHED` bearbeiten. Sobald die Versammlung `CHECK_IN` oder einen späteren Status erreicht, sind Änderungen an den Grunddaten gesperrt.
</Aside>

<CardGrid>
  <Card title="Abstimmungen durchführen" icon="seti:vote">
    Wie Traktanden abgestimmt werden und welche Stimmmodelle gelten.
  </Card>
  <Card title="Check-in und Anwesenheit" icon="seti:check">
    Wie Eigentümer an der Versammlung anwesend werden.
  </Card>
</CardGrid>
