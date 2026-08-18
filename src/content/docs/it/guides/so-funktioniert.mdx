---
title: Come funziona ResiVote
description: Il flusso di un'assemblea dei proprietari digitale con ResiVote – dalla bozza al verbale archiviato.
---

import { Steps, Aside, CardGrid, Card, LinkCard } from '@astrojs/starlight/components';

ResiVote vi accompagna dalla bozza al verbale firmato – il tutto in uno spazio digitale. Un'assemblea attraversa una macchina a stati definita:

Bozza → Pubblicata → Check-in → In corso → Conclusa → Archiviata

Oltre all'assemblea in diretta, ResiVote supporta la risoluzione circolare (Art. 712m cpv. 2 ZGB) come alternativa.

## 1. Preparare l'assemblea

L'assemblea inizia nello stato di bozza. L'amministratore definisce data, orario, luogo e titolo.

### Più comunità

Un'assemblea può comprendere diverse comunità. Le comunità possono essere raggruppate in un complesso immobiliare – uno STWEG più un MEG associato nella stessa assemblea.

### Punti all'ordine del giorno

Ogni punto all'ordine del giorno definisce:

- **Tipo** – mozione (Sì/No/Astensione), elezione, proposta a testo libero, definizione della redazione del verbale (senza votazione)
- **Quorum** – maggioranza semplice, maggioranza qualificata, unanimità, maggioranza assoluta o personalizzata con percentuale personalizzata
- **Comunità** – se non assegnata a una comunità specifica, il punto si applica a tutte le comunità dell'assemblea

Per i dettagli sui tipi di quorum si veda `/guides/quorum/`.

## 2. Invitare i partecipanti

Il passaggio allo stato pubblicato invia gli inviti.

### E-mail programmate

Gli inviti vengono salvati come e-mail programmate. Un processo in background recupera le e-mail in scadenza e le invia. Le tipologie includono inviti, promemoria e notifiche di conclusione. Ogni e-mail attraversa gli stati da in attesa a inviata (oppure fallita, con nuovi tentativi automatici).

### PDF di invito e carta di procura

Per ogni destinatario viene generato un PDF di invito e una carta di procura personalizzata. Entrambi vengono inviati come allegato.

### Login

L'autenticazione avviene tramite ZITADEL. I proprietari accedono con il loro link personale. L'associazione dell'identità ZITADEL al record del proprietario avviene automaticamente al primo login.

## 3. Svolgere l'assemblea

L'amministratore apre l'assemblea per il check-in, quindi la avvia.

### Metodi di check-in

L'assemblea configura un metodo di check-in:

| Metodo | Svolgimento |
|---------|-------------|
| Manuale | Il presidente/l'amministratore marca i partecipanti manualmente (predefinito) |
| QR-Code | I proprietari scansionano un QR-Code con lo smartphone (self-check-in) |
| Firma | I proprietari si selezionano da un dropdown sul tablet dell'amministratore e firmano digitalmente; tutte le proprie unità e le unità con procura vengono marcate come presenti |

### Dashboard del presidente e verbale in diretta

Il presidente controlla l'assemblea tramite una dashboard: aprire/chiudere i punti all'ordine del giorno, avviare le votazioni, consultare i risultati in diretta. Il verbale in diretta viene redatto in parallelo – il redattore del verbale annota le note per ogni punto all'ordine del giorno.

### Aggiornamenti in tempo reale

La presenza, lo stato del quorum e i risultati delle votazioni vengono trasmessi in tempo reale a tutti i partecipanti. Le modifiche di presenza vengono trasmesse immediatamente.

## 4. Adottare le risoluzioni

Ogni punto all'ordine del giorno attraversa degli stati:

In attesa → In presentazione → Votazione anticipata (opzionale) → In votazione → Concluso (oppure saltato)

### Espressione del voto

Prima di ogni espressione di voto, il sistema verifica:

1. L'assemblea è in corso (oppure in fase di votazione anticipata asincrona)
2. Il punto all'ordine del giorno è aperto o in votazione anticipata
3. Il quorum era raggiunto all'apertura – oppure il presidente ha concesso un override del quorum
4. L'unità appartiene a una comunità dell'assemblea
5. Il punto all'ordine del giorno si applica alla comunità dell'unità
6. Il votante è il votante principale o il mandatario
7. In caso di procura: il punto all'ordine del giorno è coperto? L'espressione del voto corrisponde all'istruzione?
8. Check-in richiesto (se configurato)

### Voti per testa e quote di valore

A seconda del modello di diritto di voto della comunità, contano i voti per testa, le quote di valore o le quote personalizzate. La limitazione del diritto di voto (Art. 712g ZGB) limita i voti per testa al superamento della percentuale regolamentare.

### Calcolo del quorum e risultati

Il sistema calcola per ogni comunità i voti per testa e le quote di valore, li confronta con la soglia e genera un risultato complessivo. Per i dettagli si veda `/guides/quorum/`.

### Visibilità dei risultati in diretta

La visibilità dei risultati in diretta controlla chi vede i risultati: tutti i partecipanti oppure solo il presidente e l'amministratore.

## 5. Concludere il verbale

Dopo l'ultimo punto all'ordine del giorno, l'assemblea viene conclusa e quindi archiviata.

### PDF del verbale

Il verbale vincolante viene generato come PDF con tutti i punti all'ordine del giorno, i risultati delle votazioni, le presenze e le limitazioni del diritto di voto. I punti all'ordine del giorno puramente procedurali per la definizione del verbale vengono esclusi. Per i dettagli si veda `/guides/protokoll/`.

### Audit-Log e pacchetto di prove

Ogni azione è stata registrata durante l'assemblea nella catena di hash di audit. Il pacchetto di prove esporta l'intera catena con verifica dell'integrità.

### Archiviazione

Dopo l'archiviazione non sono più possibili modifiche. La catena di hash di audit rende dimostrabile ogni manipolazione successiva.

<Aside type="note" title="Risoluzione circolare">
In modalità risoluzione circolare non sono previsti check-in e sessione in diretta. I proprietari votano in modo asincrono entro una finestra temporale. Il calcolo del quorum e il verbale funzionano in modo analogo.
</Aside>

## Link di approfondimento

<LinkCard title="Verbale e report" href="/guides/protokoll/" description="Verbale in diretta, proposte IA e report PDF." />
<LinkCard title="Quorum e presenza" href="/guides/quorum/" description="Capacità deliberativa e calcolo del quorum." />
<LinkCard title="Utenti e autorizzazioni" href="/guides/benutzer/" description="Ruoli, mandanti e controllo degli accessi." />
