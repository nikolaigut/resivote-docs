---
title: Dokumente und Reglemente
description: Dokumentenablage, Ordnerstruktur, Verschlüsselung und Reglement-Import in ResiVote.
---

import { Steps, Aside, CardGrid, Card, LinkCard } from '@astrojs/starlight/components';

ResiVote verwaltet Dokumente in einer hierarchischen Ordnerstruktur pro Gemeinschaft. Alle Dateien werden verschlüsselt gespeichert. Der Reglement-Import extrahiert Metadaten und Einheiten aus PDFs per KI.

## Dokumenten-Entität

Die Entität `Document` (`internal/domain/entity/document.go`) repräsentiert eine Datei im Eigentümerportal. Zugriff wird über den zugeordneten Ordner gesteuert.

| Feld | Bedeutung |
|------|-----------|
| `TenantID` | Mandant (Multi-Tenant-Isolation) |
| `CommunityID` | Gemeinschaft (nullable für mandantenweite Ordner) |
| `FolderID` | Übergeordneter Ordner (zwingend) |
| `Title` | Anzeigename |
| `Category` | Kategorie (normalisiert) |
| `FileName` | Bereinigter Dateiname |
| `StorageKey` | Pfad im Storage-Backend (nicht in JSON exponiert) |
| `MimeType` | MIME-Typ |
| `SizeBytes` | Dateigrösse |
| `IsNew` | Ungelesen-Flag (transient, nicht in DB) |

### Dokumentkategorien

`normalizeDocumentCategory` (`internal/application/document_service.go`) normalisiert die Kategorie auf Grossbuchstaben und validiert gegen die erlaubten Werte:

`PROTOCOL`, `INVITATION`, `ANNUAL_ACCOUNT`, `REGULATION`, `NOTICE`, `FORM`, `OTHER`

Ungültige Werte werden auf `OTHER` gesetzt.

### Dateinamen-Bereinigung

`sanitizeDocumentFilename` entfernt Pfadkomponenten (`filepath.Base`) und ersetzt gefährliche Zeichen durch `_`. Leere Namen oder `.`/`..` werden auf `"document"` gesetzt. Dies verhindert Path-Traversal im Storage-Key.

## Ordner-Entität

Die Entität `Folder` (`internal/domain/entity/folder.go`) bildet eine hierarchische Struktur innerhalb einer Gemeinschaft oder eines Mandanten.

| Feld | Bedeutung |
|------|-----------|
| `CommunityID` | Gemeinschaft (nullable für mandantenweite Ordner) |
| `ParentFolderID` | Übergeordneter Ordner (nullable für Root) |
| `OwnerID` | Eigentümer bei persönlichen Ordnern (nullable) |
| `Name` | Ordnername |
| `Visibility` | `PUBLIC` oder `RESTRICTED` |
| `Path` | Vollständiger Pfad (z. B. `Jahresberichte/2024`) |
| `DocumentCount` | Dokumentanzahl (transient, von Service befüllt) |

### Sichtbarkeit

- **`PUBLIC`** – sichtbar für alle Eigentümer der Gemeinschaft oder des Mandanten.
- **`RESTRICTED`** – nur für den Eigentümer (`OwnerID`) sichtbar. Persönliche Ordner müssen `RESTRICTED` sein.

### Ordner-Service

Der `folderService` (`internal/application/folder_service.go`) baut die Ordnerstruktur und validiert Regeln:

- **Pfad-Eindeutigkeit** – innerhalb einer Gemeinschaft darf kein doppelter Pfad existieren. `validateFolder` lehnt doppelte Pfade mit `Conflict` ab.
- **Gleicher Name in verschiedenen Gemeinschaften** – erlaubt, da die Eindeutigkeit pro Gemeinschaft geprüft wird.
- **Sub-Ordner erben Sichtbarkeit** – ein Sub-Ordner muss dieselbe `Visibility` und denselben `OwnerID` wie der Parent haben.
- **Parent muss gleiche Gemeinschaft** – ein Sub-Ordner muss in derselben Gemeinschaft wie sein Parent liegen.
- **Persönlicher Ordner** – `GetOrCreateOwnerFolder` legt automatisch einen `RESTRICTED`-Ordner pro Eigentümer an, benannt nach `Owner.FullName()`.

### Baum-Aufbau und Dokumentanzahl

`ListTreeByCommunity` lädt alle Ordner einer Gemeinschaft, optional den persönlichen Ordner, filtert für nicht-privilegierte Benutzer (nur `PUBLIC` + eigene `RESTRICTED`), baut den Baum via `buildFolderTree` und befüllt `DocumentCount` pro Ordner via `CountByFolderIDs`.

## Storage-Backends

Die Konfiguration (`internal/config/config.go`, `StorageConfig`) unterstützt zwei Backends:

| Backend | Konfiguration |
|---------|--------------|
| **Lokales Dateisystem** | `STORAGE_LOCAL_PATH` (Standard: `./uploads`) |
| **S3 / MinIO** | `STORAGE_S3_ENDPOINT`, `STORAGE_S3_BUCKET`, `STORAGE_S3_REGION`, `STORAGE_S3_ACCESS_KEY`, `STORAGE_S3_SECRET_KEY`, `STORAGE_S3_USE_PATH_STYLE` |

Der Storage-Key wird als `documents/{tenantID}/{communityID}/{folderID}/{docID}/{fileName}` aufgebaut (`buildStorageKey`).

### MaxUploadSize

`STORAGE_MAX_UPLOAD_SIZE` begrenzt die Upload-Grösse. Standardwert: `50M` (`defaultMaxUploadSize`). Der `documentService` lehnt Dateien ab, die das Limit überschreiten (`Validation`-Fehler).

## Verschlüsselung

<Aside type="note" title="Encryption at Rest">
Jedes Dokument wird vor dem Speichern verschlüsselt. Die Entschlüsselung erfolgt nur bei autorisiertem Download. Der Storage enthält niemals Klartext.
</Aside>

### Schichten

Die Verschlüsselung besteht aus zwei Komponenten (`internal/infrastructure/encryption/`):

1. **`TenantKeyProvider`** (`tenant_key.go`) – verwaltet Data-Encryption-Keys (DEKs) pro Mandant:
   - `EnsureTenantDEK` generiert einen 32-Byte-DEK und wickelt ihn mit dem Master-Key (AES-GCM) ein. Speicherung als Base64 in `tenant.EncryptedDEK`.
   - `TenantDEK` entpackt den DEK bei Bedarf.
   - `DocumentKey` leitet einen 32-Byte-Dokument-Key via HKDF (SHA-256) aus DEK + `documentID` ab. Info: `resivote-doc-v1`.

2. **`DocumentEncryption`** (`document_encryption.go`) – ver- und entschlüsselt Dateiinhalte:
   - `Encrypt` liest Plaintext, leitet den Dokument-Key ab, verschlüsselt mit AES-GCM (zufällige Nonce). Ausgabe: `nonce || ciphertext+tag`.
   - `Decrypt` kehrt den Vorgang um und gibt einen `io.ReadCloser` zurück.

Der Master-Key wird via `DOCUMENT_ENCRYPTION_MASTER_KEY` (Base64, 32 Byte) konfiguriert.

### Zugriffskontrolle

`CanAccess` (`internal/application/document_service.go`) prüft pro Dokument:

- **Persönlicher Ordner** – nur der Eigentümer (`OwnerID`) erhält Zugriff.
- **Gemeinschafts-Ordner** – Eigentümer müssen der Gemeinschaft angehören (via `ctxutil.OwnerCommunityIDsFromContext`).
- **Öffentlicher Ordner** – alle Eigentümer des Mandanten.

## Reglement-Import

Der Reglement-Import ist ein zweiphasiger Prozess (`internal/application/reglement_import_service.go`):

### Phase 1: Extrahieren

<Steps>
  1. **PDF hochladen** – `CommunityHandler.ExtractReglement` (`internal/interfaces/http/handler/community_handler.go`) nimmt ein PDF entgegen (max. 50 MB, `%PDF`-Magic-Header validiert).
  2. **Text extrahieren** – `pdf.ExtractText` zieht den Text via `pdftotext` oder Go-Fallback.
  3. **Text bereinigen** – `SanitizeReglementText` entfernt Steuerzeichen (ausser `\n`/`\t`).
  4. **Text filtern** – `FilterReglementText` (`internal/application/reglement_filter.go`) behält nur relevante Abschnitte (Keywords in DE/FR/IT/EN, Quota-Muster, Unit-Muster). Header-Präfix (3500 Zeichen) immer. Maximal 40 000 Zeichen.
  5. **LLM aufrufen** – `aiProvider.ExtractReglement` sendet den gefilterten Text an den konfigurierten AI-Provider.
  6. **JSON parsen** – `ParseReglementJSON` (`internal/application/reglement_parser.go`) parst die LLM-Antwort, validiert Enums (`STWEG`/`MEG`, `HEAD_AND_VALUE`/`HEAD_ONLY`/`VALUE_ONLY`/`CUSTOM_SHARES`), verwirft Einheiten ohne `Designation`, kappelt bei 500 Einheiten.
  7. **Draft zurückgeben** – `ReglementExtractionResult` mit Community-Metadaten, Einheiten und Warnungen. Keine Datenbank-Schreibvorgänge.
</Steps>

### Phase 2: Bestätigen

<Steps>
  1. **Daten prüfen** – Der Benutzer überprüft und editiert den Draft im Frontend.
  2. **Confirm aufrufen** – `ReglementImportService.Confirm` validiert Name und Typ (`STWEG`/`MEG`).
  3. **Gemeinschaft anlegen** – `CommunityService.Create` erzeugt die Gemeinschaft mit allen Metadaten.
  4. **Einheiten anlegen** – `CommunityService.CreateUnit` pro Einheit (Designation, Wertquote, Grundbuchnummer etc.).
  5. **Eigentümer importieren** – optional: wenn E-Mail oder Name vorhanden, wird ein Owner angelegt oder per E-Mail matchiert, plus eine `Ownership` (1/1, `IsPrimaryVoter`).
</Steps>

<Aside type="warning" title="Kein automatisches Rollback">
Wenn eine Einheit-Erstellung fehlschlägt, wird die bereits erstellte Gemeinschaft nicht automatisch zurückgerollt (GORM Soft-Delete-Semantik). Der Aufrufer muss Teilfehler behandeln.
</Aside>

### Reglement-konfigurierbare Quoren

Die Community-Entität (`internal/domain/entity/community.go`) hält drei optionale Reglement-Felder, die die Community-Typ-Standards überschreiben:

| Feld | Bedeutung | Standard (NULL) |
|------|-----------|-----------------|
| `ReglementHeadQuorumPct` | Kopf-Stimmen-Quorum in % | STWEG: 50, MEG: 50 |
| `ReglementValueQuorumPct` | Wertquoten-Quorum in % | STWEG: 50, MEG: 50 |
| `ReglementMinOwners` | Mindestanzahl anwesender Eigentümer | STWEG: 2, MEG: 1 |

Details zur Quorum-Berechnung siehe `/guides/quorum/`.

### Stimmrechtsbegrenzung (Art. 712g ZGB)

Die Community-Entität hält zwei Felder für die reglementarische Stimmrechtsbegrenzung:

- **`EnableVotingRightsCap`** – `bool`, standardmässig `false`. Muss explizit aktiviert werden.
- **`VotingRightsCapPct`** – `numeric(5,2)`, Standard `50.00`. Kappelt die Kopf-Stimmen eines Eigentümers, wenn sein Anteil am Gesamtwert den Prozentsatz übersteigt.

Der `QuorumEngine` markiert betroffene Eigentümer in `CappedOwners` und setzt `VotingRightsCapApplied`.

## Weiterführende Links

<LinkCard title="Quorum und Präsenz" href="/guides/quorum/" description="Beschlussfähigkeit und Reglement-Quoren." />
<LinkCard title="Sicherheit und Audit" href="/reference/sicherheit/" description="Verschlüsselung und Hash-Ketten." />
