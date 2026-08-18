---
title: Quorum und Präsenz
description: Quorum-Typen, Beschlussfähigkeit, Präsenz-Berechnung und Community-Modelle in ResiVote.
---

import { Steps, Aside, CardGrid, Card, LinkCard } from '@astrojs/starlight/components';

ResiVote berechnet Quoren nach schweizerischem Immobilienrecht (ZGB). Die Beschlussfähigkeit wird live während der Versammlung verfolgt und beim Öffnen eines Traktandums als Snapshot eingefroren.

## Quorum-Typen

Jedes Traktandum definiert seinen Quorum-Typ:

| Typ | Bedeutung | Rechtsgrundlage |
|-----|-----------|-----------------|
| Einfache Mehrheit | Ja > 50% der anwesenden Kopf-Stimmen. Enthaltungen und nicht abgegebene Stimmen zählen als implizites Nein. | — |
| Qualifizierte Mehrheit | Ja > 50% der anwesenden Eigentümer (Köpfe) **und** > 50% **aller** berechtigten Wertquoten. | Art. 647b/d/e, 712g Abs. 3 ZGB |
| Einstimmigkeit | 100% **aller** registrierten Eigentümer (Köpfe) und Wertquoten müssen Ja stimmen. Absenzen ohne positive Vollmacht zählen als Nein. | Art. 647e ZGB |
| Absolute Mehrheit | Ja > 50% **aller** registrierten Eigentümer (unabhängig von Anwesenheit). | — |
| Benutzerdefiniert | Ja >= konfigurierbarer Prozentsatz der konfigurierten Basis. | Reglement |

### Benutzerdefiniertes Quorum

Für das benutzerdefinierte Quorum hält das Traktandum drei Angaben:

- **Prozentsatz** – Schwellwert in % (z. B. 66.67)
- **Wertquoten-Prozentsatz** – optionaler separater Schwellwert für Wertquoten
- **Basis** – anwesend oder alle berechtigten Eigentümer

### Quorum-Override

Der Vorsitzende kann einen Quorum-Block aufheben. Das Traktandum hält dazu:

- **Override** – wenn aktiv, werden Stimmen akzeptiert, auch wenn die Beschlussfähigkeit beim Öffnen nicht gegeben war.
- **Grund** – zwingender Grundtext bei aktivem Override.

Wenn kein Snapshot vorliegt, wird der Check übersprungen. Wenn die Beschlussfähigkeit nicht gegeben ist und kein Override gesetzt wurde, wird die Stimme abgelehnt.

## Quorum-Engine

Die Quorum-Engine ist die Kernkomponente für die Abstimmungsauswertung. Sie berechnet pro Gemeinschaft ein Ergebnis und aggregiert sie zu einem Gesamt-Ergebnis.

### Eingaben

- Traktandum mit Quorum-Typ und Schwellwerten
- Gemeinschaften der Versammlung
- Einheiten und Eigentumsanteile
- Anwesenheiten
- Vollmachten
- Abgegebene Stimmen

### Ausgaben pro Gemeinschaft

| Feld | Bedeutung |
|------|-----------|
| Ja/Nein/Enthaltung Kopf-Stimmen | Kopf-Stimmen |
| Ja/Nein/Enthaltung Wertquoten | Wertquoten |
| Schwellwerte Kopf/Wert | Erforderliche Ja-Stimmen |
| Kopf/Wert erreicht | Ob Schwellwert erreicht |
| Gesamtergebnis | Ob der Beschluss angenommen wurde (nil bei informativen Traktanden) |
| Stimmrechtsbegrenzung | Ob und bei wem die Stimmrechtsbegrenzung angewendet wurde |
| Nein/Enthaltung-Stimmende | Nachnamen der Nein/Enthaltung-Stimmenden (für Protokoll) |
| Wahlergebnis | Ergebnis bei Wahlen |
| Informativ | Kein Ja/Nein-Ergebnis (z. B. Freitext) |
| Geerbt | MEG-Ergebnis von verknüpften STWEGs geerbt |

### Defensive Normalisierung

Die Quorum-Engine normalisiert Eingaben defensiv: leere Gemeinschaften liefern ein informatives Ergebnis, fehlende Stimmen zählen als implizites Nein, und Rundungsfehler werden absorbiert.

### Gesamt-Ergebnis

Der Beschluss ist angenommen, wenn **alle** Gemeinschaften das Quorum erreichen. Geerbte MEG-Ergebnisse werden nicht doppelt gezählt.

## Live-Quorum-Service

Der Live-Quorum-Service beantwortet die Frage «ist die Versammlung beschlussfähig?» in Echtzeit, basierend auf aktueller Präsenz – unabhängig von abgegebenen Stimmen.

### Beschlussfähigkeit

Die Versammlung ist beschlussfähig, wenn **mehr als die Hälfte** der Kopf-Stimmen **und** mehr als die Hälfte der Wertquoten anwesend/vertreten sind, plus die Mindestanzahl Eigentümer. «Mehr als die Hälfte» ist eine **strikte** Ungleichung: bei gerader Gesamtzahl N ist der Schwellwert `N/2 + 1` (z. B. 4 Eigentümer → 3 nötig). Exakt 50% reicht nicht.

### Stimmrechtsmodelle

Welche Bedingungen gelten, hängt vom Stimmrechtsmodell der Gemeinschaft:

| Modell | Kopf-Bedingung | Wertquoten-Bedingung |
|--------|---------------|---------------------|
| Kopf und Wert / Benutzerdefinierte Anteile | ja | ja |
| Nur Kopf | ja | übersprungen |
| Nur Wert | übersprungen | ja |

### Ausgabe

Pro Gemeinschaft:

- Kopf-Quorum erreicht, Wert-Quorum erreicht, Mindestanzahl Eigentümer erreicht, Gesamt-Quorum erreicht
- Erforderliche Kopf-Stimmen, erforderliche Wertquoten
- Fehlende Kopf-Stimmen, fehlende Wertquoten, fehlende Eigentümer

Die Versammlung ist beschlussfähig, wenn alle Gemeinschaften das Quorum erreichen.

## Präsenz-Berechnung

ResiVote sammelt Anwesenheiten, Vollmachten und Eigentumsanteile und aggregiert sie zu gemeinschaftsbezogenen Snapshots. Live-Quorum und API verwenden dieselbe Präsenz-Quelle.

### Ablauf

<Steps>
  1. **Gemeinschaften laden** – alle Gemeinschaften der Versammlung.
  2. **Anwesenheiten laden** – alle Anwesenheits-Datensätze der Versammlung.
  3. **Vollmachten laden** – alle Vollmachten der Versammlung.
  4. **Zuordnungen bauen** – Einheit → Anwesenheit und Einheit → aktive Vollmacht.
  5. **Pro Gemeinschaft aggregieren** – für jede Gemeinschaft: Einheiten laden, Eigentumsanteile summieren, anwesende/vertretene Kopf-Stimmen und Wertquoten berechnen.
</Steps>

### Präsenz-Status

Jeder Eigentümer erhält einen Status:

| Status | Bedeutung |
|--------|-----------|
| Anwesend | Eigentümer ist anwesend (Check-in erfolgt) |
| Vertreten | Eigentümer wird durch einen Bevollmächtigten vertreten |
| Abwesend | Eigentümer fehlt |

Pro Gemeinschaft wird zusammengefasst: Gesamtzahl Eigentümer, Kopf-Stimmen, Wertquoten, anwesende Eigentümer, anwesende Kopf-Stimmen, anwesende Wertquoten, Anwesenheitsprozente für Kopf und Wert.

### Vollmachten

Ein Eigentümer kann eine andere Person bevollmächtigen. Das System prüft:

- Nur der Bevollmächtigte darf digital abstimmen, nicht der Vollmachtgeber.
- Die Vollmacht muss das Traktandum abdecken.
- Mandatierte Stimmabgaben müssen mit der Weisung übereinstimmen.

## Quorum-Snapshots

Beim Öffnen eines Traktandums friert das System die aktuelle Präsenz und den Quorum-Status ein. Der Snapshot dient als Quorum-Basis für dieses Traktandum.

### Persistenz

Der Snapshot wird in der Datenbank gespeichert und überlebt Server-Neustarts. Er ist die Grundlage für den Quorum-Check bei der Stimmabgabe.

| Feld | Bedeutung |
|------|-----------|
| Traktandum | eindeutig pro Traktandum |
| Versammlung | Versammlung |
| Snapshot | vollständiger Snapshot als JSON |
| Zeitpunkt | Zeitpunkt der Momentaufnahme |
| Beschlussfähigkeit beim Öffnen | war die Versammlung beim Öffnen beschlussfähig? |

## Gemeinschafts-Typen und Standards

### STWEG vs MEG

ResiVote unterscheidet zwei Gemeinschafts-Typen:

| Typ | Bedeutung | Standard-Quorum (Kopf/Wert/Min Owners) |
|-----|-----------|---------------------------------------|
| STWEG | Stockwerkeigentümergemeinschaft | 50% / 50% / 2 |
| MEG | Miteigentümergemeinschaft | 50% / 50% / 1 |

Die Standards können durch Reglement-Vorgaben überschrieben werden, wenn diese festgelegt sind.

### Stimmrechtsmodelle

| Modell | Beschreibung |
|--------|-------------|
| Kopf und Wert | Kopf-Stimmen + Wertquoten (STWEG-Standard) |
| Nur Kopf | Nur Kopf-Stimmen (1 Einheit = 1 Stimme) |
| Nur Wert | Nur Wertquoten |
| Benutzerdefinierte Anteile | Benutzerdefinierte Anteile pro Einheit (MEG-spezifisch) |

### MEG erbt Eigentümer von STWEG

Ein MEG kann Eigentümer von verknüpften STWEGs erben:

- **Eigentümer-Vererbung** – nur relevant für MEG. Wenn aktiv, verwaltet das MEG keine eigenen Einheiten/Eigentümer, sondern erbt sie von verknüpften STWEGs.
- **Vererbungsbedingung** – die Vererbung greift nur, wenn das MEG keine eigenen Einheiten besitzt. Dies verhindert Doppelzählungen.
- **Verknüpfung** – STWEGs und MEGs können miteinander verknüpft werden.

Geerbte MEG-Ergebnisse werden als geerbt markiert und im Gesamt-Ergebnis nicht doppelt gezählt.

### Überbauungen

Eine Überbauung gruppiert mehrere Gemeinschaften (STWEG und/oder MEG). Eine Versammlung kann mehrere Gemeinschaften einer Überbauung umfassen.

## Weiterführende Links

<LinkCard title="Abstimmung" href="/guides/abstimmung/" description="Stimmabgabe, Validierung und Ergebnisse." />
