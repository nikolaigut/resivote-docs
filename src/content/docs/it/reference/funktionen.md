---
title: Funzioni
description: Panoramica delle funzioni più importanti di ResiVote – digitale, trasparente e conforme al diritto.
---

import { CardGrid, Card, LinkCard } from '@astrojs/starlight/components';

ResiVote offre tutti gli strumenti per svolgere assemblee dei proprietari in modo digitale, trasparente e conforme al diritto. Ogni funzione è implementata nella base di codice e proteggibile tramite audit-log.

## Assemblee digitali

ResiVote supporta due modalità di assemblea (`MeetingMode` in `internal/domain/entity/meeting.go`):

- **`LIVE_MEETING`** — assemblea in diretta (fisica, digitale o ibrida). I proprietari partecipano in diretta tramite browser web e votano in tempo reale.
- **`CIRCULAR_RESOLUTION`** — risoluzione circolare (Art. 712m cpv. 2 ZGB). Votazione asincrona con data di inizio e fine definitite (`circular_voting_start`, `circular_voting_end`).

Un'assemblea può comprendere più community (STWEG/MEG) (tabella di join `meeting_communities`). Il ciclo di vita dell'assemblea attraversa gli stati `DRAFT` → `PUBLISHED` → `CHECK_IN` → `IN_PROGRESS` → `CLOSED` → `ARCHIVED`.

## Votazioni e risoluzioni

Ogni punto all'ordine del giorno (`AgendaItem`) definisce un tipo di votazione:

- **`MOTION`** — Sì/No/Astensione
- **`ELECTION`** — elezione dei candidati (lista `candidates`, scelta `CANDIDATE`)
- **`FREE_TEXT`** — proposta a testo libero (scelta `FREE_TEXT`)
- **`PROTOCOL`** — definizione della redazione del verbale (senza votazione)

Il peso del voto si basa sul modello di diritto di voto della community (`VotingRightsModel`):

- **`HEAD_AND_VALUE`** — voto per testa e quota di valore (standard STWEG)
- **`HEAD_ONLY`** — un'unità, un voto
- **`VALUE_ONLY`** — solo quota di valore (MEA/millesimi)
- **`CUSTOM_SHARES`** — quote personalizzate per unità (specifico per MEG)

Funzioni di votazione aggiuntive:

- **Voti analogici collettivi** — il presidente/amministratore registra i voti per i proprietari presenti che non votano digitalmente (`CastAnalogVote`, `CastBulkAnalogVotes`)
- **Pre-Voting** — votazione anticipata asincrona (stato `PRE_VOTING`, flag `IsPreVote` sui voti)
- **Visibilità dei risultati in diretta** — configurabile per assemblea: `ALL` (tutti i partecipanti) o `CHAIR` (solo presidente/amministratore)
- **Conferma del voto** — `RequireVoteConfirmation` impone una conferma del voto
- **Override del quorum** — il presidente può revocare il quorum per un punto all'ordine del giorno (`QuorumOverride` con `QuorumOverrideReason` obbligatoria)
- **Immutabilità dei voti** — i voti modificati vengono marcati come `IsSuperseded=true`; viene creato un nuovo record di voto

## Procure

I proprietari trasferiscono digitalmente il proprio diritto di voto a un mandatario (`Proxy` in `internal/domain/entity/proxy.go`):

- **`FULL`** — procura per l'intera assemblea
- **`RESTRICTED`** — procura per punti all'ordine del giorno specifici

Con `RESTRICTED`, `ProxyInstruction` definisce un'espressione di voto obbligatoria (`mandated_vote`) per uno specifico punto all'ordine del giorno. Il mandatario deve votare secondo l'istruzione — una violazione genera `PROXY_INSTRUCTION_VIOLATION`.

Le procure sono definite per unità (`UnitID`) e per assemblea (`MeetingID`) e possono essere revocate (`RevokedAt`).

## Check-in

Tre metodi di check-in (`CheckinMethod`):

- **`MANUAL`** — il presidente/amministratore marca i partecipanti manualmente (sempre disponibile)
- **`QR_CODE`** — il proprietario scansiona un QR-Code con lo smartphone ed effettua un self-check-in (`SelfCheckIn`). Il token QR è un JWT firmato con claim `meeting_id`.
- **`SIGNATURE`** — il proprietario si seleziona sul tablet dell'amministratore e firma digitalmente; tutte le proprie unità (e le unità con procura) vengono marcate come presenti

I token di check-in vengono firmati con `CHECKIN_TOKEN_SIGNING_KEY` (HMAC-SHA-256, >= 32 byte in produzione) e hanno una durata di validità configurabile (`CHECKIN_TOKEN_EXPIRY`, predefinito 30m).

## Verbali

- **Editor in diretta** — note del verbale per punto all'ordine del giorno (`DiscussionNotes`, `UpdateAgendaItemNotes`)
- **Proposte IA** — proposte di verbale generate dall'IA (`SuggestProtocolNotes`); provider: `mistral`, `ollama`, `llama`, `mock`, `disabled`
- **Redattore del verbale** — assegnabile per assemblea (`ProtocolWriterOwnerID`, `ProtocolWriterType`: `OWNER` o `TENANT_ADMIN`)
- **Report PDF** — verbale come PDF (`DownloadMeetingProtocolPDF`), invito come PDF (`DownloadInvitationPDF`), carta di procura come PDF (`DownloadProxyCardPDF`)
- **Pacchetto di prove** — PDF + JSON + verifica dell'integrità per assemblea (`EvidenceHandler`)

## Documenti

Il portale clienti (`portal_enabled`) offre la gestione dei documenti:

- **Cartelle** — struttura gerarchica di cartelle (`Folder`, visibilità `PUBLIC` o `RESTRICTED`)
- **Categorie** — `PROTOCOL`, `INVITATION`, `ANNUAL_ACCOUNT`, `REGULATION`, `NOTICE`, `FORM`, `OTHER`
- **Importazione del regolamento** — in due fasi: estrarre (`reglement-extract`) → confermare (`reglement-confirm`); utilizza il provider IA per l'estrazione LLM
- **Cifratura at Rest** — DEK specifici per mandante (Data Encryption Key) vengono avvolti con il `DOCUMENT_ENCRYPTION_MASTER_KEY` (`TenantKeyProvider`, `DocumentEncryption`)
- **Backend di storage** — filesystem locale (`./uploads`) o compatibile S3 (`STORAGE_TYPE=s3`)
- **Conversione PDF** — LibreOffice (`soffice`) per la conversione documento-in-PDF (`CONVERTER_ENABLED`)

## Quorum

Cinque tipi di quorum per punto all'ordine del giorno (`QuorumType` in `internal/domain/entity/agenda_item.go`):

- **`SIMPLE_MAJORITY`** — SÌ > 50% dei voti per testa presenti/rappresentati
- **`QUALIFIED_MAJORITY`** — SÌ > 50% dei proprietari presenti/rappresentati (teste) E > 50% di tutte le quote di valore legittimate (Art. 647b/d/e, Art. 712g cpv. 3 ZGB)
- **`UNANIMOUS`** — 100% di tutti i proprietari registrati e quote di valore devono votare SÌ (Art. 647e ZGB)
- **`ABSOLUTE_MAJORITY`** — SÌ > 50% di tutti i proprietari registrati (indipendentemente dalla presenza)
- **`CUSTOM`** — SÌ >= `custom_quorum_pct`% della base configurata (`PRESENT` o `ELIGIBLE`)

Il motore del quorum in diretta (`LiveQuorumEngine`, `LiveQuorumService`) calcola il quorum in tempo reale e pubblica gli aggiornamenti via WebSocket. Gli override del regolamento (`reglement_head_quorum_pct`, `reglement_value_quorum_pct`, `reglement_min_owners`) sovrascrivono i valori predefiniti del tipo di comunità (STWEG: 50/50/2, MEG: 50/50/1).

## Forum e ticket

- **Forum** — forum pubblico della comunità per proprietari e amministrazione (`ForumHandler`: creare argomenti, rispondere, cancellare)
- **Ticket** — richieste di supporto private tra proprietario e amministrazione (`TicketHandler`: creare, aggiungere messaggi, aggiornare lo stato, scaricare allegati)

Entrambe le funzioni sono disponibili nel portale clienti (`/api/v1/portal/...`) e richiedono `portal_enabled=true`.

## Messaggi

Il centro messaggi (`MessageHandler`, `MessageService`) permette broadcast alle comunità:

- Messaggi con anteprima dei destinatari (`PreviewRecipientCount`)
- Gestione dello stato di bozza e invio
- Posta in arrivo dei proprietari nel portale (`ListForOwner`, `MarkRead`, `Archive`)

## Notifiche

- **In-App** — lista notifiche, conteggio non lette, marcare come lette
- **E-Mail** — integrazione tramite API Resend
- **Web Push** — notifiche push del browser tramite VAPID (`WebPushSender`); gestire abbonamenti push (`SubscribePush`, `UnsubscribePush`)
- **Impostazioni** — impostazioni di notifica configurabili per proprietario

## Fatturazione

- **Billing-Worker** — crea mensilmente fatture per tutti i mandanti attivi (`BILLING_WORKER_INTERVAL`, predefinito 1h)
- **Fatture** — esporto PDF (`DownloadInvoicePDF`), override specifici del mandante per il mittente
- **Metriche SaaS** — panoramica billing super-admin (`/api/v1/admin/billing/tenants`)
- **Ripartizione dei costi** — chiavi di ripartizione e conteggi dei costi per MEG (`CostDistributionHandler`, esporto PDF/CSV)

## Audit-Log

- **Catena di hash immutabile** — ogni voce di audit viene concatenata con HMAC-SHA-256 (`AUDIT_HASH_KEY`)
- **Fail-Closed** — in caso di rilevamento di manipolazione il server rifiuta il servizio (`AUDIT_FAIL_CLOSED`, soglia `AUDIT_FAIL_CLOSED_THRESHOLD`)
- **Verifica all'avvio** — l'integrità della catena viene verificata all'avvio; in caso di rottura e Fail-Closed segue `os.Exit(1)`
- **Verifica periodica** — ogni `AUDIT_VERIFY_INTERVAL` (5m) la catena viene verificata
- **Imposizione dell'immutabilità** — trigger DB e ruolo non-superuser vengono verificati all'avvio
- **Esporto** — audit-log come PDF o JSON (`DownloadAuditPDF`, `DownloadAuditJSON`)
- **ZertES/nDSG** — la prova di integrità contro manipolazioni del database richiede una chiave HMAC >= 32 byte

## Multilingua

Il frontend supporta le lingue **DE**, **FR**, **IT** ed **EN** (`SUPPORTED_LANGUAGES` in `language.store.ts`, predefinito: `de`). La lingua viene risolta da `localStorage`, lingua del browser o predefinita. Le categorie dei documenti sono sincronizzate con chiavi i18n.

## Ricerca globale

L'endpoint `/api/v1/search` ricerca nell'ambito del mandante (per `tenant_admin`) o a livello di piattaforma (per `super_admin`) in tutte le risorse indicizzate (`SearchService`, `SearchHandler`).

## Modalità demo

La modalità demo opzionale (`DemoResetConfig` ruota giornalmente un mandante demo:

- Il worker viene eseguito alle 00:00 UTC + `DEMO_RESET_RESET_OFFSET`
- Hard-delete (`DEMO_RESET_HARD_DELETE`) o archiviazione del vecchio mandante demo
- Re-seeding con dati di esempio (mandante, comunità, proprietari, unità)
- Trigger manuale tramite `POST /internal/demo-reset` (protetto da API-Key) o `POST /api/v1/admin/system/demo-reset` (Super-Admin)
- Lo slug demo deve essere `demo` (`Config.Validate`)

<CardGrid>
<Card title="REST API" href="../reference/api/">Endpoint e middleware</Card>
<Card title="Configurazione" href="../reference/konfiguration/">Variabili d'ambiente</Card>
<Card title="Deployment" href="../reference/deployment/">Sviluppo e produzione</Card>
<Card title="Glossario" href="../reference/glossar/">Termini e abbreviazioni</Card>
</CardGrid>
