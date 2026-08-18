---
title: Svolgere le votazioni
description: Aprire i punti all'ordine del giorno, votare in digitale e analogico, nonché gestire i quorum e i risultati in diretta.
---

import { Steps, Aside, CardGrid, Card, LinkCard } from '@astrojs/starlight/components';

Questa guida descrive il processo di votazione – dall'apertura di un punto all'ordine del giorno fino al risultato. È rivolta a `tenant_admin` e `meeting_chair`.

## Stato dei punti all'ordine del giorno

Ogni punto all'ordine del giorno attraversa un proprio flusso di stati, validato dalla state machine:

| Stato | Significato |
| --- | --- |
| `PENDING` | Non ancora trattato. |
| `PRESENTING` | Fase di presentazione e discussione; nessuna votazione. |
| `PRE_VOTING` | Votazione anticipata asincrona in corso. |
| `OPEN` | La votazione è aperta. |
| `CLOSED` | Votazione conclusa. |
| `SKIPPED` | Il punto all'ordine del giorno è stato saltato. |

Transizioni valide: `PENDING → PRESENTING / PRE_VOTING / OPEN / SKIPPED`, `PRESENTING → OPEN / CLOSED / PENDING / SKIPPED`, `PRE_VOTING → PRESENTING / OPEN / PENDING / CLOSED`, `OPEN → CLOSED / PRESENTING / PENDING`. I punti all'ordine del giorno chiusi possono essere riaperti o ripresentati.

## Tipi di votazione

Il tipo di votazione deriva dal tipo del punto all'ordine del giorno (`type`):

- **`MOTION`** – scelta tra `YES`, `NO` e `ABSTAIN`.
- **`ELECTION`** – elezione dei candidati; `choice` è `CANDIDATE`, il nome del candidato viene salvato in `candidate_name`.
- **`FREE_TEXT`** – testo libero; `choice` è `FREE_TEXT`, il testo in `free_text_value`.

## Modelli di diritto di voto

Ogni community definisce il proprio modello di diritto di voto (`voting_rights_model`):

- **`HEAD_AND_VALUE`** – voti per testa e quote di valore (standard STWEG).
- **`HEAD_ONLY`** – solo voti per testa (1 unità = 1 voto).
- **`VALUE_ONLY`** – solo quote di valore.
- **`CUSTOM_SHARES`** – quote personalizzate per unità (specifico per MEG).

### Voto per testa e quota di valore

Per ogni voto vale: **1 unità = 1 voto per testa** (Art. 712o ZGB). Il campo `head_vote_value` è sempre `1`. La quota di valore (`value_quota`) e le eventuali `custom_shares` vengono fissate come snapshot nel record di voto al momento dell'espressione. In questo modo il voto rimane ricostruibile anche successivamente, anche se i rapporti di proprietà cambiano in seguito.

## Votazione anticipata (Pre-Voting)

Per le votazioni asincrone, un punto all'ordine del giorno può essere portato nello stato `PRE_VOTING`. I proprietari possono votare in anticipo, senza essere presenti. Questi voti vengono marcati con `is_pre_vote = true`. Al termine della votazione confluiscono nel risultato. La votazione anticipata può essere ripristinata su `PENDING` in qualsiasi momento; i voti già espressi vengono conservati, ma contati solo quando il punto all'ordine del giorno viene aperto o la votazione anticipata viene riavviata.

## Espressione di voto digitale

<Steps>

1. **Aprire il punto all'ordine del giorno.** Il presidente apre il punto all'ordine del giorno. Il sistema verifica la capacità deliberativa (quorum) in base alla presenza attuale. Se il quorum non è raggiunto, il sistema blocca l'apertura – a meno che il presidente non abbia impostato un override del quorum.

2. **Esprimere il voto.** Il proprietario seleziona la propria unità e la propria opzione di voto. Il sistema crea automaticamente una presenza (`Method = VOTE`), se l'unità non era ancora stata registrata – un'espressione di voto implica presenza.

3. **Modificare il voto.** I voti sono immutabili (sicurezza audit). Se un voto viene modificato, il sistema marca il vecchio voto con `is_superseded = true` e crea un nuovo record di voto. In questo modo ogni cambio di voto rimane tracciabile senza lacune.

4. **Chiudere il punto all'ordine del giorno.** Il presidente chiude il punto all'ordine del giorno. Il sistema calcola il quorum, salva il risultato (`result_passed`, `result_details`) e ferma un eventuale timer di presentazione.

</Steps>

## Espressione di voto analogica

I proprietari che non possono votare digitalmente vengono registrati in modo analogico. Il presidente inserisce il voto per loro conto.

- **Singolo voto analogico** – `CastAnalogVote` registra un voto per un'unità presente. Se l'unità non è registrata ma è rappresentata tramite una procura attiva, vota il mandatario – purché sia egli stesso presente.
- **Votazione collettiva** – `CastBulkAnalogVotesRequest` registra più voti per alzata di mano in un'unica operazione. Tutti gli input vengono validati e salvati in un'unica transazione di database. Se un voto fallisce, nessun voto viene persistito.

L'espressione di voto analogica è consentita solo nello stato `OPEN`. Per unità è possibile un solo voto attivo; un voto già espresso non viene sovrascritto in fase di registrazione analogica.

## Risultati in diretta

La visibilità dei risultati in diretta è controllata da `live_results_visible_to` a livello di assemblea:

- **`ALL`** – tutti i partecipanti vedono i risultati parziali mentre la votazione è aperta.
- **`CHAIR`** – solo `tenant_admin` e `meeting_chair` vedono i risultati in diretta per i punti all'ordine del giorno aperti.

I risultati chiusi sono visibili a tutti i partecipanti. I proprietari non privilegiati vedono i numeri aggregati del quorum, ma non l'identità di chi ha votato no o si è astenuto.

## Conferma dell'espressione di voto

Se `require_vote_confirmation` è attivo, i proprietari devono confermare esplicitamente la propria espressione di voto prima che venga registrata definitivamente.

## Override del quorum

Il presidente può revocare un blocco del quorum per un punto all'ordine del giorno. Impostando `quorum_override` su `true`, i voti vengono accettati anche se la capacità deliberativa non era data all'apertura. Il campo `quorum_override_reason` è obbligatorio in questo caso. Ogni modifica dell'override viene registrata nell'audit-log (`QUORUM_OVERRIDE_GRANTED` risp. `QUORUM_OVERRIDE_REVOKED`).

## Timer di presentazione

Ogni punto all'ordine del giorno dispone di un timer countdown per la fase di presentazione. I campi `timer_started_at` e `timer_duration_seconds` memorizzano l'istante di avvio e la durata. In questo modo i client possono sincronizzare il timer dopo una riconnessione WebSocket o un ricaricamento della pagina. Alla chiusura del punto all'ordine del giorno il timer viene fermato e azzerato automaticamente.

<Aside type="note" title="Procure">
  I mandatari possono votare per le unità rappresentate. I dettagli si trovano nella guida <a href="/guides/vollmachten/">Gestire le procure</a>.
</Aside>

<LinkCard title="Riferimento quorum" href="/reference/quorum/" description="Dettagli tecnici sui tipi di quorum e sul calcolo." />
