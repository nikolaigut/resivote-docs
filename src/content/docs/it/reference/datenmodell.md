---
title: Modello dati
description: Documentazione di riferimento delle entità, relazioni e migrazioni del database di ResiVote.
---

import { Aside, LinkCard } from '@astrojs/starlight/components';

ResiVote gestisce 31 entità in `internal/domain/entity/`. Tutte le entità tenant-scoped portano un campo `TenantID` (UUID), che utilizza PostgreSQL Row-Level Security (RLS) per l'isolamento. Le migrazioni si trovano nella directory `migrations/` e vengono applicate con `golang-migrate`.

## Entità principali

### Tenant

Organizzazione di amministrazione immobiliare isolata. Ogni mandante gestisce le proprie community, owner e meeting.

| Campo | Tipo | Descrizione |
|---|---|---|
| `ID` | UUID | Chiave primaria |
| `Name` | string | Nome visualizzato |
| `Slug` | string (max 12) | Slug univoco, p. es. `mueller-hv` |
| `IsActive` | bool | Stato attivo |
| `PortalEnabled` | bool | Portale clienti attivato |
| `MeetingEnabled` | bool | Funzione digital-meeting attivata |
| `EncryptedDEK` | *string | Data Encryption Key cifrato Base64 (AES-GCM) |
| `DEKKeyVersion` | int | Versione della chiave |
| `InvoiceSenderName/Street/City/VatNumber/QrIban` | string | Override del mittente della fattura |

### Community

Rappresenta uno STWEG (comunità dei proprietari per piani) o un MEG (comunità dei comproprietari).

| Campo | Tipo | Descrizione |
|---|---|---|
| `ID` | UUID | Chiave primaria |
| `TenantID` | UUID | Assegnazione al mandante (FK) |
| `Name` | string | Nome della comunità |
| `Type` | CommunityType | `STWEG` o `MEG` |
| `VotingRightsModel` | VotingRightsModel | `HEAD_AND_VALUE`, `HEAD_ONLY`, `VALUE_ONLY`, `CUSTOM_SHARES` |
| `TotalValueQuota` | int | Somma di tutte le quote di valore (p. es. 1000 per millesimi) |
| `EnableVotingRightsCap` | bool | Limitazione del diritto di voto attivata (Art. 712g ZGB) |
| `VotingRightsCapPct` | float64 | Massima quota di diritto di voto in percentuale |
| `ReglementHeadQuorumPct` | *float64 | Override regolamentare quorum teste |
| `ReglementValueQuorumPct` | *float64 | Override regolamentare quorum valore |
| `ReglementMinOwners` | *int | Override regolamentare numero minimo di owner |
| `InheritsOwners` | bool | Il MEG eredita gli owner dagli STWEG collegati |
| `DevelopmentID` | *uuid.UUID | Raggruppamento opzionale sotto un complesso immobiliare |

### Development (complesso immobiliare)

Raggruppa una o più community (STWEG e/o MEG).

| Campo | Tipo | Descrizione |
|---|---|---|
| `ID` | UUID | Chiave primaria |
| `TenantID` | UUID | Assegnazione al mandante |
| `Name` | string | Nome del complesso immobiliare |
| `Address` | string | Indirizzo |

### CommunityLink

Tabella di join M:N tra STWEG e MEG.

| Campo | Tipo | Descrizione |
|---|---|---|
| `STWEGID` | UUID | FK su Community (STWEG) |
| `MEGID` | UUID | FK su Community (MEG) |
| `TenantID` | UUID | Assegnazione al mandante |

### Unit

Singola unità immobiliare (unità/oggetto) all'interno di una community.

| Campo | Tipo | Descrizione |
|---|---|---|
| `ID` | UUID | Chiave primaria |
| `CommunityID` | UUID | FK su Community |
| `Designation` | string | Designazione, p. es. "Appartamento 3° piano sinistra" |
| `UnitNumber` | string | Numero dell'unità, p. es. "301" |
| `ValueQuota` | int | Quota di valore in millesimi (STWEG) |
| `CustomShares` | int | Custom Shares (MEG) |
| `HeadVoteCount` | int | Solo visualizzazione; il motore del quorum utilizza sempre 1 (Art. 712o ZGB) |
| `ValidFrom` | time.Time | Valido dal |
| `ValidUntil` | *time.Time | Valido fino al (opzionale) |
| `LandRegistryNumber` | string | Numero di registro fondiario |
| `LandRegistryOffice` | string | Ufficio/circolo del registro fondiario |

### Owner

Proprietario all'interno di un mandante. Un Owner può possedere unità in più community, ma solo all'interno dello stesso mandante.

| Campo | Tipo | Descrizione |
|---|---|---|
| `ID` | UUID | Chiave primaria |
| `TenantID` | UUID | Assegnazione al mandante |
| `ExternalUserID` | string | Identità utente globale (ZITADEL sub) |
| `UserID` | *uuid.UUID | FK opzionale sulla tabella `users` |
| `FirstName` / `LastName` | string | Nome |
| `Email` | string | E-mail |
| `IsArchived` | bool | Archiviato |
| `ArchivedAt` | *time.Time | Momento dell'archiviazione |

### Ownership

Relazione M:N tra Owner e Unit. Supporta la comproprietà con frazioni.

| Campo | Tipo | Descrizione |
|---|---|---|
| `UnitID` | UUID | FK su Unit |
| `OwnerID` | UUID | FK su Owner |
| `ShareNumerator` | int | Numeratore, p. es. 1 |
| `ShareDenominator` | int | Denominatore, p. es. 2 → 50% |
| `IsPrimaryVoter` | bool | Votante principale in caso di comproprietà |
| `ValidFrom` | time.Time | Valido dal |
| `ValidUntil` | *time.Time | Valido fino al |

## Meeting e votazione

### Meeting

Assemblea che può comprendere più community.

| Campo | Tipo | Descrizione |
|---|---|---|
| `ID` | UUID | Chiave primaria |
| `TenantID` | UUID | Assegnazione al mandante |
| `Slug` | string (max 12) | Slug univoco per mandante |
| `Title` | string | Titolo |
| `State` | MeetingState | `DRAFT`, `PUBLISHED`, `CHECK_IN`, `IN_PROGRESS`, `CLOSED`, `ARCHIVED` |
| `Mode` | MeetingMode | `LIVE_MEETING` o `CIRCULAR_RESOLUTION` (Art. 712m cpv. 2 ZGB) |
| `ScheduledAt` | time.Time | Data pianificata |
| `CheckinMethod` | *CheckinMethod | `MANUAL`, `QR_CODE`, `SIGNATURE` |
| `ProtocolWriterType` | *ProtocolWriterType | `OWNER` o `TENANT_ADMIN` |
| `LiveResultsVisibleTo` | *LiveResultsVisibility | `ALL` o `CHAIR` |
| `RequireVoteConfirmation` | bool | Obbligo di conferma per i voti |

**Relazione M:N:** `MeetingCommunity` (tabella di join `meeting_communities`) collega i meeting con più community.

### AgendaItem

Punto all'ordine del giorno all'interno di un meeting.

| Campo | Tipo | Descrizione |
|---|---|---|
| `MeetingID` | UUID | FK su Meeting |
| `CommunityID` | *uuid.UUID | NULL = tutte le community del meeting |
| `OrderNumber` | int | Ordine |
| `Type` | AgendaItemType | `MOTION`, `ELECTION`, `FREE_TEXT`, `PROTOCOL` |
| `State` | AgendaItemState | `PENDING`, `PRESENTING`, `PRE_VOTING`, `OPEN`, `CLOSED`, `SKIPPED` |
| `QuorumType` | QuorumType | `SIMPLE_MAJORITY`, `QUALIFIED_MAJORITY`, `UNANIMOUS`, `ABSOLUTE_MAJORITY`, `CUSTOM` |
| `CustomQuorumPct` | *float64 | Percentuale quorum custom |
| `Candidates` | pq.StringArray | Candidati per ELECTION |
| `QuorumOverride` | bool | Il presidente può revocare il blocco del quorum |
| `QuorumOverrideReason` | string | Motivazione (obbligatoria in caso di override) |
| `TimerStartedAt` | *time.Time | Avvio del timer di presentazione |
| `TimerDurationSeconds` | int | Durata del timer |

### Vote

Singolo voto per unità per punto all'ordine del giorno. **Immutabile** — in caso di modifica il vecchio voto viene marcato come `IsSuperseded=true` e viene creato un nuovo voto.

| Campo | Tipo | Descrizione |
|---|---|---|
| `AgendaItemID` | UUID | FK su AgendaItem |
| `UnitID` | UUID | FK su Unit |
| `VoterID` | UUID | Owner che ha votato |
| `ProxyID` | *uuid.UUID | In caso di espressione di voto tramite procura |
| `Choice` | VoteChoice | `YES`, `NO`, `ABSTAIN`, `CANDIDATE`, `FREE_TEXT` |
| `CandidateName` | *string | Per ELECTION |
| `FreeTextValue` | *string | Per FREE_TEXT |
| `HeadVoteValue` | int | Standard 1 (Art. 712o ZGB) |
| `ValueQuota` | int | Snapshot della quota di valore dell'unità al momento della votazione |
| `CustomShares` | int | Snapshot delle Custom Shares |
| `IsPreVote` | bool | Voto dalla fase PRE_VOTING |
| `IsSuperseded` | bool | Sostituito da un voto più recente |

### QuorumSnapshot

Congela lo stato di presenza/quorum all'apertura di un punto all'ordine del giorno. Sopravvive ai riavvii del server.

| Campo | Tipo | Descrizione |
|---|---|---|
| `AgendaItemID` | UUID | Univoco per punto all'ordine del giorno |
| `SnapshotJSON` | json.RawMessage | Snapshot completo del quorum come JSONB |
| `QuorumMetAtOpen` | bool | Il quorum era soddisfatto all'apertura |

## Procura e presenza

### Proxy

Procura di un Owner a un altro per un meeting e un'unità.

| Campo | Tipo | Descrizione |
|---|---|---|
| `MeetingID` | UUID | FK su Meeting |
| `GrantorID` | UUID | Owner che concede la procura |
| `GranteeID` | UUID | Owner che riceve la procura |
| `UnitID` | UUID | Unità interessata |
| `Scope` | ProxyScope | `FULL` (intero meeting) o `RESTRICTED` (TOP specifici) |
| `RevokedAt` | *time.Time | Momento della revoca |

### ProxyInstruction

Istruzione di espressione di voto obbligatoria per una procura.

| Campo | Tipo | Descrizione |
|---|---|---|
| `ProxyID` | UUID | FK su Proxy |
| `AgendaItemID` | UUID | FK su AgendaItem |
| `MandatedVote` | VoteChoice | Espressione di voto prescritta |

### Attendance

Check-in di un Owner per un meeting.

| Campo | Tipo | Descrizione |
|---|---|---|
| `MeetingID` | UUID | FK su Meeting |
| `OwnerID` | UUID | FK su Owner |
| `UnitID` | UUID | FK su Unit |
| `Method` | AttendanceMethod | `CHECKIN`, `SELF_CHECKIN`, `SIGNATURE`, `VOTE` |
| `CheckedInAt` | time.Time | Momento del check-in |

### Presence e Signature

`PresenceRecord` e `CommunityPresence` sono DTO calcolati (nessuna tabella DB), che il `PresenceBuilder` aggrega dai dati di Attendance, Ownership e Proxy.

`Signature` salva una firma digitale dal flusso di check-in su tablet in una tabella separata. `SignatureUnit` collega la firma a tutte le unità coperte (proprie + unità con procura). Entrambe le tabelle sono immutable a livello DB (i trigger bloccano UPDATE/DELETE/TRUNCATE).

## Gestione dei documenti

### Document

File nel portale clienti. L'accesso viene controllato tramite la cartella associata.

| Campo | Tipo | Descrizione |
|---|---|---|
| `CommunityID` | *uuid.UUID | NULL = a livello di mandante |
| `FolderID` | UUID | FK su Folder |
| `Category` | string | `PROTOCOL`, `INVITATION`, `ANNUAL_ACCOUNT`, `REGULATION`, `NOTICE`, `FORM`, `OTHER` |
| `StorageKey` | string | Chiave del blob-storage (non serializzata) |
| `FileName` | string | Nome file originale |
| `MimeType` | string | Tipo MIME |
| `SizeBytes` | int64 | Dimensione del file |

### Folder

Struttura gerarchica di cartelle all'interno di una community o di un mandante.

| Campo | Tipo | Descrizione |
|---|---|---|
| `CommunityID` | uuid.NullUUID | NULL = a livello di mandante |
| `ParentFolderID` | uuid.NullUUID | NULL = cartella root |
| `OwnerID` | uuid.NullUUID | NULL = pubblico; impostato = cartella personale |
| `Visibility` | string | `PUBLIC` o `RESTRICTED` |
| `Path` | string | Percorso materializzato |

## Audit e utenti

### AuditEntry

Voci di audit-log immutabili con catena di hash. Ogni voce contiene `PreviousHash` e `Hash` (HMAC-SHA-256 in produzione). Tre versioni di hash: v1 (SHA-256 semplice, deprecato), v2 (tutti i campi + HMAC opzionale), v3 (v2 + `ImpersonatedByID`).

| Campo | Tipo | Descrizione |
|---|---|---|
| `EntityType` | string | p. es. "vote", "meeting" |
| `EntityID` | UUID | Entità interessata |
| `Action` | string | p. es. "CREATED", "STATE_CHANGED", "VOTE_CAST" |
| `ActorID` | UUID | Utente esecutore |
| `ImpersonatedByID` | *uuid.UUID | Super-Admin in caso di impersonazione |
| `OldValue` / `NewValue` | *string | JSON-diff |
| `PreviousHash` | string | Hash della voce precedente |
| `Hash` | string | Hash proprio |
| `HashVersion` | int | 1, 2 o 3 |

### User

Identità di piattaforma autenticata (ZITADEL sub). Disaccoppiata dai record Owner.

| Campo | Tipo | Descrizione |
|---|---|---|
| `TenantID` | *uuid.UUID | Nullable per `super_admin` (globale) |
| `ExternalUserID` | string | ZITADEL sub |
| `Email` | string | E-mail |
| `Role` | string | `tenant_admin`, `super_admin`, `meeting_chair`, `owner` |

### UserTenantRole

Fonte di verità per le assegnazioni dei mandanti. Un User può avere più voci — una per mandante. `super_admin` non viene salvato qui (claim JWT globale).

| Campo | Tipo | Descrizione |
|---|---|---|
| `UserID` | UUID | FK su User |
| `TenantID` | UUID | FK su Tenant |
| `Role` | string | `tenant_admin`, `meeting_chair`, `owner` |

### UserInvitation

Invito in sospeso per un utente nuovo o esistente.

| Campo | Tipo | Descrizione |
|---|---|---|
| `TenantID` | UUID | FK su Tenant |
| `Email` | string | E-mail dell'invitato |
| `Code` | string | Codice di invito |
| `Role` | string | Ruolo assegnato |
| `ExpiresAt` | time.Time | Scadenza |

## Comunicazione e portale

### Message e MessageCommunity

Comunicazione broadcast dell'amministrazione alle community. `MessageCommunity` è la tabella di join M:N.

| Campo | Tipo | Descrizione |
|---|---|---|
| `AuthorID` | UUID | FK su User |
| `Subject` / `Body` | string | Oggetto e contenuto |
| `Priority` | MessagePriority | `normal`, `important`, `pinned` |
| `ChannelInApp` / `ChannelEmail` / `ChannelPush` | bool | Canali di invio |

### Notification e PushSubscription

Notifiche in-app e push per gli utenti del portale.

| Campo | Tipo | Descrizione |
|---|---|---|
| `UserID` | UUID | FK su User |
| `Type` | NotificationType | `DOCUMENT`, `FORUM`, `TICKET`, `ANNOUNCEMENT` |
| `IsRead` | bool | Stato di lettura |

`PushSubscription` salva gli endpoint push del browser (VAPID).

### Forum (ForumPost)

Forum pubblico della comunità. I post di primo livello hanno `ParentID == nil`; le risposte referenziano il proprio parent.

| Campo | Tipo | Descrizione |
|---|---|---|
| `CommunityID` | UUID | FK su Community |
| `ParentID` | *uuid.UUID | NULL = di primo livello |
| `AuthorType` | ForumAuthorType | `OWNER` o `ADMIN` |
| `IsPinned` | bool | Fissato in alto |

### Ticket e TicketMessage

Ticket di supporto privato tra Owner e amministrazione.

| Campo | Tipo | Descrizione |
|---|---|---|
| `CommunityID` | UUID | FK su Community |
| `OwnerID` | UUID | FK su Owner |
| `Category` | TicketCategory | `GENERAL`, `REQUEST`, `DEFECT`, `TENANT_CHANGE`, `COMPLAINT`, `ACCESS`, `OTHER` |
| `Status` | TicketStatus | `OPEN`, `RESOLVED`, `CLOSED` |

`TicketMessage` salva le risposte. `TicketAttachment` salva i file allegati.

## Ripartizione dei costi e fatturazione

### CostDistributionKey e CostDistributionUnitShare

Definisce un tipo di costo per un MEG e la sua ripartizione sulle unità.

| Campo | Tipo | Descrizione |
|---|---|---|
| `CommunityID` | UUID | FK su Community |
| `Name` | string | p. es. "Impianti generali" |
| `Type` | CostDistributionType | `EQUAL_PER_UNIT`, `VALUE_QUOTA`, `CUSTOM_SHARES`, `SELF_BORNE`, `BY_RESOLUTION` |

`CostDistributionUnitShare` definisce quote esplicite per unità (solo `CUSTOM_SHARES` e `SELF_BORNE`).

### CostStatement e CostStatementPosition

Conteggio concreto: un importo totale applicato a un CostDistributionKey. Al momento della creazione vengono calcolati e persistiti automaticamente entry `CostStatementPosition` per unità. Le posizioni sono immutable dopo la creazione.

### Invoice e InvoiceLineItem

Fattura di abbonamento SaaS per un mandante. Contiene una `InvoiceLineItem` per community nel periodo di fatturazione.

| Campo | Tipo | Descrizione |
|---|---|---|
| `PeriodStart` / `PeriodEnd` | time.Time | Periodo di fatturazione |
| `TotalAmountCents` | int64 | Importo totale in centesimi |
| `Status` | InvoiceStatus | `DRAFT`, `PENDING`, `PAID`, `VOID` |
| `Source` | InvoiceSource | `AUTO` o `MANUAL` |

### ScheduledEmail

E-mail transazionale programmata per un meeting. Un worker in background elabora le voci in scadenza.

| Campo | Tipo | Descrizione |
|---|---|---|
| `MeetingID` | UUID | FK su Meeting |
| `Type` | ScheduledEmailType | `INVITATION`, `REMINDER`, `CLOSED` |
| `DeliveryStatus` | ScheduledEmailDeliveryStatus | `pending`, `sent`, `failed`, `dead_letter` |
| `RetryCount` | int | Numero di tentativi |
| `NextRetryAt` | *time.Time | Prossimo momento di retry |

## Allegati e presentazione

### AgendaItemAttachment e AgendaItemSlide

Allegato di file o slide-deck per un punto all'ordine del giorno. `Kind`: `DOCUMENT`, `PRESENTATION`, `SLIDES`. `AgendaItemSlide` salva singole slide come contenuto JSONB.

### MeetingAttachment

File associato a un meeting nel suo complesso (non a uno specifico punto all'ordine del giorno).

## Migrazioni e RLS

La directory `migrations/` contiene 43 migrazioni SQL versionate (formato golang-migrate, `NNNNNN_description.up.sql` / `.down.sql`).

<Aside type="note" title="Policy RLS">
La migrazione `000001` definisce le policy RLS iniziali (`tenant_isolation_policy`) con clausola `USING` per l'accesso in lettura. La migrazione `000004` integra tutte le policy con clausole `WITH CHECK`, che validano anche l'accesso in scrittura (INSERT/UPDATE) — un codice di applicazione errato non può scrivere righe nello spazio mandante di un altro mandante.
</Aside>

Altre migrazioni importanti:

- `000005` — tabella `quorum_snapshots`
- `000012` — tabella `agenda_item_attachments`
- `000014`/`000015` — `portal_enabled`/`meeting_enabled` sul tenant
- `000016` — documenti del portale
- `000017` — forum-posts
- `000018` — ticket
- `000019`/`000020` — notification + RLS
- `000027` — invoice
- `000028` — message
- `000031` — development (complessi immobiliari)
- `000038` — meeting-attachments
- `000043` — slug meeting per mandante

Le tabelle di audit e signature hanno trigger a livello DB che bloccano `UPDATE`, `DELETE` e `TRUNCATE` (migrazione `000001`). Un event-trigger (`audit_entries_ddl_guard`) blocca DDL su `audit_entries`, eccetto in modalità manutenzione (`app.maintenance=on`).

<LinkCard title="Architettura" description="Strati, flusso delle richieste e stack tecnologico" href="/reference/architektur/" />
