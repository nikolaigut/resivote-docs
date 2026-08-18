---
title: Minutes and Reports
description: Live minutes, AI suggestions, evidence packages, and PDF reports in ResiVote.
---

import { Steps, Aside, CardGrid, Card, LinkCard } from '@astrojs/starlight/components';

ResiVote maintains the meeting minutes live during the session and produces auditable PDF reports at the end. Every minutes action is audited and stored in a tamper-proof hash chain.

## Live Minutes Editor

The backend stores minutes notes per agenda item in the `DiscussionNotes` field of the `AgendaItem` entity (`internal/domain/entity/agenda_item.go`). The frontend editor (Angular, TipTap-based) sends HTML to the API, which persists it as a `text` column.

### Assigning the Minute-Taker

The meeting determines at the start who takes the minutes. The `Meeting` entity holds two fields for this (`internal/domain/entity/meeting.go`):

- **`ProtocolWriterType`** – `OWNER` or `TENANT_ADMIN`
- **`ProtocolWriterOwnerID`** – mandatory for `OWNER`, forbidden for `TENANT_ADMIN`

The `meetingService` validates the combination in `normalizeAndValidateProtocolWriter` (`internal/application/meeting_service.go`). For `OWNER`, it checks that the person is an owner of one of the meeting's communities. Setting the minute-taker automatically closes the procedural agenda item "Assign minute-taker" (`AgendaItemTypeProtocol`) so it does not appear in the final minutes.

### Write Permission

The `canWriteLiveProtocol` method (`internal/application/meeting_service.go`) grants write access when:

1. the caller has the `tenant_admin` role, or
2. `ProtocolWriterType` = `OWNER` and the caller matches `ProtocolWriterOwnerID` and belongs to the meeting.

<Aside type="note" title="Minute-taker only for live meetings">
The minute-taker can only be set for `LIVE_MEETING` meetings, not for `CIRCULAR_RESOLUTION` (circular resolution). The `UpdateProtocolWriter` method rejects changes to closed or archived meetings.
</Aside>

## AI Minutes Suggestions

The `meetingService.SuggestProtocolNotes` service (`internal/application/meeting_ai_service.go`) generates drafts for minutes passages. The caller must have write permission for the live minutes.

### Process

<Steps>
  1. **Collect context** – The service loads the meeting, agenda item, attendance, and voting result.
  2. **Build prompt** – `buildSystemPrompt` and `buildUserPrompt` generate a German system prompt (Swiss STWEG/MEG context) and a user prompt with agenda item, quorum, attendance, and result.
  3. **Call LLM** – `AIProvider.GenerateProtocolNotes` sends `AIGenerateRequest` (SystemPrompt, UserPrompt, MaxTokens 1024, Temperature 0.3) to the configured provider.
  4. **Sanitize HTML** – `sanitizeHTML` filters the response through bluemonday and allows only `<p>`, `<br>`, `<ul>`, `<ol>`, `<li>`, `<strong>`, `<em>`, `<u>`, `<h1>`, `<h2>`, `<h3>`, `<a>`.
  5. **Return result** – `ProtocolNotesSuggestion` with sanitized HTML, `TokensUsed`, and `Provider`.
</Steps>

### Intents

The caller passes an `AIProtocolIntent` (`internal/application/ai_provider.go`) that controls what the AI should do:

| Intent | Description |
|--------|-------------|
| `continue` | Continue notes as a formal minutes paragraph |
| `summarize` | Summarize notes and discussion as a concise paragraph |
| `resolution` | Formulate a clear resolution text from the voting result |

### AI Providers

The `ai.NewProvider` factory (`internal/infrastructure/ai/factory.go`) creates the provider from configuration:

| Provider Value | Implementation |
|---------------|----------------|
| `""` / `disabled` | `disabledProvider` – returns `ServiceUnavailable` |
| `mock` | `mockProvider` – static test response |
| `mistral` | `mistralProvider` – Mistral AI (EU endpoint, `mistral-small-latest`) |
| `ollama` | `ollamaProvider` – local Ollama (`llama3.1`, `localhost:11434`) |
| `llama` / `llama.cpp` | `mistralProvider` with local llama.cpp endpoint |

When `LogOnly` is active, `mockProvider` is always used — regardless of the configured provider.

## Evidence Packages (Evidence Service)

The `EvidenceService` (`internal/application/evidence_service.go`) exports the tamper-proof audit hash chain of a meeting.

### Functions

- **`GenerateMeetingEvidencePDF`** – PDF with all audit entries (timestamp, entity, action, actor, IP, SHA-256 hash excerpt) and integrity status.
- **`GenerateMeetingEvidenceJSON`** – JSON export with meeting metadata, verification status, and all audit entries.
- **`VerifyMeetingEvidenceIntegrity`** – recomputes each hash chain link (`ComputeHashWith` with HMAC key) and reports `valid`, `total_entries`, and optionally `broken_at_id`.

The hash chain uses versions v1 (SHA-256, without IP/UserAgent), v2 (SHA-256/HMAC, all fields), and v3 (v2 + `ImpersonatedByID`). For details on the audit entity, see `/reference/sicherheit/`.

## PDF Reports

The `ReportService` (`internal/application/report_service.go`) generates PDFs with `gofpdf` (jung-kurt/gofpdf). All reports use the ResiVote color scheme and include the logo.

### Available Reports

<CardGrid>
  <Card title="Meeting Minutes PDF" icon="document">
    `GenerateMeetingProtocolPDF` – complete minutes with agenda items, voting results, attendance, and voting rights cap. Procedural `PROTOCOL` agenda items are filtered out.
  </Card>
  <Card title="Invitation PDF" icon="envelope">
    `GenerateInvitationPDF` – invitation document with date, location, and agenda.
  </Card>
  <Card title="Proxy Card PDF" icon="id-card">
    `GenerateProxyCardPDF` – personalized proxy card per owner and meeting.
  </Card>
  <Card title="Cost Statement PDF" icon="receipt">
    `GenerateCostStatementPDF` – cost statement with percentage breakdown per unit.
  </Card>
  <Card title="Cost Statement CSV" icon="table">
    `GenerateCostStatementCSV` – the same statement as a CSV export.
  </Card>
  <Card title="Evidence Package PDF" icon="shield">
    `GenerateMeetingEvidencePDF` – audit hash chain as PDF (via EvidenceService).
  </Card>
</CardGrid>

### PDF Infrastructure

PDF generation is based on `github.com/jung-kurt/gofpdf` (pure Go, no external binaries). The logo is loaded via `frontend.DistFS` (embed FS); if not found, `loadLogo` searches alternative paths relative to the working directory and the executable.

For **text extraction from regulations PDFs**, ResiVote uses `internal/infrastructure/pdf/extractor.go`: first `pdftotext` (poppler-utils, `-layout`), then fallback to `github.com/ledongthuc/pdf`. Scanned PDFs without a text layer are detected and rejected.

## Audit Log Integration

Every significant action creates an `AuditEntry` (`internal/domain/entity/audit_entry.go`):

- **Append-only** – entries are never updated or deleted.
- **Hash chain** – each entry references `PreviousHash` and computes `Hash` over all fields.
- **Impersonation** – `ImpersonatedByID` logs when a super admin assumes another user's identity (hash version v3).
- **Minutes events** – agenda item state transitions, voting results, and minutes finalization are audited.

For details on hash computation and integrity verification, see `/reference/sicherheit/`.

## Finalize the Minutes

After the meeting concludes (`CLOSED`), the administrator finalizes the minutes:

<Steps>
  1. **Review minutes** – The administrator goes through all agenda item notes in the live editor.
  2. **Generate PDF** – `GenerateMeetingProtocolPDF` produces the binding minutes document.
  3. **Export evidence package** – `GenerateMeetingEvidencePDF` or `-JSON` secures the audit chain.
  4. **Archive the meeting** – state transition `CLOSED` → `ARCHIVED`.
</Steps>

<Aside type="warning" title="No Subsequent Changes">
After the `ARCHIVED` state, no further changes are possible. The audit hash chain makes any subsequent manipulation detectable.
</Aside>

## Further Reading

<LinkCard title="Security and Audit" href="/reference/sicherheit/" description="Hash chains, HMAC, and integrity verification." />
<LinkCard title="Quorum and Presence" href="/guides/quorum/" description="Resolution capability and quorum calculation." />
