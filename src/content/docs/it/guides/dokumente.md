---
title: Documenti e regolamenti
description: Archiviazione dei documenti, struttura delle cartelle, cifratura e importazione dei regolamenti in ResiVote.
---

import { Steps, Aside, CardGrid, Card, LinkCard } from '@astrojs/starlight/components';

ResiVote gestisce i documenti in una struttura gerarchica di cartelle per comunità. Tutti i file vengono salvati cifrati. L'importazione dei regolamenti estrae metadati e unità dai PDF tramite IA.

## Entità documento

L'entità `Document` (`internal/domain/entity/document.go`) rappresenta un file nel portale dei proprietari. L'accesso viene controllato tramite la cartella associata.

| Campo | Significato |
|------|-------------|
| `TenantID` | Mandante (isolamento multi-tenant) |
| `CommunityID` | Comunità (nullable per cartelle a livello di mandante) |
| `FolderID` | Cartella superiore (obbligatorio) |
| `Title` | Nome visualizzato |
| `Category` | Categoria (normalizzata) |
| `FileName` | Nome file pulito |
| `StorageKey` | Percorso nel backend di storage (non esposto in JSON) |
| `MimeType` | Tipo MIME |
| `SizeBytes` | Dimensione del file |
| `IsNew` | Flag non letto (transiente, non nel DB) |

### Categorie di documenti

`normalizeDocumentCategory` (`internal/application/document_service.go`) normalizza la categoria in maiuscolo e la valida rispetto ai valori consentiti:

`PROTOCOL`, `INVITATION`, `ANNUAL_ACCOUNT`, `REGULATION`, `NOTICE`, `FORM`, `OTHER`

I valori non validi vengono impostati su `OTHER`.

### Pulizia del nome file

`sanitizeDocumentFilename` rimuove le componenti di percorso (`filepath.Base`) e sostituisce i caratteri pericolosi con `_`. I nomi vuoti o `.`/`..` vengono impostati su `"document"`. Questo impedisce il path-traversal nella chiave di storage.

## Entità cartella

L'entità `Folder` (`internal/domain/entity/folder.go`) forma una struttura gerarchica all'interno di una comunità o di un mandante.

| Campo | Significato |
|------|-------------|
| `CommunityID` | Comunità (nullable per cartelle a livello di mandante) |
| `ParentFolderID` | Cartella superiore (nullable per la root) |
| `OwnerID` | Proprietario per cartelle personali (nullable) |
| `Name` | Nome della cartella |
| `Visibility` | `PUBLIC` o `RESTRICTED` |
| `Path` | Percorso completo (p. es. `Rapporti annuali/2024`) |
| `DocumentCount` | Numero di documenti (transiente, riempito dal service) |

### Visibilità

- **`PUBLIC`** – visibile a tutti i proprietari della comunità o del mandante.
- **`RESTRICTED`** – visibile solo al proprietario (`OwnerID`). Le cartelle personali devono essere `RESTRICTED`.

### Service delle cartelle

Il `folderService` (`internal/application/folder_service.go`) costruisce la struttura delle cartelle e valida le regole:

- **Univocità del percorso** – all'interno di una comunità non può esistere un percorso duplicato. `validateFolder` rifiuta percorsi doppi con `Conflict`.
- **Stesso nome in comunità diverse** – consentito, poiché l'univocità è verificata per comunità.
- **Le sottocartelle ereditano la visibilità** – una sottocartella deve avere la stessa `Visibility` e lo stesso `OwnerID` della cartella madre.
- **La cartella madre deve appartenere alla stessa comunità** – una sottocartella deve trovarsi nella stessa comunità della cartella madre.
- **Cartella personale** – `GetOrCreateOwnerFolder` crea automaticamente una cartella `RESTRICTED` per proprietario, denominata secondo `Owner.FullName()`.

### Costruzione dell'albero e conteggio documenti

`ListTreeByCommunity` carica tutte le cartelle di una comunità, opzionalmente la cartella personale, filtra per utenti non privilegiati (solo `PUBLIC` + proprie `RESTRICTED`), costruisce l'albero tramite `buildFolderTree` e riempie `DocumentCount` per cartella tramite `CountByFolderIDs`.

## Backend di storage

La configurazione (`internal/config/config.go`, `StorageConfig`) supporta due backend:

| Backend | Configurazione |
|---------|----------------|
| **Filesystem locale** | `STORAGE_LOCAL_PATH` (predefinito: `./uploads`) |
| **S3 / MinIO** | `STORAGE_S3_ENDPOINT`, `STORAGE_S3_BUCKET`, `STORAGE_S3_REGION`, `STORAGE_S3_ACCESS_KEY`, `STORAGE_S3_SECRET_KEY`, `STORAGE_S3_USE_PATH_STYLE` |

La chiave di storage viene costruita come `documents/{tenantID}/{communityID}/{folderID}/{docID}/{fileName}` (`buildStorageKey`).

### MaxUploadSize

`STORAGE_MAX_UPLOAD_SIZE` limita la dimensione dell'upload. Valore predefinito: `50M` (`defaultMaxUploadSize`). Il `documentService` rifiuta i file che superano il limite (errore `Validation`).

## Cifratura

<Aside type="note" title="Encryption at Rest">
Ogni documento viene cifrato prima del salvataggio. La decifratura avviene solo in caso di download autorizzato. Lo storage non contiene mai testo in chiaro.
</Aside>

### Strati

La cifratura consiste in due componenti (`internal/infrastructure/encryption/`):

1. **`TenantKeyProvider`** (`tenant_key.go`) – gestisce le chiavi di cifratura dei dati (DEK) per mandante:
   - `EnsureTenantDEK` genera un DEK di 32 byte e lo avvolge con la chiave master (AES-GCM). Salvataggio come Base64 in `tenant.EncryptedDEK`.
   - `TenantDEK` spacca il DEK all'occorrenza.
   - `DocumentKey` deriva una chiave di documento di 32 byte tramite HKDF (SHA-256) da DEK + `documentID`. Info: `resivote-doc-v1`.

2. **`DocumentEncryption`** (`document_encryption.go`) – cifra e decifra i contenuti dei file:
   - `Encrypt` legge il testo in chiaro, deriva la chiave di documento, cifra con AES-GCM (nonce casuale). Output: `nonce || ciphertext+tag`.
   - `Decrypt` inverte il processo e restituisce un `io.ReadCloser`.

La chiave master viene configurata tramite `DOCUMENT_ENCRYPTION_MASTER_KEY` (Base64, 32 byte).

### Controllo degli accessi

`CanAccess` (`internal/application/document_service.go`) verifica per ogni documento:

- **Cartella personale** – solo il proprietario (`OwnerID`) ottiene accesso.
- **Cartella di comunità** – i proprietari devono appartenere alla comunità (tramite `ctxutil.OwnerCommunityIDsFromContext`).
- **Cartella pubblica** – tutti i proprietari del mandante.

## Importazione dei regolamenti

L'importazione dei regolamenti è un processo in due fasi (`internal/application/reglement_import_service.go`):

### Fase 1: estrarre

<Steps>
  1. **Caricare il PDF** – `CommunityHandler.ExtractReglement` (`internal/interfaces/http/handler/community_handler.go`) accetta un PDF (max. 50 MB, magic-header `%PDF` validato).
  2. **Estrarre il testo** – `pdf.ExtractText` estrae il testo tramite `pdftotext` o fallback Go.
  3. **Pulire il testo** – `SanitizeReglementText` rimuove i caratteri di controllo (eccetto `\n`/`\t`).
  4. **Filtrare il testo** – `FilterReglementText` (`internal/application/reglement_filter.go`) conserva solo le sezioni rilevanti (parole chiave in DE/FR/IT/EN, pattern di quote, pattern di unità). Prefisso di intestazione (3500 caratteri) sempre. Massimo 40 000 caratteri.
  5. **Chiamare l'LLM** – `aiProvider.ExtractReglement` invia il testo filtrato al provider IA configurato.
  6. **Parsare il JSON** – `ParseReglementJSON` (`internal/application/reglement_parser.go`) analizza la risposta dell'LLM, valida gli enum (`STWEG`/`MEG`, `HEAD_AND_VALUE`/`HEAD_ONLY`/`VALUE_ONLY`/`CUSTOM_SHARES`), scarta le unità senza `Designation`, tronca a 500 unità.
  7. **Restituire la bozza** – `ReglementExtractionResult` con metadati della comunità, unità e avvertenze. Nessuna operazione di scrittura nel database.
</Steps>

### Fase 2: confermare

<Steps>
  1. **Verificare i dati** – L'utente rivede e modifica la bozza nel frontend.
  2. **Chiamare Confirm** – `ReglementImportService.Confirm` valida nome e tipo (`STWEG`/`MEG`).
  3. **Creare la comunità** – `CommunityService.Create` genera la comunità con tutti i metadati.
  4. **Creare le unità** – `CommunityService.CreateUnit` per ogni unità (designazione, quota di valore, numero di registro fondiario ecc.).
  5. **Importare i proprietari** – opzionale: se è presente un'e-mail o un nome, viene creato un Owner o associato tramite e-mail, più una `Ownership` (1/1, `IsPrimaryVoter`).
</Steps>

<Aside type="warning" title="Nessun rollback automatico">
Se la creazione di un'unità fallisce, la comunità già creata non viene automaticamente cancellata (semantica soft-delete di GORM). Il chiamante deve gestire i fallimenti parziali.
</Aside>

### Quorum configurabili tramite regolamento

L'entità Community (`internal/domain/entity/community.go`) contiene tre campi opzionali del regolamento che sovrascrivono gli standard del tipo di comunità:

| Campo | Significato | Standard (NULL) |
|------|-------------|-----------------|
| `ReglementHeadQuorumPct` | Quorum voti per testa in % | STWEG: 50, MEG: 50 |
| `ReglementValueQuorumPct` | Quorum quote di valore in % | STWEG: 50, MEG: 50 |
| `ReglementMinOwners` | Numero minimo di proprietari presenti | STWEG: 2, MEG: 1 |

Per i dettagli sul calcolo del quorum si veda `/guides/quorum/`.

### Limitazione del diritto di voto (Art. 712g ZGB)

L'entità Community contiene due campi per la limitazione regolamentare del diritto di voto:

- **`EnableVotingRightsCap`** – `bool`, predefinito `false`. Deve essere attivato esplicitamente.
- **`VotingRightsCapPct`** – `numeric(5,2)`, predefinito `50.00`. Limita i voti per testa di un proprietario se la sua quota sul valore totale supera la percentuale.

Il `QuorumEngine` marca i proprietari interessati in `CappedOwners` e imposta `VotingRightsCapApplied`.

## Link di approfondimento

<LinkCard title="Quorum e presenza" href="/guides/quorum/" description="Capacità deliberativa e quorum del regolamento." />
<LinkCard title="Sicurezza e audit" href="/reference/sicherheit/" description="Cifratura e catene di hash." />
