---
title: Come funziona ResiVote
description: Il flusso di un'assemblea dei proprietari digitale con ResiVote – dalla bozza al verbale archiviato.
---

import { Steps, Aside, CardGrid, Card, LinkCard } from '@astrojs/starlight/components';

ResiVote vi accompagna dalla bozza al verbale firmato – il tutto in uno spazio digitale. Un'assemblea attraversa una macchina a stati definita (`internal/domain/entity/meeting.go`):

`DRAFT` → `PUBLISHED` → `CHECK_IN` → `IN_PROGRESS` → `CLOSED` → `ARCHIVED`

Oltre all'assemblea in diretta, ResiVote supporta la risoluzione circolare (`CIRCULAR_RESOLUTION`, Art. 712m cpv. 2 ZGB) come alternativa.

## 1. Preparare l'assemblea

L'assemblea inizia nello stato `DRAFT`. L'amministratore definisce data, orario, luogo e titolo.

### Più comunità

Un'assemblea può comprendere diverse comunità (`Meeting.Communities` tramite la tabella di join `meeting_communities`). Le comunità possono essere raggruppate in un complesso immobiliare (`Development`) – uno STWEG più un MEG associato nella stessa assemblea.

### Punti all'ordine del giorno

Ogni punto all'ordine del giorno (`AgendaItem`) definisce:

- **Tipo** – `MOTION` (Sì/No/Astensione), `ELECTION` (elezione), `FREE_TEXT` (proposta a testo libero), `PROTOCOL` (definizione della redazione del verbale, senza votazione)
- **Quorum** – `SIMPLE_MAJORITY`, `QUALIFIED_MAJORITY`, `UNANIMOUS`, `ABSOLUTE_MAJORITY` o `CUSTOM` con percentuale personalizzata
- **Comunità** – `CommunityID` = `nil` significa «tutte le comunità dell'assemblea»

Per i dettagli sui tipi di quorum si veda `/guides/quorum/`.

## 2. Invitare i partecipanti

Il passaggio a `PUBLISHED` invia gli inviti.

### E-mail programmate

Gli inviti vengono persistiti come `ScheduledEmail` (`internal/domain/entity/scheduled_email.go`). Un worker in background recupera le righe in scadenza e le invia. Tipi: `INVITATION`, `REMINDER`, `CLOSED`. Stato: `pending` → `sent` (oppure `failed`/`dead_letter` con retry).

### PDF di invito e carta di procura

Il `ReportService` genera per ogni destinatario un PDF di invito (`GenerateInvitationPDF`) e una carta di procura personalizzata (`GenerateProxyCardPDF`). Entrambi vengono inviati come allegato.

### Login OIDC

L'autenticazione avviene tramite ZITADEL (OIDC). I proprietari accedono con il loro link personale. L'associazione dell'identità ZITADEL (`ExternalUserID`/`sub`) al record del proprietario avviene automaticamente al primo login (`LinkAllExternalUsersByEmail`).

## 3. Svolgere l'assemblea

L'amministratore apre l'assemblea (`CHECK_IN`), quindi la avvia (`IN_PROGRESS`).

### Metodi di check-in

L'assemblea configura un `CheckinMethod` (`internal/domain/entity/meeting.go`):

| Metodo | Svolgimento |
|---------|-------------|
| `MANUAL` | Il presidente/l'amministratore marca i partecipanti manualmente (predefinito) |
| `QR_CODE` | I proprietari scansionano un QR-Code con lo smartphone (self-check-in) |
| `SIGNATURE` | I proprietari si selezionano da un dropdown sul tablet dell'amministratore e firmano digitalmente; tutte le proprie unità e le unità con procura vengono marcate come presenti |

### Dashboard del presidente e verbale in diretta

Il presidente (`meeting_chair`) controlla l'assemblea tramite una dashboard: aprire/chiudere i punti all'ordine del giorno, avviare le votazioni, consultare i risultati in diretta. Il verbale in diretta viene redatto in parallelo – il redattore del verbale (`OWNER` o `TENANT_ADMIN`) annota le note per ogni punto all'ordine del giorno.

### Aggiornamenti live via WebSocket

La presenza, lo stato del quorum e i risultati delle votazioni vengono trasmessi in tempo reale a tutti i partecipanti via WebSocket. Il `presenceBuilder` (`internal/application/presence_builder.go`) è collegato all'hub WebSocket e trasmette immediatamente le modifiche di presenza.

## 4. Adottare le risoluzioni

Ogni punto all'ordine del giorno attraversa degli stati (`internal/domain/entity/agenda_item.go`):

`PENDING` → `PRESENTING` → `PRE_VOTING` (opzionale) → `OPEN` → `CLOSED` (oppure `SKIPPED`)

### Espressione del voto

Il `VoteValidator` (`internal/domain/service/vote_validator.go`) verifica prima di ogni espressione di voto:

1. L'assemblea è `IN_PROGRESS` (oppure `PRE_VOTING` in caso di votazione anticipata asincrona)
2. Il punto all'ordine del giorno è `OPEN` o `PRE_VOTING`
3. Il quorum era raggiunto all'apertura – oppure il presidente ha concesso un `QuorumOverride`
4. L'unità appartiene a una comunità dell'assemblea
5. Il punto all'ordine del giorno si applica alla comunità dell'unità
6. Il votante è il votante principale (`PrimaryOwnership`) o il mandatario (`Proxy.GranteeID`)
7. In caso di procura: il punto all'ordine del giorno è coperto? L'espressione del voto corrisponde all'istruzione?
8. Check-in richiesto (se `RequirePreCheckin`)

### Voti per testa e quote di valore

A seconda del `VotingRightsModel` della comunità, contano i voti per testa (`HEAD_AND_VALUE`, `HEAD_ONLY`), le quote di valore (`HEAD_AND_VALUE`, `VALUE_ONLY`) o le quote personalizzate (`CUSTOM_SHARES`). La limitazione del diritto di voto (`EnableVotingRightsCap`, Art. 712g ZGB) limita i voti per testa al superamento della percentuale regolamentare.

### Motore del quorum e risultati

Il `QuorumEngine` (`internal/domain/service/quorum_engine.go`) calcola per ogni comunità i voti per testa e le quote di valore, li confronta con la soglia e genera un `AgendaItemResult` con `OverallPassed`. Per i dettagli si veda `/guides/quorum/`.

### Visibilità dei risultati in diretta

`LiveResultsVisibleTo` controlla chi vede i risultati in diretta: `ALL` (tutti i partecipanti) o `CHAIR` (solo presidente/amministratore).

## 5. Concludere il verbale

Dopo l'ultimo punto all'ordine del giorno, l'assemblea passa a `CLOSED`, quindi a `ARCHIVED`.

### PDF del verbale

`GenerateMeetingProtocolPDF` genera il verbale vincolante con tutti i punti all'ordine del giorno, i risultati delle votazioni, le presenze e le limitazioni del diritto di voto. I punti all'ordine del giorno procedurali di tipo `PROTOCOL` vengono esclusi. Per i dettagli si veda `/guides/protokoll/`.

### Audit-Log e pacchetto di prove

Ogni azione è stata registrata durante l'assemblea nella catena di hash di audit (`AuditEntry`, SHA-256/HMAC). Il pacchetto di prove (`GenerateMeetingEvidencePDF`/`-JSON`) esporta l'intera catena con verifica dell'integrità. Per i dettagli si veda `/reference/sicherheit/`.

### Archiviazione

Dopo `ARCHIVED` non sono più possibili modifiche. La catena di hash di audit rende dimostrabile ogni manipolazione successiva.

<Aside type="note" title="Risoluzione circolare">
In modalità `CIRCULAR_RESOLUTION` non sono previsti check-in e sessione in diretta. I proprietari votano in modo asincrono entro una finestra temporale (`CircularVotingStart`/`CircularVotingEnd`). Il motore del quorum e il verbale funzionano in modo analogo.
</Aside>

## Link di approfondimento

<LinkCard title="Verbale e report" href="/guides/protokoll/" description="Verbale in diretta, proposte IA e report PDF." />
<LinkCard title="Quorum e presenza" href="/guides/quorum/" description="Capacità deliberativa e calcolo del quorum." />
<LinkCard title="Utenti e autorizzazioni" href="/guides/benutzer/" description="Ruoli, mandanti e controllo degli accessi." />
