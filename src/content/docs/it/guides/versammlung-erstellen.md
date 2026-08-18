---
title: Creare un'assemblea
description: Creare un'assemblea, definire i punti all'ordine del giorno e pubblicare – dalla bozza all'invito.
---

import { Steps, Aside, CardGrid, Card } from '@astrojs/starlight/components';

Questa guida è rivolta a `tenant_admin` e `meeting_chair`. Descrive come creare un'assemblea nello stato `DRAFT`, dotarla di punti all'ordine del giorno e infine pubblicarla.

## Ciclo di vita di un'assemblea

Ogni assemblea attraversa un flusso di stati fisso. Le transizioni di stato vengono validate dalla state machine nel backend.

| Stato | Significato |
| --- | --- |
| `DRAFT` | Fase di preparazione – l'assemblea non è ancora visibile. |
| `PUBLISHED` | Gli inviti sono stati inviati. |
| `CHECK_IN` | La fase di check-in è aperta. |
| `IN_PROGRESS` | L'assemblea è in corso, i punti all'ordine del giorno vengono trattati. |
| `CLOSED` | L'assemblea è stata conclusa. |
| `ARCHIVED` | L'assemblea è archiviata. |

Transizioni valide: `DRAFT → PUBLISHED`, `PUBLISHED → CHECK_IN`, `CHECK_IN → IN_PROGRESS`, `IN_PROGRESS → CLOSED`, `CLOSED → ARCHIVED`. Da `ARCHIVED` non sono possibili ulteriori transizioni.

## Modalità di assemblea

Al momento della creazione si sceglie la modalità dell'assemblea:

- **`LIVE_MEETING`** – assemblea in presenza, ibrida o online in tempo reale. Valore predefinito.
- **`CIRCULAR_RESOLUTION`** – risoluzione circolare (Art. 712m cpv. 2 ZGB). Richiede obbligatoriamente i campi `circular_voting_start` e `circular_voting_end`. L'inizio deve precedere la fine.

## Creare un'assemblea

<Steps>

1. **Inserire i dati di base.** Definire titolo, descrizione, data (`scheduled_at` come timestamp RFC3339) e luogo. Il sistema verifica che non sia già pianificata un'altra assemblea dello stesso mandante al momento scelto. Uno slug univoco viene generato automaticamente.

2. **Scegliere modalità e metodo di check-in.** Impostare `meeting_mode` su `LIVE_MEETING` o `CIRCULAR_RESOLUTION`. Scegliere il metodo di check-in (`checkin_method`):
   - `MANUAL` – il presidente marca i proprietari presenti manualmente (predefinito).
   - `QR_CODE` – i proprietari effettuano il self-check-in tramite QR-Code.
   - `SIGNATURE` – i proprietari firmano sul tablet dell'amministratore.

3. **Definire la visibilità dei risultati in diretta.** Con `live_results_visible_to` si determina chi vede i risultati in diretta durante una votazione aperta:
   - `ALL` – tutti i partecipanti vedono i risultati parziali (predefinito).
   - `CHAIR` – solo `tenant_admin` e `meeting_chair` vedono i risultati in diretta.

4. **Attivare la conferma dell'espressione di voto (opzionale).** Impostare `require_vote_confirmation` su `true` se i proprietari devono confermare esplicitamente la propria espressione di voto.

5. **Collegare le community.** Collegare una o più community all'assemblea. Il collegamento avviene tramite la tabella di join `meeting_communities` e permette assemblee con più community.

</Steps>

## Creare i punti all'ordine del giorno

Ogni punto all'ordine del giorno (`AgendaItem`) appartiene a un'assemblea e possiede le seguenti proprietà:

- **`order_number`** – ordine all'interno dell'assemblea.
- **`title`** e **`description`** – denominazione e spiegazione.
- **`type`** – tipo di punto all'ordine del giorno:
  - `MOTION` – votazione Sì/No/Astensione.
  - `ELECTION` – elezioni; richiede il campo `candidates` (lista di nomi dei candidati).
  - `FREE_TEXT` – votazione a testo libero.
  - `PROTOCOL` – definizione della redazione del verbale, senza votazione.
- **`quorum_type`** – modello di quorum per questo punto all'ordine del giorno: `SIMPLE_MAJORITY`, `QUALIFIED_MAJORITY`, `UNANIMOUS`, `ABSOLUTE_MAJORITY` o `CUSTOM`. Con `CUSTOM` si definisce `custom_quorum_pct` e opzionalmente `custom_quorum_value_pct`; `custom_quorum_base` determina la base (`PRESENT` o `ELIGIBLE`).
- **`community_id`** – riferimento alla community. Un valore vuoto (`nil`) significa che il punto all'ordine del giorno si applica a tutte le community dell'assemblea. Il metodo `AppliesToCommunity` verifica questo: se `CommunityID` non è impostato, il punto all'ordine del giorno si applica a tutte.

In caso di `LIVE_MEETING`, il sistema crea automaticamente il punto all'ordine del giorno procedurale «Definizione della redazione del verbale» (tipo `PROTOCOL`, `order_number` 0). Non appena si definisce il redattore del verbale, il sistema chiude automaticamente questo punto all'ordine del giorno.

## Configurare il redattore del verbale

Il redattore del verbale viene definito tramite `protocol_writer_type` e `protocol_writer_owner_id`:

- **`OWNER`** – un proprietario redige il verbale; `protocol_writer_owner_id` referenzia il proprietario.
- **`TENANT_ADMIN`** – un amministratore redige il verbale.

La configurazione è consentita solo per `LIVE_MEETING` e non è più modificabile non appena l'assemblea è `CLOSED` o `ARCHIVED`.

## Caricare gli allegati

Gli allegati possono essere gestiti a due livelli:

- **Allegati dell'assemblea** – documenti generali per l'intera assemblea.
- **Allegati dei punti all'ordine del giorno** – documenti relativi a uno specifico punto all'ordine del giorno.

Inoltre ResiVote supporta slide online per presentazioni all'interno di un punto all'ordine del giorno.

## Pubblicare l'assemblea

La pubblicazione esegue la transizione di stato `DRAFT → PUBLISHED`. In questo momento avviene quanto segue:

1. La state machine valida e imposta lo stato su `PUBLISHED`.
2. Il sistema pianifica la sequenza di e-mail: un invito immediato e un promemoria sette giorni prima della data dell'assemblea.
3. Gli inviti vengono inviati il prima possibile; se l'invio fallisce, l'assemblea rimane comunque pubblicata.

<Aside type="note" title="Aggiornamenti">
  Le assemblee possono essere modificate solo nello stato `DRAFT` o `PUBLISHED`. Non appena l'assemblea raggiunge `CHECK_IN` o uno stato successivo, le modifiche ai dati di base sono bloccate.
</Aside>

<CardGrid>
  <Card title="Svolgere le votazioni" icon="seti:vote">
    Come vengono votati i punti all'ordine del giorno e quali modelli di voto si applicano.
  </Card>
  <Card title="Check-in e presenza" icon="seti:check">
    Come i proprietari diventano presenti all'assemblea.
  </Card>
</CardGrid>
