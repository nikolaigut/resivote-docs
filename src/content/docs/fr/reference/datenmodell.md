---
title: Modèle de données
description: Documentation de référence des entités, relations et migrations de base de données de ResiVote.
---

import { Aside, LinkCard } from '@astrojs/starlight/components';

ResiVote gère 31 entités dans `internal/domain/entity/`. Toutes les entités tenant-scoped portent un champ `TenantID` (UUID), qui utilise PostgreSQL Row-Level Security (RLS) pour l'isolation. Les migrations se trouvent dans le répertoire `migrations/` et sont appliquées avec `golang-migrate`.

## Entités principales

### Tenant

Organisation de gestion immobilière isolée. Chaque mandant gère ses propres communautés, propriétaires et assemblées.

| Champ | Type | Description |
|---|---|---|
| `ID` | UUID | Clé primaire |
| `Name` | string | Nom d'affichage |
| `Slug` | string (max 12) | Slug unique, p. ex. `mueller-hv` |
| `IsActive` | bool | Statut actif |
| `PortalEnabled` | bool | Portail client activé |
| `MeetingEnabled` | bool | Fonctionnalité d'assemblée numérique activée |
| `EncryptedDEK` | *string | Data Encryption Key chiffré en Base64 (AES-GCM) |
| `DEKKeyVersion` | int | Version de clé |
| `InvoiceSenderName/Street/City/VatNumber/QrIban` | string | Overrides d'expéditeur de facture |

### Community

Représente un STWEG (communauté des propriétaires par étages) ou un MEG (communauté des copropriétaires).

| Champ | Type | Description |
|---|---|---|
| `ID` | UUID | Clé primaire |
| `TenantID` | UUID | Association au mandant (FK) |
| `Name` | string | Nom de la communauté |
| `Type` | CommunityType | `STWEG` ou `MEG` |
| `VotingRightsModel` | VotingRightsModel | `HEAD_AND_VALUE`, `HEAD_ONLY`, `VALUE_ONLY`, `CUSTOM_SHARES` |
| `TotalValueQuota` | int | Somme de toutes les quotes-parts de valeur (p. ex. 1000 pour les millièmes) |
| `EnableVotingRightsCap` | bool | Limitation du droit de vote activée (Art. 712g ZGB) |
| `VotingRightsCapPct` | float64 | Part maximale du droit de vote en pourcentage |
| `ReglementHeadQuorumPct` | *float64 | Override de règlement pour le quorum de têtes |
| `ReglementValueQuorumPct` | *float64 | Override de règlement pour le quorum de valeur |
| `ReglementMinOwners` | *int | Override de règlement pour le nombre minimum de propriétaires |
| `InheritsOwners` | bool | Le MEG hérite des propriétaires des STWEG associés |
| `DevelopmentID` | *uuid.UUID | Regroupement optionnel sous un ensemble immobilier |

### Development (Überbauung)

Regroupe une ou plusieurs communautés (STWEG et/ou MEG).

| Champ | Type | Description |
|---|---|---|
| `ID` | UUID | Clé primaire |
| `TenantID` | UUID | Association au mandant |
| `Name` | string | Nom de l'ensemble immobilier |
| `Address` | string | Adresse |

### CommunityLink

Table de jointure M:N entre STWEG et MEG.

| Champ | Type | Description |
|---|---|---|
| `STWEGID` | UUID | FK vers Community (STWEG) |
| `MEGID` | UUID | FK vers Community (MEG) |
| `TenantID` | UUID | Association au mandant |

### Unit

Unité immobilière individuelle (unité/objet) au sein d'une communauté.

| Champ | Type | Description |
|---|---|---|
| `ID` | UUID | Clé primaire |
| `CommunityID` | UUID | FK vers Community |
| `Designation` | string | Désignation, p. ex. « Appartement 3e étage gauche » |
| `UnitNumber` | string | Numéro d'unité, p. ex. « 301 » |
| `ValueQuota` | int | Quote-part de valeur en millièmes (STWEG) |
| `CustomShares` | int | Parts personnalisées (MEG) |
| `HeadVoteCount` | int | Affichage uniquement ; le moteur de quorum utilise toujours 1 (Art. 712o ZGB) |
| `ValidFrom` | time.Time | Valide à partir de |
| `ValidUntil` | *time.Time | Valide jusqu'à (optionnel) |
| `LandRegistryNumber` | string | Numéro de registre foncier |
| `LandRegistryOffice` | string | Office/cercle du registre foncier |

### Owner

Propriétaire au sein d'un mandant. Un Owner peut posséder des unités dans plusieurs communautés, mais uniquement au sein d'un même mandant.

| Champ | Type | Description |
|---|---|---|
| `ID` | UUID | Clé primaire |
| `TenantID` | UUID | Association au mandant |
| `ExternalUserID` | string | Identité utilisateur globale (ZITADEL sub) |
| `UserID` | *uuid.UUID | FK optionnelle vers la table `users` |
| `FirstName` / `LastName` | string | Nom |
| `Email` | string | E-mail |
| `IsArchived` | bool | Archivé |
| `ArchivedAt` | *time.Time | Date d'archivage |

### Ownership

Relation M:N entre Owner et Unit. Prend en charge la copropriété avec fractions.

| Champ | Type | Description |
|---|---|---|
| `UnitID` | UUID | FK vers Unit |
| `OwnerID` | UUID | FK vers Owner |
| `ShareNumerator` | int | Numérateur, p. ex. 1 |
| `ShareDenominator` | int | Dénominateur, p. ex. 2 → 50% |
| `IsPrimaryVoter` | bool | Électeur principal en cas de copropriété |
| `ValidFrom` | time.Time | Valide à partir de |
| `ValidUntil` | *time.Time | Valide jusqu'à |

## Assemblée et vote

### Meeting

Assemblée qui peut regrouper plusieurs communautés.

| Champ | Type | Description |
|---|---|---|
| `ID` | UUID | Clé primaire |
| `TenantID` | UUID | Association au mandant |
| `Slug` | string (max 12) | Slug unique par mandant |
| `Title` | string | Titre |
| `State` | MeetingState | `DRAFT`, `PUBLISHED`, `CHECK_IN`, `IN_PROGRESS`, `CLOSED`, `ARCHIVED` |
| `Mode` | MeetingMode | `LIVE_MEETING` ou `CIRCULAR_RESOLUTION` (Art. 712m al. 2 ZGB) |
| `ScheduledAt` | time.Time | Date planifiée |
| `CheckinMethod` | *CheckinMethod | `MANUAL`, `QR_CODE`, `SIGNATURE` |
| `ProtocolWriterType` | *ProtocolWriterType | `OWNER` ou `TENANT_ADMIN` |
| `LiveResultsVisibleTo` | *LiveResultsVisibility | `ALL` ou `CHAIR` |
| `RequireVoteConfirmation` | bool | Obligation de confirmation pour les votes |

**Relation M:N :** `MeetingCommunity` (table de jointure `meeting_communities`) associe les assemblées à plusieurs communautés.

### AgendaItem

Point de l'ordre du jour au sein d'une assemblée.

| Champ | Type | Description |
|---|---|---|
| `MeetingID` | UUID | FK vers Meeting |
| `CommunityID` | *uuid.UUID | NULL = toutes les communautés de l'assemblée |
| `OrderNumber` | int | Ordre |
| `Type` | AgendaItemType | `MOTION`, `ELECTION`, `FREE_TEXT`, `PROTOCOL` |
| `State` | AgendaItemState | `PENDING`, `PRESENTING`, `PRE_VOTING`, `OPEN`, `CLOSED`, `SKIPPED` |
| `QuorumType` | QuorumType | `SIMPLE_MAJORITY`, `QUALIFIED_MAJORITY`, `UNANIMOUS`, `ABSOLUTE_MAJORITY`, `CUSTOM` |
| `CustomQuorumPct` | *float64 | Pourcentage de quorum personnalisé |
| `Candidates` | pq.StringArray | Candidats pour ELECTION |
| `QuorumOverride` | bool | Le président peut lever le blocage de quorum |
| `QuorumOverrideReason` | string | Justification (obligatoire en cas d'override) |
| `TimerStartedAt` | *time.Time | Départ du minuteur de présentation |
| `TimerDurationSeconds` | int | Durée du minuteur |

### Vote

Vote individuel par unité et par point de l'ordre du jour. **Immuable** — en cas de modification, l'ancien vote est marqué comme `IsSuperseded=true` et un nouveau vote est créé.

| Champ | Type | Description |
|---|---|---|
| `AgendaItemID` | UUID | FK vers AgendaItem |
| `UnitID` | UUID | FK vers Unit |
| `VoterID` | UUID | Propriétaire qui a voté |
| `ProxyID` | *uuid.UUID | En cas de vote par procuration |
| `Choice` | VoteChoice | `YES`, `NO`, `ABSTAIN`, `CANDIDATE`, `FREE_TEXT` |
| `CandidateName` | *string | Pour ELECTION |
| `FreeTextValue` | *string | Pour FREE_TEXT |
| `HeadVoteValue` | int | Standard 1 (Art. 712o ZGB) |
| `ValueQuota` | int | Instantané de la quote-part de valeur de l'unité au moment du vote |
| `CustomShares` | int | Instantané des parts personnalisées |
| `IsPreVote` | bool | Vote de la phase PRE_VOTING |
| `IsSuperseded` | bool | Remplacé par un vote plus récent |

### QuorumSnapshot

Fige l'état de présence/quorum lors de l'ouverture d'un point de l'ordre du jour. Survit aux redémarrages du serveur.

| Champ | Type | Description |
|---|---|---|
| `AgendaItemID` | UUID | Unique par point de l'ordre du jour |
| `SnapshotJSON` | json.RawMessage | Instantané complet du quorum en JSONB |
| `QuorumMetAtOpen` | bool | Le quorum était-il atteint à l'ouverture |

## Procuration et présence

### Proxy

Procuration d'un propriétaire à un autre pour une assemblée et une unité.

| Champ | Type | Description |
|---|---|---|
| `MeetingID` | UUID | FK vers Meeting |
| `GrantorID` | UUID | Propriétaire qui accorde la procuration |
| `GranteeID` | UUID | Propriétaire qui reçoit la procuration |
| `UnitID` | UUID | Unité concernée |
| `Scope` | ProxyScope | `FULL` (assemblée entière) ou `RESTRICTED` (TOPs spécifiques) |
| `RevokedAt` | *time.Time | Date de révocation |

### ProxyInstruction

Instruction de vote obligatoire pour une procuration.

| Champ | Type | Description |
|---|---|---|
| `ProxyID` | UUID | FK vers Proxy |
| `AgendaItemID` | UUID | FK vers AgendaItem |
| `MandatedVote` | VoteChoice | Vote prescrit |

### Attendance

Enregistrement d'un propriétaire pour une assemblée.

| Champ | Type | Description |
|---|---|---|
| `MeetingID` | UUID | FK vers Meeting |
| `OwnerID` | UUID | FK vers Owner |
| `UnitID` | UUID | FK vers Unit |
| `Method` | AttendanceMethod | `CHECKIN`, `SELF_CHECKIN`, `SIGNATURE`, `VOTE` |
| `CheckedInAt` | time.Time | Moment de l'enregistrement |

### Presence et Signature

`PresenceRecord` et `CommunityPresence` sont des DTOs calculés (pas de tables DB), que le `PresenceBuilder` agrège à partir des données d'Attendance, d'Ownership et de Proxy.

`Signature` stocke une signature numérique du flux d'enregistrement par tablette dans une table distincte. `SignatureUnit` associe la signature à toutes les unités couvertes (propres + unités sous procuration). Les deux tables sont immuables au niveau DB (les triggers bloquent UPDATE/DELETE/TRUNCATE).

## Gestion documentaire

### Document

Fichier dans le portail client. L'accès est contrôlé via le dossier associé.

| Champ | Type | Description |
|---|---|---|
| `CommunityID` | *uuid.UUID | NULL = à l'échelle du mandant |
| `FolderID` | UUID | FK vers Folder |
| `Category` | string | `PROTOCOL`, `INVITATION`, `ANNUAL_ACCOUNT`, `REGULATION`, `NOTICE`, `FORM`, `OTHER` |
| `StorageKey` | string | Clé de stockage Blob (non sérialisée) |
| `FileName` | string | Nom du fichier d'origine |
| `MimeType` | string | Type MIME |
| `SizeBytes` | int64 | Taille du fichier |

### Folder

Structure de dossiers hiérarchique au sein d'une communauté ou d'un mandant.

| Champ | Type | Description |
|---|---|---|
| `CommunityID` | uuid.NullUUID | NULL = à l'échelle du mandant |
| `ParentFolderID` | uuid.NullUUID | NULL = dossier racine |
| `OwnerID` | uuid.NullUUID | NULL = public ; défini = dossier personnel |
| `Visibility` | string | `PUBLIC` ou `RESTRICTED` |
| `Path` | string | Chemin matérialisé |

## Audit et utilisateurs

### AuditEntry

Entrées de journal d'audit immuables avec chaîne de hachage. Chaque entrée contient `PreviousHash` et `Hash` (HMAC-SHA-256 en production). Trois versions de hachage : v1 (SHA-256 simple, déprécié), v2 (tous les champs + HMAC optionnel), v3 (v2 + `ImpersonatedByID`).

| Champ | Type | Description |
|---|---|---|
| `EntityType` | string | p. ex. « vote », « meeting » |
| `EntityID` | UUID | Entité concernée |
| `Action` | string | p. ex. « CREATED », « STATE_CHANGED », « VOTE_CAST » |
| `ActorID` | UUID | Utilisateur exécutant |
| `ImpersonatedByID` | *uuid.UUID | Super-admin en cas d'impersonation |
| `OldValue` / `NewValue` | *string | Diff JSON |
| `PreviousHash` | string | Hash de l'entrée précédente |
| `Hash` | string | Hash propre |
| `HashVersion` | int | 1, 2 ou 3 |

### User

Identité de plateforme authentifiée (ZITADEL sub). Découplée des enregistrements Owner.

| Champ | Type | Description |
|---|---|---|
| `TenantID` | *uuid.UUID | Nullable pour `super_admin` (global) |
| `ExternalUserID` | string | ZITADEL sub |
| `Email` | string | E-mail |
| `Role` | string | `tenant_admin`, `super_admin`, `meeting_chair`, `owner` |

### UserTenantRole

Source de vérité pour les attributions de mandants. Un User peut avoir plusieurs entrées — une par mandant. `super_admin` n'est pas stocké ici (claim JWT global).

| Champ | Type | Description |
|---|---|---|
| `UserID` | UUID | FK vers User |
| `TenantID` | UUID | FK vers Tenant |
| `Role` | string | `tenant_admin`, `meeting_chair`, `owner` |

### UserInvitation

Invitation en attente pour un nouvel utilisateur ou un utilisateur existant.

| Champ | Type | Description |
|---|---|---|
| `TenantID` | UUID | FK vers Tenant |
| `Email` | string | E-mail de l'invité |
| `Code` | string | Code d'invitation |
| `Role` | string | Rôle attribué |
| `ExpiresAt` | time.Time | Date d'expiration |

## Communication et portail

### Message et MessageCommunity

Communication diffusée par l'administration aux communautés. `MessageCommunity` est la table de jointure M:N.

| Champ | Type | Description |
|---|---|---|
| `AuthorID` | UUID | FK vers User |
| `Subject` / `Body` | string | Sujet et contenu |
| `Priority` | MessagePriority | `normal`, `important`, `pinned` |
| `ChannelInApp` / `ChannelEmail` / `ChannelPush` | bool | Canaux d'envoi |

### Notification et PushSubscription

Notifications in-app et push pour les utilisateurs du portail.

| Champ | Type | Description |
|---|---|---|
| `UserID` | UUID | FK vers User |
| `Type` | NotificationType | `DOCUMENT`, `FORUM`, `TICKET`, `ANNOUNCEMENT` |
| `IsRead` | bool | Statut de lecture |

`PushSubscription` stocke les endpoints push navigateur (VAPID).

### Forum (ForumPost)

Forum communautaire public. Les posts de premier niveau ont `ParentID == nil` ; les réponses référencent leur parent.

| Champ | Type | Description |
|---|---|---|
| `CommunityID` | UUID | FK vers Community |
| `ParentID` | *uuid.UUID | NULL = premier niveau |
| `AuthorType` | ForumAuthorType | `OWNER` ou `ADMIN` |
| `IsPinned` | bool | Épinglé |

### Ticket et TicketMessage

Ticket de support privé entre propriétaire et administration.

| Champ | Type | Description |
|---|---|---|
| `CommunityID` | UUID | FK vers Community |
| `OwnerID` | UUID | FK vers Owner |
| `Category` | TicketCategory | `GENERAL`, `REQUEST`, `DEFECT`, `TENANT_CHANGE`, `COMPLAINT`, `ACCESS`, `OTHER` |
| `Status` | TicketStatus | `OPEN`, `RESOLVED`, `CLOSED` |

`TicketMessage` stocke les réponses. `TicketAttachment` stocke les fichiers joints.

## Répartition des coûts et facturation

### CostDistributionKey et CostDistributionUnitShare

Définit une catégorie de coûts pour un MEG et sa répartition sur les unités.

| Champ | Type | Description |
|---|---|---|
| `CommunityID` | UUID | FK vers Community |
| `Name` | string | p. ex. « Installations générales » |
| `Type` | CostDistributionType | `EQUAL_PER_UNIT`, `VALUE_QUOTA`, `CUSTOM_SHARES`, `SELF_BORNE`, `BY_RESOLUTION` |

`CostDistributionUnitShare` définit des parts explicites par unité (uniquement `CUSTOM_SHARES` et `SELF_BORNE`).

### CostStatement et CostStatementPosition

Décompte concret : un montant total appliqué à un CostDistributionKey. Lors de la création, des entrées `CostStatementPosition` sont automatiquement calculées et persistées par unité. Les positions sont immuables après création.

### Invoice et InvoiceLineItem

Facture d'abonnement SaaS pour un mandant. Contient une `InvoiceLineItem` par communauté dans la période de facturation.

| Champ | Type | Description |
|---|---|---|
| `PeriodStart` / `PeriodEnd` | time.Time | Période de facturation |
| `TotalAmountCents` | int64 | Montant total en centimes |
| `Status` | InvoiceStatus | `DRAFT`, `PENDING`, `PAID`, `VOID` |
| `Source` | InvoiceSource | `AUTO` ou `MANUAL` |

### ScheduledEmail

E-mail transactionnel planifié pour une assemblée. Un worker d'arrière-plan traite les entrées échues.

| Champ | Type | Description |
|---|---|---|
| `MeetingID` | UUID | FK vers Meeting |
| `Type` | ScheduledEmailType | `INVITATION`, `REMINDER`, `CLOSED` |
| `DeliveryStatus` | ScheduledEmailDeliveryStatus | `pending`, `sent`, `failed`, `dead_letter` |
| `RetryCount` | int | Nombre de tentatives |
| `NextRetryAt` | *time.Time | Prochaine tentative |

## Pièces jointes et présentation

### AgendaItemAttachment et AgendaItemSlide

Pièce jointe de fichier ou de présentation pour un point de l'ordre du jour. `Kind` : `DOCUMENT`, `PRESENTATION`, `SLIDES`. `AgendaItemSlide` stocke des diapositives individuelles en contenu JSONB.

### MeetingAttachment

Fichier associé à une assemblée dans son ensemble (non à un point de l'ordre du jour spécifique).

## Migrations et RLS

Le répertoire `migrations/` contient 43 migrations SQL versionnées (format golang-migrate, `NNNNNN_description.up.sql` / `.down.sql`).

<Aside type="note" title="Politiques RLS">
La migration `000001` définit les politiques RLS initiales (`tenant_isolation_policy`) avec la clause `USING` pour l'accès en lecture. La migration `000004` ajoute des clauses `WITH CHECK` à toutes les politiques, qui valident également l'accès en écriture (INSERT/UPDATE) — un code d'application défectueux ne peut pas écrire de lignes dans l'espace mandant d'un autre mandant.
</Aside>

Autres migrations importantes :

- `000005` — table `quorum_snapshots`
- `000012` — table `agenda_item_attachments`
- `000014`/`000015` — `portal_enabled`/`meeting_enabled` sur Tenant
- `000016` — Documents du portail
- `000017` — Posts du forum
- `000018` — Tickets
- `000019`/`000020` — Notifications + RLS
- `000027` — Factures
- `000028` — Messages
- `000031` — Developments (ensembles immobiliers)
- `000038` — Attachments d'assemblée
- `000043` — Slugs d'assemblée par mandant

Les tables d'audit et de signature ont des triggers au niveau DB qui bloquent `UPDATE`, `DELETE` et `TRUNCATE` (migration `000001`). Un event-trigger (`audit_entries_ddl_guard`) bloque le DDL sur `audit_entries`, sauf en mode maintenance (`app.maintenance=on`).

<LinkCard title="Architecture" description="Couches, flux de requêtes et stack technologique" href="/reference/architektur/" />
