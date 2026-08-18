---
title: Quorum e presenza
description: Tipi di quorum, capacità deliberativa, calcolo della presenza e modelli di comunità in ResiVote.
---

import { Steps, Aside, CardGrid, Card, LinkCard } from '@astrojs/starlight/components';

ResiVote calcola i quorum secondo il diritto immobiliare svizzero (ZGB). La capacità deliberativa viene monitorata in diretta durante l'assemblea e congelata come snapshot all'apertura di un punto all'ordine del giorno.

## Tipi di quorum

Ogni punto all'ordine del giorno definisce il proprio tipo di quorum:

| Tipo | Significato | Base giuridica |
|-----|-------------|-----------------|
| Maggioranza semplice | Sì > 50% dei voti per testa presenti. Astensioni e voti non espressi contano come no implicito. | — |
| Maggioranza qualificata | Sì > 50% dei proprietari presenti (teste) **e** > 50% di **tutte** le quote di valore legittimate. | Art. 647b/d/e, 712g cpv. 3 ZGB |
| Unanimità | 100% di **tutti** i proprietari registrati (teste) e quote di valore devono votare sì. Le assenze senza procura positiva contano come no. | Art. 647e ZGB |
| Maggioranza assoluta | Sì > 50% di **tutti** i proprietari registrati (indipendentemente dalla presenza). | — |
| Personalizzato | Sì >= soglia personalizzata in % della base configurata. | Regolamento |

### Quorum personalizzato

Per il quorum personalizzato il punto all'ordine del giorno contiene tre parametri:

- **Soglia in %** – p. es. 66.67
- **Soglia quote di valore** – soglia separata opzionale per le quote di valore
- **Base di calcolo** – presenti o tutti i legittimati

### Override del quorum

Il presidente può revocare un blocco del quorum. Il punto all'ordine del giorno contiene a tal fine:

- **Override del quorum** – se attivo, i voti vengono accettati anche se il quorum non era raggiunto all'apertura.
- **Motivazione** – testo di motivazione obbligatorio se l'override è attivo.

Il sistema verifica prima di ogni voto: se non esiste uno snapshot del quorum, il controllo viene saltato. Se il quorum non era raggiunto e l'override non è impostato, il voto viene rifiutato.

## Calcolo del quorum

Il sistema è il componente centrale per l'analisi delle votazioni. Calcola per ogni comunità un risultato e li aggrega in un risultato complessivo.

### Input

- Punto all'ordine del giorno con tipo di quorum e soglie personalizzate
- Comunità dell'assemblea
- Unità e quote di proprietà
- Presenze
- Procure
- Voti espressi

### Output per comunità

| Campo | Significato |
|------|-------------|
| Voti per testa (Sì/No/Astensione) | Voti per testa |
| Quote di valore (Sì/No/Astensione) | Quote di valore |
| Soglie richieste | Voti favorevoli richiesti |
| Superamento soglia | Se la soglia è stata raggiunta |
| Risultato complessivo | risultato complessivo (nullo per punti all'ordine del giorno informativi) |
| Limitazione del diritto di voto | Limitazione applicata e proprietari interessati |
| Votanti No/Astensione | Cognomi di chi ha votato no/astenuto (per il verbale) |
| Risultato elezione | Risultato dell'elezione |
| Informativo | Nessun risultato sì/no (p. es. testo libero) |
| Ereditato | Risultato MEG ereditato da STWEG collegati |

### Normalizzazione difensiva

Il sistema normalizza gli input in modo difensivo: comunità vuote restituiscono un risultato informativo, i voti mancanti contano come no implicito e gli errori di arrotondamento vengono assorbiti.

### Risultato complessivo

Il risultato complessivo è positivo se **tutte** le comunità raggiungono il quorum. I risultati MEG ereditati non vengono contati due volte.

## Servizio quorum in diretta

Il sistema risponde alla domanda «l'assemblea è capace di deliberare?» in tempo reale, sulla base della presenza attuale – indipendentemente dai voti espressi.

### Capacità deliberativa

L'assemblea è capace di deliberare se **più della metà** dei voti per testa **e** più della metà delle quote di valore sono presenti/rappresentate, più il numero minimo di proprietari. «Più della metà» è una **disuguaglianza rigorosa**: con un numero totale pari N la soglia è `N/2 + 1` (p. es. 4 proprietari → 3 necessari). Esattamente il 50% non basta.

### Modelli di diritto di voto

Quali condizioni si applicano dipende dal modello di diritto di voto della comunità:

| Modello | Condizione teste | Condizione quote di valore |
|--------|------------------|-----------------------------|
| Voti per testa e quote di valore / Quote personalizzate | sì | sì |
| Solo voti per testa | sì | saltata |
| Solo quote di valore | saltata | sì |

### Output

Lo stato del quorum in diretta per comunità:

- Quorum teste raggiunto, quorum quote di valore raggiunto, numero minimo proprietari raggiunto, quorum complessivo raggiunto
- Voti per testa richiesti, quote di valore richieste
- Voti per testa mancanti, quote di valore mancanti, proprietari mancanti

Il quorum è raggiunto se tutte le comunità raggiungono il quorum.

## Calcolo della presenza

Il sistema raccoglie presenze, procure e quote di proprietà e le aggrega in snapshot per comunità. Viene utilizzato congiuntamente dal calcolo del quorum in diretta e dall'API, in modo che il quorum in diretta e l'API utilizzino la stessa fonte di presenza.

### Svolgimento

<Steps>
  1. **Caricare le comunità** – tutte le comunità dell'assemblea.
  2. **Caricare le presenze** – tutti i record di presenza dell'assemblea.
  3. **Caricare le procure** – tutti i record di procura dell'assemblea.
  4. **Costruire le lookup-map** – mappare ogni unità alla sua presenza e alla procura attiva.
  5. **Aggregare per comunità** – per ogni comunità: caricare le unità, sommare le quote di proprietà, calcolare i voti per testa e le quote di valore presenti/rappresentate.
</Steps>

### Stato di presenza

Ogni proprietario riceve uno stato di presenza:

| Stato | Significato |
|--------|-------------|
| Presente | Il proprietario è presente (check-in effettuato) |
| Rappresentato | Il proprietario è rappresentato da un mandatario |
| Assente | Il proprietario è assente |

Lo snapshot di presenza riassume: numero totale di proprietari, voti per testa totali, quote di valore totali, proprietari presenti, voti per testa presenti, quote di valore presenti e le relative percentuali.

### Procure

Un proprietario può conferire una procura a un'altra persona. Il sistema verifica:

- Solo il mandatario può votare digitalmente, non il mandante della procura.
- La procura deve coprire il punto all'ordine del giorno.
- Le espressioni di voto con mandato devono corrispondere all'istruzione.

## Snapshot del quorum

All'apertura di un punto all'ordine del giorno, il sistema congela la presenza attuale e lo stato del quorum. Lo snapshot serve come base del quorum per questo punto all'ordine del giorno.

### Persistenza

Lo snapshot viene salvato in modo persistente:

| Campo | Significato |
|------|-------------|
| Punto all'ordine del giorno | univoco per punto all'ordine del giorno |
| Assemblea | Assemblea |
| Snapshot | snapshot completo |
| Istante | istante della fotografia |
| Quorum all'apertura | l'assemblea era capace di deliberare all'apertura? |

Lo snapshot sopravvive ai riavvii del server ed è la base per il controllo del quorum durante la votazione.

## Tipi di comunità e standard

### STWEG vs MEG

ResiVote distingue due tipi di comunità:

| Tipo | Significato | Quorum standard (teste/valore/proprietari min.) |
|-----|-------------|------------------------------------------------|
| STWEG | Comunità dei proprietari per piani | 50% / 50% / 2 |
| MEG | Comunità dei comproprietari | 50% / 50% / 1 |

Gli standard vengono impostati in base al tipo di comunità. I valori del regolamento sovrascrivono gli standard se sono configurati.

### Modelli di diritto di voto

| Modello | Descrizione |
|--------|-------------|
| Voti per testa e quote di valore | Voti per testa + quote di valore (standard STWEG) |
| Solo voti per testa | 1 unità = 1 voto |
| Solo quote di valore | Solo quote di valore |
| Quote personalizzate | Quote personalizzate per unità (specifico per MEG) |

### Il MEG eredita i proprietari dagli STWEG

Un MEG può ereditare i proprietari dagli STWEG collegati:

- **Ereditarietà** – rilevante solo per il MEG. Se attiva, il MEG non gestisce unità/proprietari propri, ma li eredita dagli STWEG collegati.
- Il MEG eredita gli STWEG solo se non possiede unità proprie. Questo impedisce il doppio conteggio.
- Il collegamento tra STWEG e MEG avviene tramite una relazione tra le comunità.

I risultati MEG ereditati vengono marcati come ereditati e non vengono contati due volte nel risultato complessivo.

### Complessi immobiliari

Un complesso immobiliare raggruppa più comunità (STWEG e/o MEG). Un'assemblea può comprendere più comunità di un complesso immobiliare.

## Link di approfondimento

<LinkCard title="Votazione" href="/guides/abstimmung/" description="Espressione del voto, validazione e risultati." />
