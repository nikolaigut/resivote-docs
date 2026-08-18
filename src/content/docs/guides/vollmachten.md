---
title: Vollmachten verwalten
description: Vollmachten erteilen, einschränken und widerrufen – von der generellen bis zur mandatierten Stimmabgabe.
---

import { Aside, Steps, CardGrid, Card } from '@astrojs/starlight/components';

Diese Anleitung beschreibt, wie Vollmachten in ResiVote funktionieren. Sie richtet sich an Mandanten-Administratoren, den Vorsitz und Eigentümer.

## Vollmacht

Eine Vollmacht überträgt das Stimmrecht für eine konkrete Einheit und Versammlung von einem Eigentümer an einen anderen. Sie besteht aus folgenden Angaben:

- **Vollmachtgeber** – der Eigentümer, der die Vollmacht erteilt.
- **Bevollmächtigter** – der Eigentümer, der die Vollmacht erhält.
- **Einheit** – die Einheit, für die die Vollmacht gilt. Vollmachten sind pro Einheit und Versammlung eindeutig.
- **Versammlung** – die Versammlung, auf die sich die Vollmacht bezieht.

Ein Eigentümer kann nicht sich selbst bevollmächtigen. Pro Einheit und Versammlung ist nur eine aktive Vollmacht zulässig.

## Vollmacht-Umfang

Der Umfang einer Vollmacht wird festgelegt als:

- **Voll** – die Vollmacht gilt für die gesamte Versammlung. Der Bevollmächtigte darf für alle Traktanden abstimmen.
- **Eingeschränkt** – die Vollmacht ist auf bestimmte Traktanden beschränkt. Das System prüft pro Traktandum, ob er abgedeckt ist.

## Mandatierte Stimmabgabe

Bei eingeschränkten Vollmachten definiert jede Instruktion eine zwingende Stimmabgabe für einen bestimmten Traktandum:

- **Traktandum** – der Traktandum, auf den die Instruktion zutrifft.
- **Vorgeschriebene Stimme** – die vorgeschriebene Stimmoption (Ja, Nein, Enthaltung, Kandidat oder Freitext).

<Aside type="warning" title="Bindende Instruktion">
  Eine mandatierte Stimmabgabe ist bindend. Der Bevollmächtigte muss zwingend gemäss der Instruktion abstimmen. Das System erzwingt dies bei der Stimmabgabe.
</Aside>

## Vollmacht erteilen

<Steps>

1. **Versammlung im richtigen Status.** Vollmachten lassen sich nur erstellen, solange die Versammlung veröffentlicht ist, der Check-in läuft, die Versammlung läuft oder die Abstimmung offen ist. Im Entwurf, nach Abschluss oder nach Archivierung ist die Erstellung gesperrt.

2. **Eigentümer und Einheit prüfen.** Das System verifiziert, dass der Vollmachtgeber die Einheit aktiv besitzt und die Einheit zum Gemeinschafts-Scope der Versammlung gehört. Der Bevollmächtigte muss ein berechtigter Eigentümer in den Gemeinschaften der Versammlung sein. Bei MEG-Einheiten dürfen auch MEG-Delegierte ohne direkte Eigentümerschaft in der MEG-Gemeinschaft bevollmächtigt werden.

3. **Umfang und Instruktionen festlegen.** Wählt voll oder eingeschränkt. Bei eingeschränkt fügt ihr pro Traktandum eine Instruktion mit der mandatierten Stimmoption hinzu.

4. **Vollmacht speichern.** Das System legt die Vollmacht an und aktualisiert sofort die Anwesenheit und das Live-Quorum, da sich die Vertretung ändert.

</Steps>

## Vollmacht widerrufen

Eine Vollmacht kann widerrufen werden. Das System markiert die Vollmacht als widerrufen. Ein Widerruf aktualisiert ebenfalls sofort die Anwesenheit und das Live-Quorum.

## Vertretung bei der Stimmabgabe

Bei der Abstimmung berücksichtigt das System aktive Vollmachten automatisch:

- Der Bevollmächtigte muss selbst an der Versammlung anwesend sein (eingecheckt unter einer beliebigen Einheit), damit die Vertretung zählt.
- Stimmt der Bevollmächtigte für eine vertretene Einheit, wird die Stimme dem Bevollmächtigten zugeordnet und auf die Vollmacht verwiesen.
- Bei direkter Anwesenheit des Eigentümers (physische Präsenz) übersteuert diese die Vollmacht – der Eigentümer stimmt selbst.
- Bei der analogen Stimmabgabe gelten dieselben Regeln: ist die Einheit nicht eingecheckt, aber über eine aktive Vollmacht vertreten und der Bevollmächtigte anwesend, stimmt der Bevollmächtigte.

## Vertretung beim Check-in

Vollmachten wirken sich automatisch auf die Anwesenheit aus. Vertretene Einheiten werden als vertreten markiert, sofern der Bevollmächtigte irgendwo in der Versammlung anwesend ist. Die vertretene Einheit fliessen in Kopf- und Wertquoten-Berechnungen ein. Details dazu in der Anleitung <a href="/guides/checkin/">Check-in und Anwesenheit</a>.

<CardGrid>
  <Card title="Check-in und Anwesenheit" icon="seti:check">
    Wie vertretene Einheiten beim Check-in erfasst werden.
  </Card>
  <Card title="Abstimmungen durchführen" icon="seti:vote">
    Wie Bevollmächtigte für vertretene Einheiten abstimmen.
  </Card>
</CardGrid>
