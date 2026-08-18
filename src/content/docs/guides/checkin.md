---
title: Check-in und Anwesenheit
description: Check-in-Methoden, QR-Token, Tablet-Signaturen und Anwesenheitsberechnung mit Vollmachten.
---

import { Steps, Aside, CardGrid, Card } from '@astrojs/starlight/components';

Diese Anleitung beschreibt, wie Eigentümer an einer Versammlung anwesend werden und wie ResiVote die Anwesenheit berechnet. Sie richtet sich an `tenant_admin`, `meeting_chair` und Eigentümer.

## Check-in-Methoden

Jede Versammlung definiert ihre Check-in-Methode (`checkin_method`). Ein leerer Wert bedeutet `MANUAL`.

| Methode | Beschreibung |
| --- | --- |
| `MANUAL` | Der Vorsitz oder Administrator markiert anwesende Eigentümer manuell. |
| `QR_CODE` | Eigentümer checken sich selbst ein, indem sie einen QR-Code mit dem Smartphone scannen. |
| `SIGNATURE` | Eigentümer wählen sich aus einem Dropdown auf dem Tablet des Administrators und unterschreiben digital. |

## Voraussetzung: Status CHECK_IN

Der Check-in setzt voraus, dass sich die Versammlung im Status `CHECK_IN` befindet. Beim Öffnen der Versammlung (`PUBLISHED → CHECK_IN`) prüft das System bei den Methoden `QR_CODE` und `SIGNATURE`, dass der Check-in ordnungsgemäss konfiguriert ist.

## Manuelles Check-in

Der Vorsitz erfasst die Anwesenheit einer Einheit manuell. Das System legt einen `Attendance`-Datensatz mit `method = CHECKIN` an und lehnt doppelte Check-ins mit einem Konflikt-Fehler ab.

## QR-Code-Self-Check-in

<Steps>

1. **QR-Token generieren.** Der Administrator generiert einen signierten Check-in-Token für die Versammlung. Der Token ist ein HMAC-signiertes JWT (HS256) und enthält die `meeting_id`, die Check-in-Methode und den Tenant-Slug. Die Gültigkeitsdauer steuert die Umgebungsvariable `CHECKIN_TOKEN_EXPIRY` (Standard: 30 Minuten).

2. **Token validieren.** Vor dem Login kann das Frontend den Token validieren, um die Versammlung aufzulösen. Der Token selbst gewährt keinen Zugang – der Eigentümer muss sich anschliessend authentifizieren.

3. **Self-Check-in durchführen.** Der authentifizierte Eigentümer checkt eine oder mehrere seiner Einheiten ein. Das System verifiziert, dass der Eigentümer die Einheit aktiv besitzt (`ValidUntil` ist nicht gesetzt) und die Einheit noch nicht eingecheckt ist. Bereits eingecheckte Einheiten werden übersprungen – das Self-Check-in ist idempotent.

</Steps>

<Aside type="note" title="Methode prüfen">
  Self-Check-in ist nur erlaubt, wenn die Check-in-Methode der Versammlung `QR_CODE` ist (oder leer, was aus Gründen der Abwärtskompatibilität Self-Check-in zulässt).
</Aside>

## Tablet-Signatur-Check-in

Der Signatur-Check-in läuft in zwei Schritten auf dem Tablet des Administrators:

### Schritt 1: Vorschau abrufen

Die `CheckinPreview` zeigt dem Eigentümer, welche Einheiten durch seine Unterschrift abgedeckt werden:

- **Eigene Einheiten** (`own_units`) – alle aktiven Eigentümerschaften im Community-Scope der Versammlung.
- **Vertretene Einheiten** (`proxy_units`) – Einheiten, für die der Eigentümer Bevollmächtigter einer aktiven Vollmacht ist. Pro vertretener Einheit wird der Vollmachtgeber (`proxy_grantor_id`) angegeben.
- **Total** – `total_units` und `total_value_quota` summieren die abgedeckten Einheiten und deren Wertquoten.

### Schritt 2: Unterschrift erfassen

Die `SignatureCheckIn`-Methode speichert die digitale Unterschrift:

- **`captured_by_id`** – der Administrator, der das Tablet bedient.
- **`image_data`** – die Unterschrift als JPEG- oder PNG-Bilddaten.
- **Eigene Einheiten** erhalten einen `Attendance`-Datensatz mit `method = SIGNATURE`.
- **Vertretene Einheiten** erhalten keine eigene Anwesenheit. Sie werden über die Vollmacht im Presence Builder automatisch als vertreten markiert. Die `SignatureUnit`-Join-Tabelle dokumentiert alle abgedeckten Einheiten (eigene und vertretene) für Audit-Zwecke.

Die Signatur wird in einer separaten Tabelle (`signatures`) gespeichert – getrennt von der Anwesenheit –, damit die Bilddaten manipulationssicher und unabhängig prüfbar bleiben.

## Anwesenheits-Entität

Jede Anwesenheit (`Attendance`) erfasst, wann und wie eine Einheit eingecheckt wurde:

- **`owner_id`** – der Eigentümer.
- **`unit_id`** – die eingecheckte Einheit.
- **`method`** – die Check-in-Methode: `CHECKIN` (manuell), `SELF_CHECKIN` (QR), `SIGNATURE` (Tablet) oder `VOTE` (automatisch durch Stimmabgabe).

Eine Einheit gilt als anwesend, sobald ein `Attendance`-Datensatz existiert.

## Anwesenheitsberechnung (Presence Builder)

Der Presence Builder aggregiert Anwesenheit, Vollmachten und Eigentumsverhältnisse zu Community-bezogenen Snapshots (`CommunityPresence`). Pro Community berechnet er:

- **`total_owners`**, **`total_head_votes`** (Anzahl Einheiten) und **`total_value_quota`**.
- **`present_owners`**, **`present_head_votes`** und **`present_value_quota`**.
- **`presence_head_pct`** und **`presence_value_pct`** – Anwesenheitsprozente.

Jeder Eigentümer erhält einen Status (`PresenceRecord`):

- **`PRESENT`** – Eigentümer ist direkt eingecheckt.
- **`REPRESENTED`** – Eigentümer ist über eine aktive Vollmacht vertreten; `represented_by` verweist auf den Bevollmächtigten. Voraussetzung: der Bevollmächtigte ist irgendwo in der Versammlung anwesend.
- **`ABSENT`** – weder anwesend noch vertreten.

MEG-Communities ohne eigene Einheiten erben die Einheiten verknüpfter STWEGs, sofern `InheritsOwners` aktiv ist und der MEG keine eigenen Einheiten besitzt.

## Automatische Anwesenheit durch Stimmabgabe

Eine Stimmabgabe impliziert Anwesenheit: stimmt ein Eigentümer, ohne vorher eingecheckt zu sein, legt das System automatisch einen `Attendance`-Datensatz mit `method = VOTE` an. Bei Stimmabgabe über eine Vollmacht wird die Anwesenheit auf den Bevollmächtigten gesetzt.

<CardGrid>
  <Card title="Vollmachten verwalten" icon="seti:doc">
    Wie vertretene Einheiten beim Check-in automatisch erfasst werden.
  </Card>
  <Card title="Versammlung erstellen" icon="seti:settings">
    Check-in-Methode bei der Versammlung konfigurieren.
  </Card>
</CardGrid>
