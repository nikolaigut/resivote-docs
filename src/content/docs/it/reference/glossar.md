---
title: Glossario
description: Termini importanti relativi a ResiVote e alle assemblee dei proprietari svizzere.
---

import { LinkCard } from '@astrojs/starlight/components';

## Maggioranza assoluta (ABSOLUTE_MAJORITY)

Un tipo di quorum in cui è richiesto SÌ > 50% di tutti i proprietari registrati (indipendentemente dalla presenza). Astensioni e assenze contano come NO implicito. Si veda [Funzioni — Quorum](../reference/funktionen/#quorum).

## Audit-Log

Un registro immutabile e concatenato di tutte le azioni rilevanti per la sicurezza. Ogni voce viene hashata con HMAC-SHA-256 (`AUDIT_HASH_KEY`) e concatenata con la voce precedente (catena di hash). In caso di rilevamento di manipolazione il server rifiuta il servizio (Fail-Closed). Si veda [Funzioni — Audit-Log](../reference/funktionen/#audit-log).

## Check-in

Il processo con cui i proprietari registrano la propria presenza a un'assemblea. Tre metodi: `MANUAL` (il presidente marca manualmente), `QR_CODE` (self-check-in tramite token QR), `SIGNATURE` (firma digitale su tablet). Si veda [Funzioni — Check-in](../reference/funktionen/#check-in).

## DEK (Data Encryption Key)

Una chiave AES specifica per mandante che cifra i documenti at rest. I DEK vengono avvolti con il `DOCUMENT_ENCRYPTION_MASTER_KEY` (chiave master) e salvati nel database. Si veda `internal/infrastructure/encryption/tenant_key.go`.

## Maggioranza semplice (SIMPLE_MAJORITY)

Un tipo di quorum in cui è richiesto SÌ > 50% dei voti per testa presenti/rappresentati. Astensioni e voti non espressi contano come NO implicito.

## Head-and-Value (HEAD_AND_VALUE)

Un modello di diritto di voto che considera sia i voti per testa sia le quote di valore. Standard per le community STWEG. Si veda [Funzioni — Votazioni](../reference/funktionen/#abstimmungen-und-beschlüsse).

## IsSuperseded

Un flag sui record di voto (`IsSuperseded`). I voti sono immutabili — in caso di modifica il vecchio voto viene marcato come `IsSuperseded=true` e viene creato un nuovo record di voto. `IsActive()` restituisce `!IsSuperseded`. Si veda `internal/domain/entity/vote.go`.

## Kopfstimme (voto per testa)

Il principio di votazione «un'unità abitativa, un voto». Corrisponde al modello di diritto di voto `HEAD_ONLY` o alla componente voti per testa in `HEAD_AND_VALUE`.

## Live-Quorum

Il calcolo in tempo reale del quorum durante un'assemblea. Il `LiveQuorumEngine` calcola la presenza (presenti + rappresentati tramite procura) e pubblica gli aggiornamenti del quorum via WebSocket. Si veda [Funzioni — Quorum](../reference/funktionen/#quorum).

## Master Key

Il `DOCUMENT_ENCRYPTION_MASTER_KEY` — una chiave AES di 32 byte codificata in base64 che avvolge e spacca i DEK specifici per mandante. Si veda [DEK](#dek-data-encryption-key).

## MEG (Miteigentümergemeinschaft / comunità dei comproprietari)

Una comunità di comproprietari (`CommunityType = "MEG"`). Le community MEG possono ereditare i proprietari dagli STWEG collegati (`InheritsOwners`) e utilizzano chiavi di ripartizione personalizzate (`CUSTOM_SHARES`).

## MEA (Miteigentumsanteil / quota di comproprietà)

Una quota di comproprietà di un immobile. La quota di valore (in millesimi) determina il peso del voto nelle votazioni dipendenti dalla quota di valore.

## Miteigentumsanteil

Si veda [MEA](#mea-miteigentumsanteil).

## Präsenz (presenza)

La somma dei proprietari presenti e dei proprietari rappresentati tramite procura. Il `PresenceBuilder` calcola la presenza come base per il quorum in diretta.

## Pre-Voting

Una fase di votazione anticipata asincrona (`AgendaItemState = "PRE_VOTING"`). I proprietari possono votare in anticipo; i voti ricevono il flag `IsPreVote`. Il Pre-Voting può essere avviato (`start-pre-voting`) e interrotto (`cancel-pre-voting`).

## Maggioranza qualificata (QUALIFIED_MAJORITY)

Un tipo di quorum in cui è richiesto SÌ > 50% dei proprietari presenti/rappresentati (teste) E > 50% di tutte le quote di valore legittimate (Art. 647b/d/e, Art. 712g cpv. 3 ZGB).

## Quorum

Il numero minimo richiesto di partecipanti con diritto di voto oppure la maggioranza richiesta affinché un'assemblea possa deliberare validamente o una risoluzione possa essere adottata. ResiVote supporta cinque tipi di quorum: `SIMPLE_MAJORITY`, `QUALIFIED_MAJORITY`, `UNANIMOUS`, `ABSOLUTE_MAJORITY`, `CUSTOM`. Si veda [Funzioni — Quorum](../reference/funktionen/#quorum).

## Quorum Override

La possibilità del presidente di revocare il quorum per uno specifico punto all'ordine del giorno (`QuorumOverride = true`). Richiede una motivazione obbligatoria (`QuorumOverrideReason`). I voti vengono accettati anche se `QuorumMetAtOpen` è false.

## RLS (Row Level Security)

PostgreSQL Row Level Security. La `DBTransactionMiddleware` imposta `SET LOCAL app.current_tenant_id` per ogni request, in modo che il database impedisca accessi tra mandanti a livello di riga (Defense-in-Depth). La migrazione `000004` aggiunge clausole `WITH CHECK` a tutte le policy RLS.

## STWEG (Stockwerkeigentümergemeinschaft / comunità dei proprietari per piani)

Una comunità di proprietari per piani (`CommunityType = "STWEG"`). Modello di diritto di voto standard: `HEAD_AND_VALUE`.

## Limitazione del diritto di voto (VotingRightsCap)

Una configurazione regolamentare (`EnableVotingRightsCap`, `VotingRightsCapPct`) che limita il peso massimo del voto di un singolo proprietario (cfr. Art. 712g ZGB). Non è un obbligo legale; deve essere attivata esplicitamente.

## Tenant (mandante)

Un contesto cliente isolato. Ogni mandante ha le proprie community, proprietari, assemblee e dati. L'isolamento viene imposto tramite RLS a livello di database.

## TOP

Un **punto all'ordine del giorno** o punto della agenda (`AgendaItem`). Ogni TOP viene discusso e, se necessario, votato. Un TOP ha un tipo (`MOTION`, `ELECTION`, `FREE_TEXT`, `PROTOCOL`) e uno stato (`PENDING`, `PRESENTING`, `PRE_VOTING`, `OPEN`, `CLOSED`, `SKIPPED`).

## Traktandum

Si veda [TOP](#top).

## Überbauung (Development / complesso immobiliare)

Un raggruppamento di più community (STWEG/MEG) sotto un nome di sviluppo comune (entità `Development`). L'albero di sviluppo (`/developments/tree`) mostra la gerarchia.

## Unanimous (unanimità)

Un tipo di quorum in cui il 100% di tutti i proprietari registrati (teste) e quote di valore devono votare SÌ (Art. 647e ZGB). Le assenze senza procura positiva contano come NO implicito.

## Versammlung (assemblea)

Un'assemblea dei proprietari (`Meeting`), in cui i partecipanti si riuniscono fisicamente, digitalmente o in modo ibrido per adottare risoluzioni. Modalità: `LIVE_MEETING` o `CIRCULAR_RESOLUTION`. Si veda [Funzioni — Assemblee digitali](../reference/funktionen/#digitale-versammlungen).

## Vollmacht (procura)

Il trasferimento del diritto di voto da un proprietario (Grantor) a un mandatario (Grantee) per un'assemblea e un'unità specifiche. Ambiti: `FULL` (intera assemblea) o `RESTRICTED` (punti all'ordine del giorno specifici). Con `RESTRICTED`, `ProxyInstruction` può prescrivere un'espressione di voto obbligatoria. Si veda [Funzioni — Procure](../reference/funktionen/#vollmachten).

## WebSocket

Un protocollo di comunicazione bidirezionale per aggiornamenti in diretta. ResiVote utilizza WebSocket sotto `/ws/meetings/:meetingId` per lo stato dell'assemblea in diretta, l'avanzamento delle votazioni e gli aggiornamenti del quorum. Ciclo ping/pong: 54s/60s. Si veda [REST API — WebSocket](../reference/api/#websocket-wsmeetingsmeetingid).

## Wertquote (MEA / quota di valore)

Le **quote di comproprietà** in millesimi che determinano il peso del voto nelle votazioni dipendenti dalla quota di valore. Corrisponde al modello di diritto di voto `VALUE_ONLY` o alla componente quote di valore in `HEAD_AND_VALUE`.

## ZITADEL

Il provider di identità OIDC per ResiVote. ZITADEL si occupa dell'autenticazione, della gestione di utenti e ruoli. ResiVote valida i JWT access-token contro le JWKS di ZITADEL. Si veda [Configurazione — Auth](../reference/konfiguration/#auth-zitadel).

## Zirkularbeschluss (CIRCULAR_RESOLUTION / risoluzione circolare)

Una modalità di assemblea per l'adozione di risoluzioni asincrona senza assemblea fisica (Art. 712m cpv. 2 ZGB). Definita da `circular_voting_start` e `circular_voting_end`. Si veda [Funzioni — Assemblee digitali](../reference/funktionen/#digitale-versammlungen).

<LinkCard title="Funzioni" href="../reference/funktionen/" description="Descrizioni dettagliate delle funzioni." />
<LinkCard title="REST API" href="../reference/api/" description="Endpoint API e middleware." />
