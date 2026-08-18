---
title: Gestire le procure
description: Concedere, limitare e revocare le procure – dalla procura generale all'espressione di voto con mandato.
---

import { Aside, Steps, CardGrid, Card } from '@astrojs/starlight/components';

Questa guida descrive come funzionano le procure (Vollmachten / Proxies) in ResiVote. È rivolta a `tenant_admin`, `meeting_chair` e ai proprietari.

## Entità procura

Una procura (`Proxy`) trasferisce il diritto di voto per un'unità e un'assemblea specifiche da un proprietario a un altro. È composta dai seguenti campi:

- **`grantor_id`** – il mandante della procura (proprietario che concede la procura).
- **`grantee_id`** – il mandatario (proprietario che riceve la procura).
- **`unit_id`** – l'unità per cui vale la procura. Le procure sono univoche per unità e assemblea.
- **`meeting_id`** – l'assemblea a cui si riferisce la procura.

Un proprietario non può conferire una procura a se stesso. Per unità e assemblea è ammessa una sola procura attiva.

## Ambito della procura (Scope)

L'ambito di una procura viene definito tramite `scope`:

- **`FULL`** – la procura vale per l'intera assemblea. Il mandatario può votare per tutti i punti all'ordine del giorno.
- **`RESTRICTED`** – la procura è limitata a determinati punti all'ordine del giorno. Il metodo `CoversAgendaItem` verifica se un punto all'ordine del giorno è coperto: con `FULL` sempre, con `RESTRICTED` solo se esiste un'istruzione per il punto all'ordine del giorno.

## Espressione di voto con mandato (Instructions)

Per le procure limitate, ogni `ProxyInstruction` definisce un'espressione di voto vincolante per un determinato punto all'ordine del giorno:

- **`agenda_item_id`** – il punto all'ordine del giorno a cui si applica l'istruzione.
- **`mandated_vote`** – l'opzione di voto prescritta (`YES`, `NO`, `ABSTAIN`, `CANDIDATE` o `FREE_TEXT`).

<Aside type="warning" title="Istruzione vincolante">
  Un'espressione di voto con mandato è vincolante. Il mandatario deve votare obbligatoriamente secondo l'istruzione. Il sistema lo impone all'atto dell'espressione del voto.
</Aside>

## Concedere una procura

<Steps>

1. **Assemblea nello stato corretto.** Le procure possono essere create solo se l'assemblea ha lo stato `PUBLISHED`, `CHECK_IN`, `IN_PROGRESS` o `OPEN`. In `DRAFT`, `CLOSED` o `ARCHIVED` la creazione è bloccata.

2. **Verificare proprietario e unità.** Il sistema verifica che il mandante possieda attivamente l'unità e che l'unità appartenga all'ambito della community dell'assemblea. Il mandatario deve essere un proprietario legittimato nelle community dell'assemblea. Per le unità MEG, anche i delegati MEG senza diretta proprietà nella community MEG possono ricevere una procura.

3. **Definire ambito e istruzioni.** Scegliere `FULL` o `RESTRICTED`. Con `RESTRICTED` aggiungere per ogni punto all'ordine del giorno un'istruzione con l'opzione di voto mandate.

4. **Salvare la procura.** Il sistema crea la procura e aggiorna immediatamente la presenza e il quorum in diretta, poiché la rappresentanza cambia.

</Steps>

## Revocare una procura

Una procura viene revocata tramite `Revoke`. Il sistema imposta `revoked_at` all'istante attuale; il metodo `IsActive` restituisce quindi `false`. Una revoca aggiorna parimenti immediatamente la presenza e il quorum in diretta.

## Rappresentanza nell'espressione di voto

Durante la votazione il sistema considera automaticamente le procure attive:

- Il mandatario deve essere egli stesso presente all'assemblea (registrato sotto un'unità qualsiasi) perché la rappresentanza valga.
- Se il mandatario vota per un'unità rappresentata, `voter_id` viene impostato sul mandatario e `proxy_id` rimanda alla procura.
- In caso di presenza diretta del proprietario (presenza fisica), questa prevale sulla procura – il proprietario vota di persona.
- Per l'espressione di voto analogica valgono le stesse regole: se l'unità non è registrata ma è rappresentata tramite una procura attiva e il mandatario è presente, vota il mandatario.

## Rappresentanza al check-in

Le procure influiscono automaticamente sulla presenza. Il Presence Builder marca le unità rappresentate come `REPRESENTED`, purché il mandatario sia presente in qualche punto dell'assemblea. L'unità rappresentata confluisce nel calcolo dei voti per testa e delle quote di valore. I dettagli si trovano nella guida <a href="/guides/checkin/">Check-in e presenza</a>.

<CardGrid>
  <Card title="Check-in e presenza" icon="seti:check">
    Come le unità rappresentate vengono registrate al check-in.
  </Card>
  <Card title="Svolgere le votazioni" icon="seti:vote">
    Come i mandatari votano per le unità rappresentate.
  </Card>
</CardGrid>
