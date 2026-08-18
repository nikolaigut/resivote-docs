---
title: Check-in e presenza
description: Metodi di check-in, token QR, firme su tablet e calcolo della presenza con procure.
---

import { Steps, Aside, CardGrid, Card } from '@astrojs/starlight/components';

Questa guida descrive come i proprietari diventano presenti a un'assemblea e come ResiVote calcola la presenza. È rivolta a `tenant_admin`, `meeting_chair` e ai proprietari.

## Metodi di check-in

Ogni assemblea definisce il proprio metodo di check-in (`checkin_method`). Un valore vuoto significa `MANUAL`.

| Metodo | Descrizione |
| --- | --- |
| `MANUAL` | Il presidente o l'amministratore marca i proprietari presenti manualmente. |
| `QR_CODE` | I proprietari effettuano il self-check-in scansionando un QR-Code con lo smartphone. |
| `SIGNATURE` | I proprietari si selezionano da un dropdown sul tablet dell'amministratore e firmano digitalmente. |

## Requisito: stato CHECK_IN

Il check-in richiede che l'assemblea si trovi nello stato `CHECK_IN`. All'apertura dell'assemblea (`PUBLISHED → CHECK_IN`), il sistema verifica per i metodi `QR_CODE` e `SIGNATURE` che il check-in sia configurato correttamente.

## Check-in manuale

Il presidente registra la presenza di un'unità manualmente. Il sistema crea un record `Attendance` con `method = CHECKIN` e rifiuta check-in doppi con un errore di conflitto.

## Self-check-in tramite QR-Code

<Steps>

1. **Generare il token QR.** L'amministratore genera un token di check-in firmato per l'assemblea. Il token è un JWT firmato con HMAC (HS256) e contiene `meeting_id`, il metodo di check-in e lo slug del mandante. La durata di validità è controllata dalla variabile d'ambiente `CHECKIN_TOKEN_EXPIRY` (predefinito: 30 minuti).

2. **Validare il token.** Prima del login, il frontend può validare il token per risolvere l'assemblea. Il token stesso non concede accesso – il proprietario deve autenticarsi successivamente.

3. **Eseguire il self-check-in.** Il proprietario autenticato registra una o più delle proprie unità. Il sistema verifica che il proprietario possieda attivamente l'unità (`ValidUntil` non è impostato) e che l'unità non sia già registrata. Le unità già registrate vengono saltate – il self-check-in è idempotente.

</Steps>

<Aside type="note" title="Verifica del metodo">
  Il self-check-in è consentito solo se il metodo di check-in dell'assemblea è `QR_CODE` (oppure vuoto, che per ragioni di retrocompatibilità permette il self-check-in).
</Aside>

## Check-in con firma su tablet

Il check-in con firma avviene in due passaggi sul tablet dell'amministratore:

### Passaggio 1: recuperare l'anteprima

La `CheckinPreview` mostra al proprietario quali unità sono coperte dalla sua firma:

- **Unità proprie** (`own_units`) – tutte le proprietà attive nell'ambito della community dell'assemblea.
- **Unità rappresentate** (`proxy_units`) – unità per cui il proprietario è mandatario di una procura attiva. Per ogni unità rappresentata viene indicato il mandante della procura (`proxy_grantor_id`).
- **Totale** – `total_units` e `total_value_quota` sommano le unità coperte e le relative quote di valore.

### Passaggio 2: registrare la firma

Il metodo `SignatureCheckIn` salva la firma digitale:

- **`captured_by_id`** – l'amministratore che opera il tablet.
- **`image_data`** – la firma come dati immagine JPEG o PNG.
- **Le unità proprie** ricevono un record `Attendance` con `method = SIGNATURE`.
- **Le unità rappresentate** non ricevono una presenza propria. Vengono marcate automaticamente come rappresentate tramite la procura nel Presence Builder. La tabella di join `SignatureUnit` documenta tutte le unità coperte (proprie e rappresentate) per scopi di audit.

La firma viene salvata in una tabella separata (`signatures`) – separata dalla presenza – affinché i dati dell'immagine rimangano manipolabilmente sicuri e verificabili in modo indipendente.

## Entità presenza

Ogni presenza (`Attendance`) registra quando e come un'unità è stata registrata:

- **`owner_id`** – il proprietario.
- **`unit_id`** – l'unità registrata.
- **`method`** – il metodo di check-in: `CHECKIN` (manuale), `SELF_CHECKIN` (QR), `SIGNATURE` (tablet) o `VOTE` (automaticamente tramite espressione di voto).

Un'unità è considerata presente non appena esiste un record `Attendance`.

## Calcolo della presenza (Presence Builder)

Il Presence Builder aggrega presenze, procure e rapporti di proprietà in snapshot per community (`CommunityPresence`). Per ogni community calcola:

- **`total_owners`**, **`total_head_votes`** (numero di unità) e **`total_value_quota`**.
- **`present_owners`**, **`present_head_votes`** e **`present_value_quota`**.
- **`presence_head_pct`** e **`presence_value_pct`** – percentuali di presenza.

Ogni proprietario riceve uno stato (`PresenceRecord`):

- **`PRESENT`** – il proprietario è registrato direttamente.
- **`REPRESENTED`** – il proprietario è rappresentato tramite una procura attiva; `represented_by` rimanda al mandatario. Requisito: il mandatario è presente in qualche punto dell'assemblea.
- **`ABSENT`** – né presente né rappresentato.

Le community MEG senza unità proprie ereditano le unità degli STWEG collegati, se `InheritsOwners` è attivo e il MEG non possiede unità proprie.

## Presenza automatica tramite espressione di voto

Un'espressione di voto implica presenza: se un proprietario vota senza essersi prima registrato, il sistema crea automaticamente un record `Attendance` con `method = VOTE`. In caso di espressione di voto tramite procura, la presenza viene impostata sul mandatario.

<CardGrid>
  <Card title="Gestire le procure" icon="seti:doc">
    Come le unità rappresentate vengono registrate automaticamente al check-in.
  </Card>
  <Card title="Creare un'assemblea" icon="seti:settings">
    Configurare il metodo di check-in per l'assemblea.
  </Card>
</CardGrid>
