---
title: Documents and Regulations
description: Document storage, folder structure, encryption, and regulations import in ResiVote.
---

import { Steps, Aside, CardGrid, Card, LinkCard } from '@astrojs/starlight/components';

ResiVote manages documents in a hierarchical folder structure per community. All files are stored encrypted. The regulations import extracts metadata and units from PDFs using AI.

## Document Entity

The `Document` entity (`internal/domain/entity/document.go`) represents a file in the owner portal. Access is controlled via the associated folder.

| Field | Meaning |
|------|-----------|
| `TenantID` | Tenant (multi-tenant isolation) |
| `CommunityID` | Community (nullable for tenant-wide folders) |
| `FolderID` | Parent folder (mandatory) |
| `Title` | Display name |
| `Category` | Category (normalized) |
| `FileName` | Sanitized file name |
| `StorageKey` | Path in the storage backend (not exposed in JSON) |
| `MimeType` | MIME type |
| `SizeBytes` | File size |
| `IsNew` | Unread flag (transient, not in DB) |

### Document Categories

`normalizeDocumentCategory` (`internal/application/document_service.go`) normalizes the category to uppercase and validates against the allowed values:

`PROTOCOL`, `INVITATION`, `ANNUAL_ACCOUNT`, `REGULATION`, `NOTICE`, `FORM`, `OTHER`

Invalid values are set to `OTHER`.

### File Name Sanitization

`sanitizeDocumentFilename` removes path components (`filepath.Base`) and replaces dangerous characters with `_`. Empty names or `.`/`..` are set to `"document"`. This prevents path traversal in the storage key.

## Folder Entity

The `Folder` entity (`internal/domain/entity/folder.go`) forms a hierarchical structure within a community or tenant.

| Field | Meaning |
|------|-----------|
| `CommunityID` | Community (nullable for tenant-wide folders) |
| `ParentFolderID` | Parent folder (nullable for root) |
| `OwnerID` | Owner for personal folders (nullable) |
| `Name` | Folder name |
| `Visibility` | `PUBLIC` or `RESTRICTED` |
| `Path` | Full path (e.g. `Annual Reports/2024`) |
| `DocumentCount` | Document count (transient, populated by service) |

### Visibility

- **`PUBLIC`** – visible to all owners of the community or tenant.
- **`RESTRICTED`** – visible only to the owner (`OwnerID`). Personal folders must be `RESTRICTED`.

### Folder Service

The `folderService` (`internal/application/folder_service.go`) builds the folder structure and validates rules:

- **Path uniqueness** – no duplicate path may exist within a community. `validateFolder` rejects duplicate paths with `Conflict`.
- **Same name in different communities** – allowed, since uniqueness is checked per community.
- **Sub-folders inherit visibility** – a sub-folder must have the same `Visibility` and `OwnerID` as its parent.
- **Parent must be same community** – a sub-folder must be in the same community as its parent.
- **Personal folder** – `GetOrCreateOwnerFolder` automatically creates a `RESTRICTED` folder per owner, named after `Owner.FullName()`.

### Tree Building and Document Count

`ListTreeByCommunity` loads all folders of a community, optionally the personal folder, filters for non-privileged users (only `PUBLIC` + own `RESTRICTED`), builds the tree via `buildFolderTree`, and populates `DocumentCount` per folder via `CountByFolderIDs`.

## Storage Backends

The configuration (`internal/config/config.go`, `StorageConfig`) supports two backends:

| Backend | Configuration |
|---------|--------------|
| **Local file system** | `STORAGE_LOCAL_PATH` (default: `./uploads`) |
| **S3 / MinIO** | `STORAGE_S3_ENDPOINT`, `STORAGE_S3_BUCKET`, `STORAGE_S3_REGION`, `STORAGE_S3_ACCESS_KEY`, `STORAGE_S3_SECRET_KEY`, `STORAGE_S3_USE_PATH_STYLE` |

The storage key is constructed as `documents/{tenantID}/{communityID}/{folderID}/{docID}/{fileName}` (`buildStorageKey`).

### MaxUploadSize

`STORAGE_MAX_UPLOAD_SIZE` limits the upload size. Default value: `50M` (`defaultMaxUploadSize`). The `documentService` rejects files that exceed the limit (`Validation` error).

## Encryption

<Aside type="note" title="Encryption at Rest">
Every document is encrypted before storage. Decryption occurs only during authorized download. The storage never contains plaintext.
</Aside>

### Layers

Encryption consists of two components (`internal/infrastructure/encryption/`):

1. **`TenantKeyProvider`** (`tenant_key.go`) – manages Data Encryption Keys (DEKs) per tenant:
   - `EnsureTenantDEK` generates a 32-byte DEK and wraps it with the master key (AES-GCM). Stored as Base64 in `tenant.EncryptedDEK`.
   - `TenantDEK` unwraps the DEK on demand.
   - `DocumentKey` derives a 32-byte document key via HKDF (SHA-256) from DEK + `documentID`. Info: `resivote-doc-v1`.

2. **`DocumentEncryption`** (`document_encryption.go`) – encrypts and decrypts file contents:
   - `Encrypt` reads plaintext, derives the document key, encrypts with AES-GCM (random nonce). Output: `nonce || ciphertext+tag`.
   - `Decrypt` reverses the process and returns an `io.ReadCloser`.

The master key is configured via `DOCUMENT_ENCRYPTION_MASTER_KEY` (Base64, 32 bytes).

### Access Control

`CanAccess` (`internal/application/document_service.go`) checks per document:

- **Personal folder** – only the owner (`OwnerID`) gets access.
- **Community folder** – owners must belong to the community (via `ctxutil.OwnerCommunityIDsFromContext`).
- **Public folder** – all owners of the tenant.

## Regulations Import

The regulations import is a two-phase process (`internal/application/reglement_import_service.go`):

### Phase 1: Extract

<Steps>
  1. **Upload PDF** – `CommunityHandler.ExtractReglement` (`internal/interfaces/http/handler/community_handler.go`) accepts a PDF (max. 50 MB, `%PDF` magic header validated).
  2. **Extract text** – `pdf.ExtractText` pulls the text via `pdftotext` or Go fallback.
  3. **Sanitize text** – `SanitizeReglementText` removes control characters (except `\n`/`\t`).
  4. **Filter text** – `FilterReglementText` (`internal/application/reglement_filter.go`) keeps only relevant sections (keywords in DE/FR/IT/EN, quota patterns, unit patterns). Header prefix (3500 characters) always. Maximum 40,000 characters.
  5. **Call LLM** – `aiProvider.ExtractReglement` sends the filtered text to the configured AI provider.
  6. **Parse JSON** – `ParseReglementJSON` (`internal/application/reglement_parser.go`) parses the LLM response, validates enums (`STWEG`/`MEG`, `HEAD_AND_VALUE`/`HEAD_ONLY`/`VALUE_ONLY`/`CUSTOM_SHARES`), discards units without `Designation`, caps at 500 units.
  7. **Return draft** – `ReglementExtractionResult` with community metadata, units, and warnings. No database writes.
</Steps>

### Phase 2: Confirm

<Steps>
  1. **Review data** – The user reviews and edits the draft in the frontend.
  2. **Call Confirm** – `ReglementImportService.Confirm` validates name and type (`STWEG`/`MEG`).
  3. **Create community** – `CommunityService.Create` creates the community with all metadata.
  4. **Create units** – `CommunityService.CreateUnit` per unit (designation, value quota, land registry number, etc.).
  5. **Import owners** – optional: if email or name is present, an owner is created or matched by email, plus an `Ownership` (1/1, `IsPrimaryVoter`).
</Steps>

<Aside type="warning" title="No Automatic Rollback">
If a unit creation fails, the already-created community is not automatically rolled back (GORM soft-delete semantics). The caller must handle partial failures.
</Aside>

### Regulation-Configurable Quorums

The community entity (`internal/domain/entity/community.go`) holds three optional regulation fields that override the community type defaults:

| Field | Meaning | Default (NULL) |
|------|-----------|-----------------|
| `ReglementHeadQuorumPct` | Head vote quorum in % | STWEG: 50, MEG: 50 |
| `ReglementValueQuorumPct` | Value quota quorum in % | STWEG: 50, MEG: 50 |
| `ReglementMinOwners` | Minimum number of present owners | STWEG: 2, MEG: 1 |

For details on quorum calculation, see `/guides/quorum/`.

### Voting Rights Cap (Art. 712g ZGB)

The community entity holds two fields for the regulatory voting rights cap:

- **`EnableVotingRightsCap`** – `bool`, defaults to `false`. Must be explicitly enabled.
- **`VotingRightsCapPct`** – `numeric(5,2)`, default `50.00`. Caps an owner's head votes when their share of the total value exceeds the percentage.

The `QuorumEngine` marks affected owners in `CappedOwners` and sets `VotingRightsCapApplied`.

## Further Reading

<LinkCard title="Quorum and Presence" href="/guides/quorum/" description="Resolution capability and regulation quorums." />
<LinkCard title="Security and Audit" href="/reference/sicherheit/" description="Encryption and hash chains." />
