---
title: Vollmachten verwalten
description: Vollmachten erteilen, einschränken und widerrufen – von der generellen bis zur mandatierten Stimmabgabe.
---

import { Aside, Steps, CardGrid, Card } from '@astrojs/starlight/components';

Diese Anleitung beschreibt, wie Vollmachten (Vollmachten / Proxies) in ResiVote funktionieren. Sie richtet sich an `tenant_admin`, `meeting_chair` und Eigentümer.

## Vollmacht-Entität

Eine Vollmacht (`Proxy`) überträgt das Stimmrecht für eine konkrete Einheit und Versammlung von einem Eigentümer an einen anderen. Sie besteht aus folgenden Feldern:

- **`grantor_id`** – der Vollmachtgeber (Eigentümer, der die Vollmacht erteilt).
- **`grantee_id`** – der Bevollmächtigte (Eigentümer, der die Vollmacht erhält).
- **`unit_id`** – die Einheit, für die die Vollmacht gilt. Vollmachten sind pro Einheit und Versammlung eindeutig.
- **`meeting_id`** – die Versammlung, auf die sich die Vollmacht bezieht.

Ein Eigentümer kann nicht sich selbst bevollmächtigen. Pro Einheit und Versammlung ist nur eine aktive Vollmacht zulässig.

## Vollmacht-Umfang (Scope)

Der Umfang einer Vollmacht wird über `scope` festgelegt:

- **`FULL`** – die Vollmacht gilt für die gesamte Versammlung. Der Bevollmächtigte darf für alle Traktanden abstimmen.
- **`RESTRICTED`** – die Vollmacht ist auf bestimmte Traktanden beschränkt. Die Methode `CoversAgendaItem` prüft, ob ein Traktandum abgedeckt ist: bei `FULL` immer, bei `RESTRICTED` nur, wenn eine Instruktion für den Traktandum existiert.

## Mandatierte Stimmabgabe (Instructions)

Bei eingeschränkten Vollmachten definiert jede `ProxyInstruction` eine zwingende Stimmabgabe für einen bestimmten Traktandum:

- **`agenda_item_id`** – der Traktandum, auf den die Instruktion zutrifft.
- **`mandated_vote`** – die vorgeschriebene Stimmoption (`YES`, `NO`, `ABSTAIN`, `CANDIDATE` oder `FREE_TEXT`).

<Aside type="warning" title="Bindende Instruktion">
  Eine mandatierte Stimmabgabe ist bindend. Der Bevollmächtigte muss zwingend gemäss der Instruktion abstimmen. Das System erzwingt dies bei der Stimmabgabe.
</Aside>

## Vollmacht erteilen

<Steps>

1. **Versammlung im richtigen Status.** Vollmachten lassen sich nur erstellen, solange die Versammlung den Status `PUBLISHED`, `CHECK_IN`, `IN_PROGRESS` oder `OPEN` hat. In `DRAFT`, `CLOSED` oder `ARCHIVED` ist die Erstellung gesperrt.

2. **Eigentümer und Einheit prüfen.** Das System verifiziert, dass der Vollmachtgeber die Einheit aktiv besitzt und die Einheit zum Community-Scope der Versammlung gehört. Der Bevollmächtigte muss ein berechtigter Eigentümer in den Communities der Versammlung sein. Bei MEG-Einheiten dürfen auch MEG-Delegierte ohne direkte Eigentümerschaft in der MEG-Community bevollmächtigt werden.

3. **Umfang und Instruktionen festlegen.** Wählt `FULL` oder `RESTRICTED`. Bei `RESTRICTED` fügt ihr pro Traktandum eine Instruktion mit der mandatierten Stimmoption hinzu.

4. **Vollmacht speichern.** Das System legt die Vollmacht an und aktualisiert sofort die Anwesenheit und das Live-Quorum, da sich die Vertretung ändert.

</Steps>

## Vollmacht widerrufen

Eine Vollmacht wird über `Revoke` widerrufen. Das System setzt `revoked_at` auf den aktuellen Zeitpunkt; die Methode `IsActive` gibt danach `false` zurück. Ein Widerruf aktualisiert ebenfalls sofort die Anwesenheit und das Live-Quorum.

## Vertretung bei der Stimmabgabe

Bei der Abstimmung berücksichtigt das System aktive Vollmachten automatisch:

- Der Bevollmächtigte muss selbst an der Versammlung anwesend sein (eingecheckt unter einer beliebigen Einheit), damit die Vertretung zählt.
- Stimmt der Bevollmächtigte für eine vertretene Einheit, wird `voter_id` auf den Bevollmächtigten gesetzt und `proxy_id` verweist auf die Vollmacht.
- Bei direkter Anwesenheit des Eigentümers (physische Präsenz) übersteuert diese die Vollmacht – der Eigentümer stimmt selbst.
- Bei der analogen Stimmabgabe gelten dieselben Regeln: ist die Einheit nicht eingecheckt, aber über eine aktive Vollmacht vertreten und der Bevollmächtigte anwesend, stimmt der Bevollmächtigte.

## Vertretung beim Check-in

Vollmachten wirken sich automatisch auf die Anwesenheit aus. Der Presence Builder markiert vertretene Einheiten als `REPRESENTED`, sofern der Bevollmächtigte irgendwo in der Versammlung anwesend ist. Die vertretene Einheit fliesst in Kopf- und Wertquoten-Berechnungen ein. Details dazu in der Anleitung <a href="/guides/checkin/">Check-in und Anwesenheit</a>.

<CardGrid>
  <Card title="Check-in und Anwesenheit" icon="seti:check">
    Wie vertretene Einheiten beim Check-in erfasst werden.
  </Card>
  <Card title="Abstimmungen durchführen" icon="seti:vote">
    Wie Bevollmächtigte für vertretene Einheiten abstimmen.
  </Card>
</CardGrid>
