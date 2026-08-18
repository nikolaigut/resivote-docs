---
title: Verbale e report
description: Verbale in diretta, proposte IA, pacchetti di prove e report PDF in ResiVote.
---

import { Steps, Aside, CardGrid, Card, LinkCard } from '@astrojs/starlight/components';

ResiVote redige il verbale dell'assemblea in diretta durante la sessione e genera alla fine report PDF verificabili. Ogni azione del verbale viene auditata e salvata in una catena di hash manipolazionemente sicura.

## Editor del verbale in diretta

Il backend salva le note del verbale per ogni punto all'ordine del giorno nel campo `DiscussionNotes` dell'entità `AgendaItem` (`internal/domain/entity/agenda_item.go`). L'editor frontend (Angular, basato su TipTap) invia HTML all'API, che lo persiste come colonna `text`.

### Definire il redattore del verbale

L'assemblea definisce all'inizio chi redige il verbale. L'entità `Meeting` contiene a tal fine due campi (`internal/domain/entity/meeting.go`):

- **`ProtocolWriterType`** – `OWNER` o `TENANT_ADMIN`
- **`ProtocolWriterOwnerID`** – obbligatorio per `OWNER`, vietato per `TENANT_ADMIN`

Il service `meetingService` valida la combinazione in `normalizeAndValidateProtocolWriter` (`internal/application/meeting_service.go`). Per `OWNER` verifica che la persona sia proprietario di una delle comunità dell'assemblea. L'impostazione del redattore del verbale chiude automaticamente il punto all'ordine del giorno procedurale «Definizione della redazione del verbale» (`AgendaItemTypeProtocol`), affinché non compaia nel verbale finale.

### Autorizzazione alla scrittura

Il metodo `canWriteLiveProtocol` (`internal/application/meeting_service.go`) concede l'accesso in scrittura se:

1. il chiamante ha il ruolo `tenant_admin`, oppure
2. `ProtocolWriterType` = `OWNER` e il chiamante corrisponde a `ProtocolWriterOwnerID` e appartiene all'assemblea.

<Aside type="note" title="Redattore del verbale solo per assemblee in diretta">
Il redattore del verbale può essere impostato solo per le assemblee `LIVE_MEETING`, non per `CIRCULAR_RESOLUTION` (risoluzione circolare). Il metodo `UpdateProtocolWriter` rifiuta modifiche ad assemblee chiuse o archiviate.
</Aside>

## Proposte di verbale tramite IA

Il service `meetingService.SuggestProtocolNotes` (`internal/application/meeting_ai_service.go`) genera bozze per passaggi del verbale. Il chiamante deve avere l'autorizzazione in scrittura sul verbale in diretta.

### Svolgimento

<Steps>
  1. **Raccogliere il contesto** – Il service carica assemblea, punto all'ordine del giorno, presenza e risultato della votazione.
  2. **Costruire il prompt** – `buildSystemPrompt` e `buildUserPrompt` generano un prompt di sistema in tedesco (contesto STWEG/MEG svizzero) e un prompt utente con punto all'ordine del giorno, quorum, presenza e risultato.
  3. **Chiamare l'LLM** – `AIProvider.GenerateProtocolNotes` invia `AIGenerateRequest` (SystemPrompt, UserPrompt, MaxTokens 1024, Temperature 0.3) al provider configurato.
  4. **Pulire l'HTML** – `sanitizeHTML` filtra la risposta tramite bluemonday e permette solo `<p>`, `<br>`, `<ul>`, `<ol>`, `<li>`, `<strong>`, `<em>`, `<u>`, `<h1>`, `<h2>`, `<h3>`, `<a>`.
  5. **Restituire il risultato** – `ProtocolNotesSuggestion` con HTML pulito, `TokensUsed` e `Provider`.
</Steps>

### Intent

Il chiamante passa un `AIProtocolIntent` (`internal/application/ai_provider.go`), che controlla cosa deve fare l'IA:

| Intent | Descrizione |
|--------|-------------|
| `continue` | Continuare le note come paragrafo formale del verbale |
| `summarize` | Riassumere note e discussione in un paragrafo conciso |
| `resolution` | Formulare un chiaro testo di risoluzione dal risultato della votazione |

### Provider IA

La factory `ai.NewProvider` (`internal/infrastructure/ai/factory.go`) genera il provider dalla configurazione:

| Valore provider | Implementazione |
|---------------|----------------|
| `""` / `disabled` | `disabledProvider` – restituisce `ServiceUnavailable` |
| `mock` | `mockProvider` – risposta statica di test |
| `mistral` | `mistralProvider` – Mistral AI (endpoint UE, `mistral-small-latest`) |
| `ollama` | `ollamaProvider` – Ollama locale (`llama3.1`, `localhost:11434`) |
| `llama` / `llama.cpp` | `mistralProvider` con endpoint llama.cpp locale |

Se `LogOnly` è attivo, viene sempre utilizzato `mockProvider` – indipendentemente dal provider configurato.

## Pacchetti di prove (Evidence Service)

L'`EvidenceService` (`internal/application/evidence_service.go`) esporta la catena di hash di audit manipolazionemente sicura di un'assemblea.

### Funzioni

- **`GenerateMeetingEvidencePDF`** – PDF con tutte le voci di audit (timestamp, entità, azione, attore, IP, estratto hash SHA-256) e stato dell'integrità.
- **`GenerateMeetingEvidenceJSON`** – esporto JSON con metadati dell'assemblea, stato della verifica e tutte le voci di audit.
- **`VerifyMeetingEvidenceIntegrity`** – ricalcola ogni catena di hash (`ComputeHashWith` con chiave HMAC) e riporta `valid`, `total_entries` ed eventualmente `broken_at_id`.

La catena di hash utilizza le versioni v1 (SHA-256, senza IP/UserAgent), v2 (SHA-256/HMAC, tutti i campi) e v3 (v2 + `ImpersonatedByID`). Per i dettagli sull'entità di audit si veda `/reference/sicherheit/`.

## Report PDF

Il `ReportService` (`internal/application/report_service.go`) genera PDF con `gofpdf` (jung-kurt/gofpdf). Tutti i report utilizzano lo schema cromatico ResiVote e integrano il logo.

### Report disponibili

<CardGrid>
  <Card title="Verbale dell'assemblea PDF" icon="document">
    `GenerateMeetingProtocolPDF` – verbale completo con punti all'ordine del giorno, risultati delle votazioni, presenza e limitazione del diritto di voto. I punti all'ordine del giorno procedurali di tipo `PROTOCOL` vengono esclusi.
  </Card>
  <Card title="Invito PDF" icon="envelope">
    `GenerateInvitationPDF` – documento di invito con data, luogo e ordine del giorno.
  </Card>
  <Card title="Carta di procura PDF" icon="id-card">
    `GenerateProxyCardPDF` – carta di procura personalizzata per proprietario e assemblea.
  </Card>
  <Card title="Conteggio dei costi PDF" icon="receipt">
    `GenerateCostStatementPDF` – conteggio dei costi con ripartizione percentuale per unità.
  </Card>
  <Card title="Conteggio dei costi CSV" icon="table">
    `GenerateCostStatementCSV` – stesso conteggio come esporto CSV.
  </Card>
  <Card title="Pacchetto di prove PDF" icon="shield">
    `GenerateMeetingEvidencePDF` – catena di hash di audit come PDF (tramite EvidenceService).
  </Card>
</CardGrid>

### Infrastruttura PDF

La generazione dei PDF si basa su `github.com/jung-kurt/gofpdf` (Go puro, nessun binary esterno). Il logo viene caricato tramite `frontend.DistFS` (embed FS); se non trovato, `loadLogo` cerca percorsi alternativi relativi alla directory di lavoro e all'eseguibile.

Per l'**estrazione del testo da PDF di regolamenti** ResiVote utilizza `internal/infrastructure/pdf/extractor.go`: prima `pdftotext` (poppler-utils, `-layout`), poi fallback su `github.com/ledongthuc/pdf`. I PDF scansionati senza livello di testo vengono riconosciuti e rifiutati.

## Collegamento all'audit-log

Ogni azione significativa genera un `AuditEntry` (`internal/domain/entity/audit_entry.go`):

- **Append-only** – le voci non vengono mai aggiornate o cancellate.
- **Catena di hash** – ogni voce rimanda a `PreviousHash` e calcola `Hash` su tutti i campi.
- **Impersonazione** – `ImpersonatedByID` registra quando un super-amministratore assume l'identità di un altro utente (versione hash v3).
- **Eventi del verbale** – cambi di stato dei punti all'ordine del giorno, risultati delle votazioni e finalizzazione del verbale vengono auditati.

Per i dettagli sul calcolo degli hash e la verifica dell'integrità si veda `/reference/sicherheit/`.

## Finalizzare il verbale

Dopo la conclusione dell'assemblea (`CLOSED`), l'amministratore finalizza il verbale:

<Steps>
  1. **Verificare il verbale** – L'amministratore passa in rassegna tutte le note dei punti all'ordine del giorno nell'editor in diretta.
  2. **Generare il PDF** – `GenerateMeetingProtocolPDF` genera il documento verbale vincolante.
  3. **Esportare il pacchetto di prove** – `GenerateMeetingEvidencePDF` o `-JSON` assicura la catena di audit.
  4. **Archiviare l'assemblea** – transizione di stato `CLOSED` → `ARCHIVED`.
</Steps>

<Aside type="warning" title="Nessuna modifica successiva">
Dopo lo stato `ARCHIVED` non sono più possibili modifiche. La catena di hash di audit rende dimostrabile ogni manipolazione successiva.
</Aside>

## Link di approfondimento

<LinkCard title="Sicurezza e audit" href="/reference/sicherheit/" description="Catene di hash, HMAC e verifica dell'integrità." />
<LinkCard title="Quorum e presenza" href="/guides/quorum/" description="Capacità deliberativa e calcolo del quorum." />
