---
title: Check-in e presenza
description: Metodi di check-in, token QR, firme su tablet e calcolo della presenza con procure.
---

import { Steps, Aside, CardGrid, Card } from '@astrojs/starlight/components';

Questa guida descrive come i proprietari diventano presenti a un'assemblea e come ResiVote calcola la presenza. È rivolta agli amministratori di mandante, ai presidenti e ai proprietari.

## Metodi di check-in

Ogni assemblea definisce il proprio metodo di check-in. Se non specificato, il metodo predefinito è manuale.

| Metodo | Descrizione |
| --- | --- |
| Manuale | Il presidente o l'amministratore marca i proprietari presenti manualmente. |
| QR-Code | I proprietari effettuano il self-check-in scansionando un QR-Code con lo smartphone. |
| Firma | I proprietari si selezionano da un dropdown sul tablet dell'amministratore e firmano digitalmente. |

## Requisito: fase di check-in

Il check-in richiede che l'assemblea si trovi nella fase di check-in. All'apertura dell'assemblea, il sistema verifica per i metodi QR-Code e firma che il check-in sia configurato correttamente.

## Check-in manuale

Il presidente registra la presenza di un'unità manualmente. Il sistema crea un record di presenza e rifiuta check-in doppi con un errore di conflitto.

## Self-check-in tramite QR-Code

<Steps>

1. **Generare il token QR.** L'amministratore genera un token di check-in firmato per l'assemblea. Il token contiene l'identificatore dell'assemblea, il metodo di check-in e il mandante. La durata di validità è di 30 minuti (configurabile).

2. **Validare il token.** Prima del login, il token può essere validato per risolvere l'assemblea. Il token stesso non concede accesso – il proprietario deve autenticarsi successivamente.

3. **Eseguire il self-check-in.** Il proprietario autenticato registra una o più delle proprie unità. Il sistema verifica che il proprietario possieda attivamente l'unità e che l'unità non sia già registrata. Le unità già registrate vengono saltate – il self-check-in è idempotente.

</Steps>

<Aside type="note" title="Verifica del metodo">
  Il self-check-in è consentito solo se il metodo di check-in dell'assemblea è QR-Code (oppure non specificato, che per ragioni di retrocompatibilità permette il self-check-in).
</Aside>

## Check-in con firma su tablet

Il check-in con firma avviene in due passaggi sul tablet dell'amministratore:

### Passaggio 1: recuperare l'anteprima

L'anteprima mostra al proprietario quali unità sono coperte dalla sua firma:

- **Unità proprie** – tutte le proprietà attive nell'ambito della comunità dell'assemblea.
- **Unità rappresentate** – unità per cui il proprietario è mandatario di una procura attiva. Per ogni unità rappresentata viene indicato il mandante della procura.
- **Totale** – somma delle unità coperte e delle relative quote di valore.

### Passaggio 2: registrare la firma

Il sistema salva la firma digitale:

- L'amministratore che opera il tablet viene registrato.
- La firma viene salvata come dati immagine.
- **Le unità proprie** ricevono un record di presenza con metodo firma.
- **Le unità rappresentate** non ricevono una presenza propria. Vengono marcate automaticamente come rappresentate tramite la procura. Tutte le unità coperte (proprie e rappresentate) vengono documentate per scopi di audit.

La firma viene salvata separatamente dalla presenza, affinché i dati dell'immagine rimangano manipolabilmente sicuri e verificabili in modo indipendente.

## Entità presenza

Ogni presenza registra quando e come un'unità è stata registrata:

- **Proprietario** – il proprietario.
- **Unità** – l'unità registrata.
- **Metodo** – il metodo di check-in: manuale, QR-Code, firma o automatico tramite espressione di voto.

Un'unità è considerata presente non appena esiste un record di presenza.

## Calcolo della presenza

Il sistema aggrega presenze, procure e rapporti di proprietà in snapshot per comunità. Per ogni comunità calcola:

- Il numero totale di proprietari, di voti per testa (numero di unità) e di quote di valore.
- Il numero di proprietari presenti, di voti per testa presenti e di quote di valore presenti.
- Le percentuali di presenza.

Ogni proprietario riceve uno stato di presenza:

- **Presente** – il proprietario è registrato direttamente.
- **Rappresentato** – il proprietario è rappresentato tramite una procura attiva. Requisito: il mandatario è presente in qualche punto dell'assemblea.
- **Assente** – né presente né rappresentato.

Le comunità MEG senza unità proprie ereditano le unità degli STWEG collegati, se configurato e il MEG non possiede unità proprie.

## Presenza automatica tramite espressione di voto

Un'espressione di voto implica presenza: se un proprietario vota senza essersi prima registrato, il sistema crea automaticamente una presenza. In caso di espressione di voto tramite procura, la presenza viene impostata sul mandatario.

<CardGrid>
  <Card title="Gestire le procure" icon="seti:doc">
    Come le unità rappresentate vengono registrate automaticamente al check-in.
  </Card>
  <Card title="Creare un'assemblea" icon="seti:settings">
    Configurare il metodo di check-in per l'assemblea.
  </Card>
</CardGrid>
