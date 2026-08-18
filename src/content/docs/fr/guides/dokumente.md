---
title: Documents et règlements
description: Gestion documentaire, structure des dossiers, chiffrement et import de règlement dans ResiVote.
---

import { Steps, Aside, CardGrid, Card, LinkCard } from '@astrojs/starlight/components';

ResiVote gère les documents dans une structure de dossiers hiérarchique par communauté. Tous les fichiers sont stockés chiffrés. L'import de règlement extrait les métadonnées et les unités des PDF par IA.

## Entité Document

L'entité `Document` (`internal/domain/entity/document.go`) représente un fichier dans le portail propriétaire. L'accès est contrôlé via le dossier associé.

| Champ | Signification |
|------|---------------|
| `TenantID` | Mandant (isolation multi-mandants) |
| `CommunityID` | Communauté (nullable pour les dossiers à l'échelle du mandant) |
| `FolderID` | Dossier parent (obligatoire) |
| `Title` | Nom d'affichage |
| `Category` | Catégorie (normalisée) |
| `FileName` | Nom de fichier nettoyé |
| `StorageKey` | Chemin dans le backend de stockage (non exposé en JSON) |
| `MimeType` | Type MIME |
| `SizeBytes` | Taille du fichier |
| `IsNew` | Indicateur non lu (transient, non en DB) |

### Catégories de documents

`normalizeDocumentCategory` (`internal/application/document_service.go`) normalise la catégorie en majuscules et la valide par rapport aux valeurs autorisées :

`PROTOCOL`, `INVITATION`, `ANNUAL_ACCOUNT`, `REGULATION`, `NOTICE`, `FORM`, `OTHER`

Les valeurs invalides sont définies sur `OTHER`.

### Nettoyage des noms de fichiers

`sanitizeDocumentFilename` supprime les composants de chemin (`filepath.Base`) et remplace les caractères dangereux par `_`. Les noms vides ou `.`/`..` sont définis sur `"document"`. Cela empêche le path traversal dans la clé de stockage.

## Entité Dossier

L'entité `Folder` (`internal/domain/entity/folder.go`) forme une structure hiérarchique au sein d'une communauté ou d'un mandant.

| Champ | Signification |
|------|---------------|
| `CommunityID` | Communauté (nullable pour les dossiers à l'échelle du mandant) |
| `ParentFolderID` | Dossier parent (nullable pour la racine) |
| `OwnerID` | Propriétaire pour les dossiers personnels (nullable) |
| `Name` | Nom du dossier |
| `Visibility` | `PUBLIC` ou `RESTRICTED` |
| `Path` | Chemin complet (p. ex. `Rapports annuels/2024`) |
| `DocumentCount` | Nombre de documents (transient, rempli par le service) |

### Visibilité

- **`PUBLIC`** – visible pour tous les propriétaires de la communauté ou du mandant.
- **`RESTRICTED`** – visible uniquement pour le propriétaire (`OwnerID`). Les dossiers personnels doivent être `RESTRICTED`.

### Service de dossiers

Le `folderService` (`internal/application/folder_service.go`) construit la structure des dossiers et valide les règles :

- **Unicité du chemin** – au sein d'une communauté, aucun chemin en double ne peut exister. `validateFolder` rejette les chemins en double avec `Conflict`.
- **Même nom dans différentes communautés** – autorisé, car l'unicité est vérifiée par communauté.
- **Les sous-dossiers héritent de la visibilité** – un sous-dossier doit avoir la même `Visibility` et le même `OwnerID` que son parent.
- **Le parent doit être dans la même communauté** – un sous-dossier doit se trouver dans la même communauté que son parent.
- **Dossier personnel** – `GetOrCreateOwnerFolder` crée automatiquement un dossier `RESTRICTED` par propriétaire, nommé d'après `Owner.FullName()`.

### Construction de l'arbre et nombre de documents

`ListTreeByCommunity` charge tous les dossiers d'une communauté, optionnellement le dossier personnel, filtre pour les utilisateurs non privilégiés (uniquement `PUBLIC` + `RESTRICTED` propres), construit l'arbre via `buildFolderTree` et remplit `DocumentCount` par dossier via `CountByFolderIDs`.

## Backends de stockage

La configuration (`internal/config/config.go`, `StorageConfig`) prend en charge deux backends :

| Backend | Configuration |
|---------|--------------|
| **Système de fichiers local** | `STORAGE_LOCAL_PATH` (par défaut : `./uploads`) |
| **S3 / MinIO** | `STORAGE_S3_ENDPOINT`, `STORAGE_S3_BUCKET`, `STORAGE_S3_REGION`, `STORAGE_S3_ACCESS_KEY`, `STORAGE_S3_SECRET_KEY`, `STORAGE_S3_USE_PATH_STYLE` |

La clé de stockage est construite comme `documents/{tenantID}/{communityID}/{folderID}/{docID}/{fileName}` (`buildStorageKey`).

### MaxUploadSize

`STORAGE_MAX_UPLOAD_SIZE` limite la taille des téléchargements. Valeur par défaut : `50M` (`defaultMaxUploadSize`). Le `documentService` rejette les fichiers qui dépassent la limite (erreur `Validation`).

## Chiffrement

<Aside type="note" title="Encryption at Rest">
Chaque document est chiffré avant d'être stocké. Le déchiffrement s'effectue uniquement lors d'un téléchargement autorisé. Le stockage ne contient jamais de texte en clair.
</Aside>

### Couches

Le chiffrement se compose de deux composants (`internal/infrastructure/encryption/`) :

1. **`TenantKeyProvider`** (`tenant_key.go`) – gère les Data Encryption Keys (DEK) par mandant :
   - `EnsureTenantDEK` génère un DEK de 32 octets et l'enveloppe avec la master key (AES-GCM). Stockage en Base64 dans `tenant.EncryptedDEK`.
   - `TenantDEK` dépaquète le DEK au besoin.
   - `DocumentKey` dérive une clé de document de 32 octets via HKDF (SHA-256) à partir de DEK + `documentID`. Info : `resivote-doc-v1`.

2. **`DocumentEncryption`** (`document_encryption.go`) – chiffre et déchiffre les contenus de fichiers :
   - `Encrypt` lit le texte en clair, dérive la clé de document, chiffre avec AES-GCM (nonce aléatoire). Sortie : `nonce || ciphertext+tag`.
   - `Decrypt` inverse le processus et renvoie un `io.ReadCloser`.

La master key est configurée via `DOCUMENT_ENCRYPTION_MASTER_KEY` (Base64, 32 octets).

### Contrôle d'accès

`CanAccess` (`internal/application/document_service.go`) vérifie par document :

- **Dossier personnel** – seul le propriétaire (`OwnerID`) obtient l'accès.
- **Dossier de communauté** – les propriétaires doivent appartenir à la communauté (via `ctxutil.OwnerCommunityIDsFromContext`).
- **Dossier public** – tous les propriétaires du mandant.

## Import de règlement

L'import de règlement est un processus en deux phases (`internal/application/reglement_import_service.go`) :

### Phase 1 : Extraction

<Steps>
  1. **Télécharger le PDF** – `CommunityHandler.ExtractReglement` (`internal/interfaces/http/handler/community_handler.go`) reçoit un PDF (max. 50 Mo, en-tête magique `%PDF` validé).
  2. **Extraire le texte** – `pdf.ExtractText` extrait le texte via `pdftotext` ou le repli Go.
  3. **Nettoyer le texte** – `SanitizeReglementText` supprime les caractères de contrôle (sauf `\n`/`\t`).
  4. **Filtrer le texte** – `FilterReglementText` (`internal/application/reglement_filter.go`) ne conserve que les sections pertinentes (mots-clés en DE/FR/IT/EN, modèles de quotas, modèles d'unités). Préfixe d'en-tête (3500 caractères) toujours inclus. Maximum 40 000 caractères.
  5. **Appeler le LLM** – `aiProvider.ExtractReglement` envoie le texte filtré au provider IA configuré.
  6. **Analyser le JSON** – `ParseReglementJSON` (`internal/application/reglement_parser.go`) analyse la réponse du LLM, valide les enums (`STWEG`/`MEG`, `HEAD_AND_VALUE`/`HEAD_ONLY`/`VALUE_ONLY`/`CUSTOM_SHARES`), rejette les unités sans `Designation`, plafonne à 500 unités.
  7. **Retourner le brouillon** – `ReglementExtractionResult` avec les métadonnées de communauté, les unités et les avertissements. Aucune écriture en base de données.
</Steps>

### Phase 2 : Confirmation

<Steps>
  1. **Vérifier les données** – L'utilisateur vérifie et édite le brouillon dans le frontend.
  2. **Appeler Confirm** – `ReglementImportService.Confirm` valide le nom et le type (`STWEG`/`MEG`).
  3. **Créer la communauté** – `CommunityService.Create` crée la communauté avec toutes les métadonnées.
  4. **Créer les unités** – `CommunityService.CreateUnit` par unité (désignation, quote-part de valeur, numéro de registre foncier, etc.).
  5. **Importer les propriétaires** – optionnel : si un e-mail ou un nom est présent, un Owner est créé ou associé par e-mail, plus une `Ownership` (1/1, `IsPrimaryVoter`).
</Steps>

<Aside type="warning" title="Pas de rollback automatique">
Si la création d'une unité échoue, la communauté déjà créée n'est pas automatiquement annulée (sémantique de soft-delete GORM). L'appelant doit gérer les échecs partiels.
</Aside>

### Quorums configurables par règlement

L'entité Community (`internal/domain/entity/community.go`) contient trois champs de règlement optionnels qui remplacent les standards par type de communauté :

| Champ | Signification | Standard (NULL) |
|------|---------------|-----------------|
| `ReglementHeadQuorumPct` | Quorum de voix par tête en % | STWEG : 50, MEG : 50 |
| `ReglementValueQuorumPct` | Quorum de quotes-parts de valeur en % | STWEG : 50, MEG : 50 |
| `ReglementMinOwners` | Nombre minimum de propriétaires présents | STWEG : 2, MEG : 1 |

Détails sur le calcul du quorum voir `/guides/quorum/`.

### Limitation du droit de vote (Art. 712g ZGB)

L'entité Community contient deux champs pour la limitation réglementaire du droit de vote :

- **`EnableVotingRightsCap`** – `bool`, par défaut `false`. Doit être explicitement activé.
- **`VotingRightsCapPct`** – `numeric(5,2)`, par défaut `50.00`. Plafonne les voix par tête d'un propriétaire lorsque sa part de la valeur totale dépasse le pourcentage.

Le `QuorumEngine` marque les propriétaires concernés dans `CappedOwners` et définit `VotingRightsCapApplied`.

## Liens complémentaires

<LinkCard title="Quorum et présence" href="/guides/quorum/" description="Capacité de résolution et quorums de règlement." />
<LinkCard title="Sécurité et audit" href="/reference/sicherheit/" description="Chiffrement et chaînes de hachage." />
