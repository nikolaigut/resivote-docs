---
title: Sicurezza e conformità
description: Documentazione di riferimento dell'architettura di sicurezza di ResiVote — autenticazione, isolamento multi-tenant, cifratura, audit-log e conformità.
---

import { Aside, Steps, LinkCard } from '@astrojs/starlight/components';

ResiVote implementa Defense-in-Depth su più strati: autenticazione OIDC, PostgreSQL Row-Level Security, cifratura dei documenti per mandante, catena di hash di audit-log immutabile e guard di configurazione critici per la produzione.

## Autenticazione

### ZITADEL OIDC

L'autenticazione avviene tramite ZITADEL OIDC. Il `ZITADELValidator` (`internal/infrastructure/auth/zitadel.go`) valida i JWT access-token:

1. **Validazione della firma** — firma RSA contro le JWKS (`{BaseURL}/oauth/v2/keys`), con cache di 5 minuti e retry con backoff esponenziale (100ms, 500ms, 2s).
2. **Validazione dell'issuer** — il claim `iss` deve corrispondere a `ExpectedIssuer` (predefinito: `BaseURL`).
3. **Validazione dell'audience** — il claim `aud` deve contenere `ExpectedAudience` (predefinito: `ProjectID`).
4. **Arricchimento userinfo** — se l'e-mail non è contenuta nell'access-token, viene interrogato l'endpoint userinfo di ZITADEL (`{BaseURL}/oidc/v1/userinfo`) e messo in cache per 5 minuti.

L'`AuthMiddleware` (`internal/interfaces/http/middleware/auth.go`) estrae il token dall'header `Authorization` o dal parametro di query `token` (per WebSocket).

<Aside type="warning" title="Bypass JWT solo in non-produzione">
Nei build non di produzione (senza `-tags production`) esiste un fallback che analizza i claim senza validazione della firma, se le JWKS sono irraggiungibili. Nei build di produzione (`-tags production`) questo codice è **completamente assente** — non viene compilato nel binary. Il controllo all'avvio in `main.go` rifiuta l'avvio se `APP_ENV=production` ma il build-tag manca.
</Aside>

### Bootstrap ZITADEL e admin-client

In ambienti dev, `EnsureDevZITADELSetup` (`zitadel_bootstrap.go`) crea in modo idempotente progetto, client OIDC, utenti e action-script. Il bootstrap utilizza un PAT (Personal Access Token) per l'autenticazione della macchina.

Lo `ZITADELAdminClient` (`zitadel_admin.go`) gestisce gli utenti tramite la ZITADEL Management API. Due backend:

- **gRPC** — quando `ZITADEL_KEY_PATH` punta a un file JSON di chiave macchina (produzione).
- **REST** — quando `ZITADEL_PAT` è impostato e non è disponibile una chiave macchina (dev).
- **No-Op** — quando né chiave né PAT sono configurati (dev senza integrazione ZITADEL).

## Isolamento multi-tenant

### PostgreSQL Row Level Security (RLS)

Ogni tabella tenant-scoped ha una policy RLS `tenant_isolation_policy`. La policy confronta `tenant_id` con la variabile di sessione `app.current_tenant_id`:

```sql
USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
```

La migrazione `000004` integra tutte le policy con clausole `WITH CHECK`, che validano anche l'accesso in scrittura (INSERT/UPDATE). Le tabelle senza colonna `tenant_id` diretta (`proxy_instructions`, `signature_units`) utilizzano subquery EXISTS sulla tabella parent.

### DBTransactionMiddleware

La `DBTransactionMiddleware` (`internal/interfaces/http/middleware/db_tx.go`) apre per ogni request una transazione GORM e imposta `SET LOCAL app.current_tenant_id`. La transazione viene confermata in caso di successo dell'handler, annullata in caso di errore. Senza Tenant-ID nel contesto (route super-admin) `SET LOCAL` viene saltato — le policy RLS falliscono chiuse (nessuna riga).

### TenantScopedDB

La `TenantScopedDB` (`internal/infrastructure/persistence/tenant_scoped_db.go`) è un'interfaccia ristretta su `*gorm.DB` che non espone `Exec`. Questo impedisce ai chiamanti di invocare `SetTenantContext` a metà transazione e cambiare l'ambito mandante RLS. La protezione primaria sono le policy RLS fail-closed; l'interfaccia è Defense-in-Depth.

## Cifratura dei documenti

### DEK per mandante

Ogni mandante riceve una propria chiave di cifratura dei dati (DEK), generata come valore CSPRNG di 32 byte. Il DEK viene avvolto con la chiave master tramite AES-GCM e salvato come `encrypted_dek` nella tabella `tenants` (`tenant_key.go`).

La generazione è atomica: `UpdateIfDEKMissing` imposta il DEK solo se `encrypted_dek IS NULL`, in modo che chiamate concorrenti al primo utilizzo non si sovrascrivano.

### Chiave per documento

La chiave del documento viene derivata tramite HKDF-SHA256 dal DEK del mandante e dall'ID del documento (`document_encryption.go`):

```
HKDF-SHA256(dek, salt=documentID[:], info="resivote-doc-v1") → 32-byte key
```

La cifratura utilizza AES-GCM con nonce fresco per documento. Il formato è `nonce || ciphertext+tag`.

<Aside type="warning" title="DOCUMENT_ENCRYPTION_MASTER_KEY">
La variabile d'ambiente `DOCUMENT_ENCRYPTION_MASTER_KEY` deve essere una chiave AES di 32 byte codificata in base64. Senza questa chiave la cifratura dei documenti è disattivata. Generazione: `openssl rand -base64 32`.
</Aside>

## Audit-Log

### Catena di hash immutabile

Ogni `AuditEntry` contiene `PreviousHash` e `Hash`, che formano una catena di hash concatenata. Tre versioni di hash:

| Versione | Algoritmo | Campi |
|---|---|---|
| v1 | SHA-256 semplice (deprecato) | Campi principali, senza IP/UserAgent |
| v2 | SHA-256 o HMAC-SHA-256 | Tutti i campi incl. IP/UserAgent |
| v3 | SHA-256 o HMAC-SHA-256 | v2 + `ImpersonatedByID` |

`ComputeHashWith` dispatcha in base a `HashVersion`. In produzione `AUDIT_HASH_KEY` (≥32 byte) è obbligatorio — senza di esso la catena degrada a SHA-256 semplice, che non rende dimostrabile la manipolazione a livello di database (violazione ZertES/nDSG).

### Immutabilità a livello DB

I trigger PostgreSQL bloccano `UPDATE`, `DELETE` e `TRUNCATE` su `audit_entries`, `signatures` e `signature_units` (migrazione `000001`). Un event-trigger (`audit_entries_ddl_guard`) blocca DDL su `audit_entries`, eccetto in modalità manutenzione (`app.maintenance=on`), che viene registrata in `audit_maintenance_events`.

### Fail-Closed e verifica

| Meccanismo | Configurazione | Predefinito |
|---|---|---|
| `FailClosed` | `AUDIT_FAIL_CLOSED` | `true` |
| `FailClosedThreshold` | `AUDIT_FAIL_CLOSED_THRESHOLD` | 3 |
| `VerifyInterval` | `AUDIT_VERIFY_INTERVAL` | 5 minuti |

Con `FailClosed=true` il fallimento della verifica all'avvio porta a `os.Exit(1)`. La verifica periodica richiede `FailClosedThreshold` rilevamenti consecutivi di manipolazione prima che il server venga terminato (mitigazione DoS: una singola voce corrotta non fa crashare immediatamente il service). La verifica all'avvio ha sempre Threshold=1.

Il flusso di avvio verifica inoltre i trigger di imposizione dell'immutabilità e lo stato non-superuser del ruolo DB.

## Sicurezza del token di check-in

I token di check-in QR vengono firmati con HMAC-SHA-256 (`CheckInTokenService`). La chiave di firma è `CHECKIN_TOKEN_SIGNING_KEY`.

<Aside type="warning" title="Variabili d'ambiente critiche per la produzione">
In produzione (`APP_ENV=production`) le seguenti variabili d'ambiente sono **obbligatorie** — il server rifiuta l'avvio in caso di mancanza o valore troppo breve:

- **`AUDIT_HASH_KEY`** — ≥32 byte, HMAC-SHA-256 per la catena di hash di audit (ZertES/nDSG)
- **`CHECKIN_TOKEN_SIGNING_KEY`** — ≥32 byte, HMAC-SHA-256 per i token di check-in QR
- **`APP_ENV`** — deve essere impostato esplicitamente (nessun predefinito)
- **`DOCUMENT_ENCRYPTION_MASTER_KEY`** — chiave AES di 32 byte codificata base64

Generazione: `openssl rand -base64 32`
</Aside>

La durata di validità del token è `CHECKIN_TOKEN_EXPIRY` (predefinito 30 minuti). La generazione del token è rate-limited (5 req/s, burst 10) per utente+mandante. La validazione del token è rate-limited (10 req/s, burst 20) per IP.

## Security-Header

La `SecurityHeadersMiddleware` (`internal/interfaces/http/middleware/security.go`) imposta i seguenti header:

| Header | Valore |
|---|---|
| `Content-Security-Policy` | `default-src 'self'`; issuer OIDC in `connect-src` |
| `Strict-Transport-Security` | `max-age=31536000` (solo HTTPS) |
| `X-Frame-Options` | `SAMEORIGIN` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `accelerometer=(), camera=(), geolocation=(), ...` |

La CSP permette `style-src 'unsafe-inline'` (stili inline di Angular) ma non `script-src 'unsafe-inline'`. L'URL dell'issuer OIDC viene sanitizzato prima dell'inserimento nella CSP (validazione dello schema, rifiuto dei metacaratteri CSP).

## Body-Limit e Rate-Limiting

- **Body-Limit** — globale `SERVER_BODY_LIMIT` (predefinito 50M). Route di upload utilizzano `STORAGE_MAX_UPLOAD_SIZE` (predefinito 50M). Import owner: 10M. Check-in con firma: 5M.
- **Rate-Limiting** — `golang.org/x/time/rate` con store in-memory:
  - `/auth/config`: 10 req/s, burst 20 (per IP)
  - `/api/v1/me`: 10 req/s, burst 20 (per IP)
  - Route super-admin: 0.5 req/s, burst 30 (per utente)
  - Generazione token QR: 5 req/s, burst 10 (per utente+mandante)
  - Esporto audit/pacchetto di prove: 10 req/s, burst 20 (per utente+mandante)
  - Formulario di contatto: 0.083 req/s, burst 2 (per IP)

## Imposizione di APP_ENV

- `APP_ENV` deve essere impostato esplicitamente come variabile d'ambiente — `config.Load()` restituisce `ErrAppEnvNotSet` in caso di mancanza.
- In produzione `.env` **non** viene mai caricato — tutta la configurazione deve provenire dall'ambiente del container o del processo.
- In non-produzione `.env` viene caricato per comodità; le variabili env esplicite hanno la precedenza.
- Gli attacchi di omograph Unicode su `APP_ENV` vengono respinti (controllo `isASCII`).

## Immutabilità dei voti

I voti sono immutabili (`vote.go`). In caso di modifica il vecchio voto viene marcato come `IsSuperseded=true` e viene creato un nuovo voto. `IsActive()` restituisce `!IsSuperseded`. Il motore del quorum e il calcolo dei risultati considerano solo i voti attivi.

## Prova di manipolabilità delle firme

Le firme vengono salvate in una tabella separata (`signatures`), non incorporate in `Attendance`. I trigger DB bloccano `UPDATE`, `DELETE` e `TRUNCATE`. I dati dell'immagine della firma (`image_data`, `bytea`) sono così verificabili in modo indipendente e manipolazionemente sicuri.

## CORS

La `CORSMiddleware` (`internal/interfaces/http/middleware/cors.go`) valida le origin rispetto a una lista configurata. Origin predefinite (`defaultCORSOrigins` in `config.go`):

- Produzione: `https://app.resivote.ch`, `https://resivote.ch`, `https://www.resivote.ch`
- Non-produzione: inoltre `http://localhost:4200`, `http://localhost:8081`, `http://localhost:4321`

In caso di lista di origin vuota, le richieste cross-origin vengono rifiutate fail-closed. `AllowCredentials` è disattivato per origin wildcard.

## Riferimenti giuridici svizzeri

Il codice referenzia le seguenti basi giuridiche svizzere:

| Riferimento | Contesto |
|---|---|
| Art. 647b/d/e ZGB | Quorum a maggioranza qualificata (voti per testa e di valore) |
| Art. 647e ZGB | Quorum unanime (assenze come NO implicito) |
| Art. 712g ZGB | Limitazione del diritto di voto, maggioranza qualificata per STWEG |
| Art. 712m cpv. 2 ZGB | Risoluzione circolare (Circular Resolution) |
| Art. 712o ZGB | Un'unità, un voto per testa |
| ZertES | Catena di hash di audit con HMAC-SHA-256 (prova di integrità) |
| nDSG | Integrità dei dati e protezione dalla manipolazione |

<LinkCard title="Configurazione" description="Tutte le variabili d'ambiente e i config-struct" href="/reference/konfiguration/" />
<LinkCard title="Check-in" description="Guida al check-in con QR-Code e firma" href="/guides/checkin/" />
<LinkCard title="Verbale" description="Redazione del verbale e audit-trail" href="/guides/protokoll/" />
