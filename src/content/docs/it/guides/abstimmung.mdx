---
title: Svolgere le votazioni
description: Aprire i punti all'ordine del giorno, votare in digitale e analogico, nonché gestire i quorum e i risultati in diretta.
---

import { Steps, Aside, CardGrid, Card, LinkCard } from '@astrojs/starlight/components';

Questa guida descrive il processo di votazione – dall'apertura di un punto all'ordine del giorno fino al risultato. È rivolta agli amministratori di mandante e ai presidenti.

## Stato dei punti all'ordine del giorno

Ogni punto all'ordine del giorno attraversa un proprio flusso di stati:

| Stato | Significato |
| --- | --- |
| In attesa | Non ancora trattato. |
| In presentazione | Fase di presentazione e discussione; nessuna votazione. |
| Votazione anticipata | Votazione anticipata asincrona in corso. |
| In votazione | La votazione è aperta. |
| Concluso | Votazione conclusa. |
| Saltato | Il punto all'ordine del giorno è stato saltato. |

I punti all'ordine del giorno chiusi possono essere riaperti o ripresentati.

## Tipi di votazione

Il tipo di votazione deriva dal tipo del punto all'ordine del giorno:

- **Mozione** – scelta tra Sì, No e Astensione.
- **Elezione** – elezione dei candidati; viene salvato il nome del candidato scelto.
- **Testo libero** – testo libero inserito dal votante.

## Modelli di diritto di voto

Ogni comunità definisce il proprio modello di diritto di voto:

- **Voti per testa e quote di valore** – (standard STWEG).
- **Solo voti per testa** – (1 unità = 1 voto).
- **Solo quote di valore**.
- **Quote personalizzate** – quote personalizzate per unità (specifico per MEG).

### Voto per testa e quota di valore

Per ogni voto vale: **1 unità = 1 voto per testa** (Art. 712o ZGB). La quota di valore e le eventuali quote personalizzate vengono fissate come snapshot nel record di voto al momento dell'espressione. In questo modo il voto rimane ricostruibile anche successivamente, anche se i rapporti di proprietà cambiano in seguito.

## Votazione anticipata (Pre-Voting)

Per le votazioni asincrone, un punto all'ordine del giorno può essere portato nello stato di votazione anticipata. I proprietari possono votare in anticipo, senza essere presenti. Questi voti vengono marcati come voti anticipati. Al termine della votazione confluiscono nel risultato. La votazione anticipata può essere ripristinata in qualsiasi momento; i voti già espressi vengono conservati, ma contati solo quando il punto all'ordine del giorno viene aperto o la votazione anticipata viene riavviata.

## Espressione di voto digitale

<Steps>

1. **Aprire il punto all'ordine del giorno.** Il presidente apre il punto all'ordine del giorno. Il sistema verifica la capacità deliberativa (quorum) in base alla presenza attuale. Se il quorum non è raggiunto, il sistema blocca l'apertura – a meno che il presidente non abbia impostato un override del quorum.

2. **Esprimere il voto.** Il proprietario seleziona la propria unità e la propria opzione di voto. Il sistema crea automaticamente una presenza, se l'unità non era ancora stata registrata – un'espressione di voto implica presenza.

3. **Modificare il voto.** I voti sono immutabili (sicurezza audit). Se un voto viene modificato, il sistema marca il vecchio voto come sostituito e crea un nuovo record di voto. In questo modo ogni cambio di voto rimane tracciabile senza lacune.

4. **Chiudere il punto all'ordine del giorno.** Il presidente chiude il punto all'ordine del giorno. Il sistema calcola il quorum, salva il risultato e ferma un eventuale timer di presentazione.

</Steps>

## Espressione di voto analogica

I proprietari che non possono votare digitalmente vengono registrati in modo analogico. Il presidente inserisce il voto per loro conto.

- **Singolo voto analogico** – il sistema registra un voto per un'unità presente. Se l'unità non è registrata ma è rappresentata tramite una procura attiva, vota il mandatario – purché sia egli stesso presente.
- **Votazione collettiva** – il sistema registra più voti per alzata di mano in un'unica operazione. Tutti gli input vengono validati e salvati in un'unica transazione. Se un voto fallisce, nessun voto viene persistito.

L'espressione di voto analogica è consentita solo quando la votazione è aperta. Per unità è possibile un solo voto attivo; un voto già espresso non viene sovrascritto in fase di registrazione analogica.

## Risultati in diretta

La visibilità dei risultati in diretta è controllata a livello di assemblea:

- **Tutti i partecipanti** – vedono i risultati parziali mentre la votazione è aperta.
- **Solo presidente e amministratore** – vedono i risultati in diretta per i punti all'ordine del giorno aperti.

I risultati chiusi sono visibili a tutti i partecipanti. I proprietari non privilegiati vedono i numeri aggregati del quorum, ma non l'identità di chi ha votato no o si è astenuto.

## Conferma dell'espressione di voto

Se l'opzione è attiva, i proprietari devono confermare esplicitamente la propria espressione di voto prima che venga registrata definitivamente.

## Override del quorum

Il presidente può revocare un blocco del quorum per un punto all'ordine del giorno. Impostando l'override, i voti vengono accettati anche se la capacità deliberativa non era data all'apertura. Una motivazione è obbligatoria in questo caso. Ogni modifica dell'override viene registrata nell'audit-log.

## Timer di presentazione

Ogni punto all'ordine del giorno dispone di un timer countdown per la fase di presentazione. In questo modo i client possono sincronizzare il timer dopo una riconnessione o un ricaricamento della pagina. Alla chiusura del punto all'ordine del giorno il timer viene fermato e azzerato automaticamente.

<Aside type="note" title="Procure">
  I mandatari possono votare per le unità rappresentate. I dettagli si trovano nella guida <a href="/guides/vollmachten/">Gestire le procure</a>.
</Aside>
