---
title: Dokumente und Reglemente
description: Dokumentenablage, Ordnerstruktur, Verschlüsselung und Reglement-Import in ResiVote.
---

import { Steps, Aside, CardGrid, Card, LinkCard } from '@astrojs/starlight/components';

ResiVote verwaltet Dokumente in einer hierarchischen Ordnerstruktur pro Gemeinschaft. Alle Dateien werden verschlüsselt gespeichert. Der Reglement-Import extrahiert Metadaten und Einheiten aus PDFs per KI.

## Dokument

Ein Dokument repräsentiert eine Datei im Eigentümerportal. Zugriff wird über den zugeordneten Ordner gesteuert.

| Feld | Bedeutung |
|------|-----------|
| Mandant | Mandant (Multi-Tenant-Isolation) |
| Gemeinschaft | Gemeinschaft (optional für mandantenweite Ordner) |
| Ordner | Übergeordneter Ordner (zwingend) |
| Titel | Anzeigename |
| Kategorie | Kategorie (normalisiert) |
| Dateiname | Bereinigter Dateiname |
| MIME-Typ | MIME-Typ |
| Dateigrösse | Dateigrösse |
| Ungelesen | Ungelesen-Flag (transient) |

### Dokumentkategorien

ResiVote normalisiert die Kategorie und validiert gegen die erlaubten Werte:

Protokoll, Einladung, Jahresrechnung, Reglement, Mitteilung, Formular, Sonstiges

Ungültige Werte werden auf «Sonstiges» gesetzt.

### Dateinamen-Bereinigung

ResiVote entfernt Pfadkomponenten aus dem Dateinamen und ersetzt gefährliche Zeichen. Leere Namen werden auf einen Standardwert gesetzt. Dies verhindert Path-Traversal.

## Ordner

Ein Ordner bildet eine hierarchische Struktur innerhalb einer Gemeinschaft oder eines Mandanten.

| Feld | Bedeutung |
|------|-----------|
| Gemeinschaft | Gemeinschaft (optional für mandantenweite Ordner) |
| Übergeordneter Ordner | Übergeordneter Ordner (optional für Root) |
| Eigentümer | Eigentümer bei persönlichen Ordnern (optional) |
| Name | Ordnername |
| Sichtbarkeit | Öffentlich oder eingeschränkt |
| Pfad | Vollständiger Pfad (z. B. `Jahresberichte/2024`) |
| Dokumentanzahl | Dokumentanzahl (transient) |

### Sichtbarkeit

- **Öffentlich** – sichtbar für alle Eigentümer der Gemeinschaft oder des Mandanten.
- **Eingeschränkt** – nur für den Eigentümer sichtbar. Persönliche Ordner müssen eingeschränkt sein.

### Ordner-Service

ResiVote baut die Ordnerstruktur und validiert Regeln:

- **Pfad-Eindeutigkeit** – innerhalb einer Gemeinschaft darf kein doppelter Pfad existieren.
- **Gleicher Name in verschiedenen Gemeinschaften** – erlaubt, da die Eindeutigkeit pro Gemeinschaft geprüft wird.
- **Sub-Ordner erben Sichtbarkeit** – ein Sub-Ordner muss dieselbe Sichtbarkeit und denselben Eigentümer wie der Parent haben.
- **Parent muss gleiche Gemeinschaft** – ein Sub-Ordner muss in derselben Gemeinschaft wie sein Parent liegen.
- **Persönlicher Ordner** – ResiVote legt automatisch einen eingeschränkten Ordner pro Eigentümer an, benannt nach dem Eigentümernamen.

### Baum-Aufbau und Dokumentanzahl

ResiVote lädt alle Ordner einer Gemeinschaft, optional den persönlichen Ordner, filtert für nicht-privilegierte Benutzer (nur öffentliche + eigene eingeschränkte), baut den Baum auf und befüllt die Dokumentanzahl pro Ordner.

## Storage-Backends

ResiVote unterstützt zwei Storage-Backends:

| Backend | Konfiguration |
|---------|--------------|
| **Lokales Dateisystem** | Lokaler Pfad (Standard: `./uploads`) |
| **S3 / MinIO** | S3-Endpoint, Bucket, Region, Access-Key, Secret-Key, Path-Style |

Der Storage-Pfad wird als `documents/{Mandant}/{Gemeinschaft}/{Ordner}/{Dokument}/{Dateiname}` aufgebaut.

### Maximal Upload-Grösse

ResiVote begrenzt die Upload-Grösse. Standardwert: 50 MB. Dateien, die das Limit überschreiten, werden abgelehnt.

## Verschlüsselung

<Aside type="note" title="Encryption at Rest">
Jedes Dokument wird vor dem Speichern verschlüsselt. Die Entschlüsselung erfolgt nur bei autorisiertem Download. Der Storage enthält niemals Klartext.
</Aside>

### Schichten

Die Verschlüsselung besteht aus zwei Komponenten:

1. **Mandanten-Schlüsselverwaltung** – verwaltet Data-Encryption-Keys pro Mandant:
   - Pro Mandant wird ein DEK generiert und mit dem Master-Key eingewickelt.
   - Der DEK wird bei Bedarf entpackt.
   - Pro Dokument wird ein separater Dokument-Key aus DEK und Dokument-ID abgeleitet.

2. **Dokumenten-Verschlüsselung** – ver- und entschlüsselt Dateiinhalte:
   - Beim Verschlüsseln wird ein zufälliger Initialisierungsvektor verwendet.
   - Beim Entschlüsseln wird der Vorgang umgekehrt.

Der Master-Key wird über die Konfiguration bereitgestellt.

### Zugriffskontrolle

ResiVote prüft pro Dokument:

- **Persönlicher Ordner** – nur der Eigentümer erhält Zugriff.
- **Gemeinschafts-Ordner** – Eigentümer müssen der Gemeinschaft angehören.
- **Öffentlicher Ordner** – alle Eigentümer des Mandanten.

## Reglement-Import

Der Reglement-Import ist ein zweiphasiger Prozess:

### Phase 1: Extrahieren

<Steps>
  1. **PDF hochladen** – ResiVote nimmt ein PDF entgegen (max. 50 MB, PDF-Format validiert).
  2. **Text extrahieren** – ResiVote zieht den Text aus dem PDF.
  3. **Text bereinigen** – Steuerzeichen werden entfernt (ausser Zeilenumbrüche und Tabulatoren).
  4. **Text filtern** – ResiVote behält nur relevante Abschnitte (Keywords, Quota-Muster, Unit-Muster). Header-Präfix immer. Maximal 40 000 Zeichen.
  5. **KI aufrufen** – Der gefilterte Text wird an den konfigurierten KI-Anbieter gesendet.
  6. **JSON parsen** – ResiVote parst die Antwort, validiert Werte (Gemeinschaftstyp, Stimmrechtsmodell), verwirft Einheiten ohne Bezeichnung, kappelt bei 500 Einheiten.
  7. **Draft zurückgeben** – Ergebnis mit Gemeinschafts-Metadaten, Einheiten und Warnungen. Keine Datenbank-Schreibvorgänge.
</Steps>

### Phase 2: Bestätigen

<Steps>
  1. **Daten prüfen** – Der Benutzer überprüft und editiert den Draft im Frontend.
  2. **Bestätigen** – ResiVote validiert Name und Typ (STWEG oder MEG).
  3. **Gemeinschaft anlegen** – ResiVote erzeugt die Gemeinschaft mit allen Metadaten.
  4. **Einheiten anlegen** – pro Einheit (Bezeichnung, Wertquote, Grundbuchnummer etc.).
  5. **Eigentümer importieren** – optional: wenn E-Mail oder Name vorhanden, wird ein Eigentümer angelegt oder per E-Mail matchiert, plus eine Eigentümerschaft (1/1, als Hauptwähler markiert).
</Steps>

<Aside type="warning" title="Kein automatisches Rollback">
Wenn eine Einheit-Erstellung fehlschlägt, wird die bereits erstellte Gemeinschaft nicht automatisch zurückgerollt. Der Aufrufer muss Teilfehler behandeln.
</Aside>

### Reglement-konfigurierbare Quoren

Die Gemeinschaft hält drei optionale Reglement-Felder, die die Gemeinschafts-Typ-Standards überschreiben:

| Feld | Bedeutung | Standard |
|------|-----------|----------|
| Kopf-Stimmen-Quorum in % | Kopf-Stimmen-Quorum | STWEG: 50, MEG: 50 |
| Wertquoten-Quorum in % | Wertquoten-Quorum | STWEG: 50, MEG: 50 |
| Mindestanzahl Eigentümer | Mindestanzahl anwesender Eigentümer | STWEG: 2, MEG: 1 |

Details zur Quorum-Berechnung siehe `/guides/quorum/`.

### Stimmrechtsbegrenzung (Art. 712g ZGB)

Die Gemeinschaft hält zwei Felder für die reglementarische Stimmrechtsbegrenzung:

- **Aktiv** – standardmässig deaktiviert. Muss explizit aktiviert werden.
- **Prozentsatz** – Standard 50.00. Kappelt die Kopf-Stimmen eines Eigentümers, wenn sein Anteil am Gesamtwert den Prozentsatz übersteigt.

Betroffene Eigentümer werden im Ergebnis markiert.

## Weiterführende Links

<LinkCard title="Quorum und Präsenz" href="/guides/quorum/" description="Beschlussfähigkeit und Reglement-Quoren." />
