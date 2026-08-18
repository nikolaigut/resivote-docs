---
title: Check-in und Anwesenheit
description: Check-in-Methoden, QR-Token, Tablet-Signaturen und Anwesenheitsberechnung mit Vollmachten.
---

import { Steps, Aside, CardGrid, Card } from '@astrojs/starlight/components';

Diese Anleitung beschreibt, wie Eigentümer an einer Versammlung anwesend werden und wie ResiVote die Anwesenheit berechnet. Sie richtet sich an Mandanten-Administratoren, den Vorsitz und Eigentümer.

## Check-in-Methoden

Jede Versammlung definiert ihre Check-in-Methode. Ohne Angabe gilt die manuelle Methode.

| Methode | Beschreibung |
| --- | --- |
| Manuell | Der Vorsitz oder Administrator markiert anwesende Eigentümer manuell. |
| QR-Code | Eigentümer checken sich selbst ein, indem sie einen QR-Code mit dem Smartphone scannen. |
| Signatur | Eigentümer wählen sich aus einem Dropdown auf dem Tablet des Administrators und unterschreiben digital. |

## Voraussetzung: Check-in-Phase

Der Check-in setzt voraus, dass sich die Versammlung in der Check-in-Phase befindet. Beim Öffnen der Check-in-Phase prüft das System bei den Methoden QR-Code und Signatur, dass der Check-in ordnungsgemäss konfiguriert ist.

## Manuelles Check-in

Der Vorsitz erfasst die Anwesenheit einer Einheit manuell. Doppelte Check-ins werden mit einem Konflikt-Fehler abgelehnt.

## QR-Code-Self-Check-in

<Steps>

1. **QR-Token generieren.** Der Administrator generiert einen signierten Check-in-Token für die Versammlung. Der Token ist zeitlich begrenzt gültig (Standard: 30 Minuten).

2. **Token validieren.** Vor dem Login kann der Token validiert werden, um die Versammlung aufzulösen. Der Token selbst gewährt keinen Zugang – der Eigentümer muss sich anschliessend authentifizieren.

3. **Self-Check-in durchführen.** Der authentifizierte Eigentümer checkt eine oder mehrere seiner Einheiten ein. Das System verifiziert, dass der Eigentümer die Einheit aktiv besitzt und die Einheit noch nicht eingecheckt ist. Bereits eingecheckte Einheiten werden übersprungen – das Self-Check-in ist idempotent.

</Steps>

<Aside type="note" title="Methode prüfen">
  Self-Check-in ist nur erlaubt, wenn die Check-in-Methode der Versammlung QR-Code ist (oder leer, was aus Gründen der Abwärtskompatibilität Self-Check-in zulässt).
</Aside>

## Tablet-Signatur-Check-in

Der Signatur-Check-in läuft in zwei Schritten auf dem Tablet des Administrators:

### Schritt 1: Vorschau abrufen

Die Vorschau zeigt dem Eigentümer, welche Einheiten durch seine Unterschrift abgedeckt werden:

- **Eigene Einheiten** – alle aktiven Eigentümerschaften im Gemeinschafts-Scope der Versammlung.
- **Vertretene Einheiten** – Einheiten, für die der Eigentümer Bevollmächtigter einer aktiven Vollmacht ist. Pro vertretener Einheit wird der Vollmachtgeber angegeben.
- **Total** – Anzahl abgedeckte Einheiten und deren Wertquoten.

### Schritt 2: Unterschrift erfassen

Die digitale Unterschrift wird gespeichert:

- **Erfasst von** – der Administrator, der das Tablet bedient.
- **Unterschrift** – die Unterschrift als Bilddaten.
- **Eigene Einheiten** werden als anwesend markiert.
- **Vertretene Einheiten** erhalten keine eigene Anwesenheit. Sie werden über die Vollmacht automatisch als vertreten markiert. Alle abgedeckten Einheiten (eigene und vertretene) werden für Audit-Zwecke dokumentiert.

Die Signatur wird separat von der Anwesenheit gespeichert, damit die Bilddaten manipulationssicher und unabhängig prüfbar bleiben.

## Anwesenheits-Entität

Jede Anwesenheit erfasst, wann und wie eine Einheit eingecheckt wurde:

- **Eigentümer** – der Eigentümer.
- **Einheit** – die eingecheckte Einheit.
- **Methode** – die Check-in-Methode: manuell, Self-Check-in (QR), Signatur (Tablet) oder automatisch durch Stimmabgabe.

Eine Einheit gilt als anwesend, sobald ein Anwesenheits-Datensatz existiert.

## Anwesenheitsberechnung

ResiVote aggregiert Anwesenheit, Vollmachten und Eigentumsverhältnisse zu gemeinschaftsbezogenen Snapshots. Pro Gemeinschaft berechnet er:

- Gesamtzahl Eigentümer, Kopf-Stimmen (Anzahl Einheiten) und Wertquoten.
- Anwesende Eigentümer, Kopf-Stimmen und Wertquoten.
- Anwesenheitsprozente für Kopf und Wert.

Jeder Eigentümer erhält einen Status:

- **Anwesend** – Eigentümer ist direkt eingecheckt.
- **Vertreten** – Eigentümer ist über eine aktive Vollmacht vertreten; der Bevollmächtigte wird angegeben. Voraussetzung: der Bevollmächtigte ist irgendwo in der Versammlung anwesend.
- **Abwesend** – weder anwesend noch vertreten.

MEG-Gemeinschaften ohne eigene Einheiten erben die Einheiten verknüpfter STWEGs, sofern konfiguriert und der MEG keine eigenen Einheiten besitzt.

## Automatische Anwesenheit durch Stimmabgabe

Eine Stimmabgabe impliziert Anwesenheit: stimmt ein Eigentümer, ohne vorher eingecheckt zu sein, legt das System automatisch eine Anwesenheit an. Bei Stimmabgabe über eine Vollmacht wird die Anwesenheit auf den Bevollmächtigten gesetzt.

<CardGrid>
  <Card title="Vollmachten verwalten" icon="seti:doc">
    Wie vertretene Einheiten beim Check-in automatisch erfasst werden.
  </Card>
  <Card title="Versammlung erstellen" icon="seti:settings">
    Check-in-Methode bei der Versammlung konfigurieren.
  </Card>
</CardGrid>
