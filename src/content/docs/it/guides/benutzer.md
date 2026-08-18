---
title: Utenti e autorizzazioni
description: Ruoli, isolamento per mandante, gestione dei proprietari e impersonazione in ResiVote.
---

import { Aside, CardGrid, Card, LinkCard } from '@astrojs/starlight/components';

ResiVote separa l'identità di autenticazione (`User`) dall'identità di proprietà (`Owner`). I ruoli vengono salvati nel database in relazione al mandante, non derivati dai claim JWT. Tutti i dati sono isolati per mandante.

## User vs Owner

ResiVote disaccoppia deliberatamente l'identità di login dalla proprietà:

- **`User`** (`internal/domain/entity/user.go`) – l'identità di autenticazione. Contiene la `sub` di ZITADEL (`ExternalUserID`), e-mail, nome e un ruolo. `TenantID` è nullable (`nil` per `super_admin`).
- **`Owner`** (`internal/domain/entity/owner.go`) – l'identità di proprietà. Contiene nome, e-mail, telefono e una chiave esterna opzionale `UserID` verso la tabella `users`. Un Owner può possedere unità in diverse comunità dello stesso mandante.

Il collegamento avviene al primo login: `LinkAllExternalUsersByEmail` collega la `sub` di ZITADEL a tutti i record User con la stessa e-mail che non hanno ancora un `ExternalUserID`.

### Proprietà dell'Owner

| Campo | Significato |
|------|-------------|
| `ExternalUserID` | Identità globale (tra mandanti) |
| `UserID` | FK opzionale a `users` (nullable per dati legacy) |
| `IsArchived` / `ArchivedAt` | Proprietario marcato come archiviato |
| `TenantID` | Mandante – i proprietari possono possedere unità solo all'interno dello stesso mandante |

## Ruoli

ResiVote distingue quattro ruoli (`internal/domain/entity/user.go`):

### tenant_admin

L'amministratore del mandante prepara le assemblee, invita i partecipanti, gestisce le comunità e le unità e redige il verbale. Vede solo i dati del proprio mandante (`TenantID` impostato).

### super_admin

Il super-amministratore è globale (`TenantID = nil`). Gestisce i mandanti, ha accesso alle route super-admin e può impersonare gli utenti. Il ruolo `super_admin` **non** viene salvato in `UserTenantRole`, ma rimane un claim JWT globale.

### meeting_chair

Il presidente conduce l'assemblea tramite la dashboard del presidente: apre e chiude i punti all'ordine del giorno, avvia le votazioni, concede override del quorum e controlla la visibilità dei risultati in diretta. Una guardia frontend (`chair guard`) protegge le funzioni del presidente.

### owner

Il proprietario partecipa alle assemblee, vota e consulta i propri documenti nel portale. Il ruolo di proprietario è il ruolo predefinito per le persone con diritto di voto.

## UserTenantRole

`UserTenantRole` (`internal/domain/entity/user_tenant_role.go`) è la **fonte di verità** per le assegnazioni dei mandanti – non i claim JWT. Un utente può avere più voci, una per mandante.

<Aside type="warning" title="super_admin non salvato qui">
Il ruolo `super_admin` non viene deliberatamente archiviato in `UserTenantRole`. Rimane un claim JWT globale, poiché i super-amministratori operano tra mandanti.
</Aside>

Ruoli consentiti in `UserTenantRole`: `tenant_admin`, `meeting_chair`, `owner`.

## Isolamento per mandante

ResiVote è multi-tenant. Ogni entità porta un campo `TenantID`:

- `Owner.TenantID` – i proprietari sono legati al mandante.
- `Document.TenantID` – i documenti sono isolati per mandante.
- `Folder.TenantID` – le cartelle sono isolate per mandante.
- `Meeting.TenantID` – le assemblee appartengono a un mandante.
- `AuditEntry.TenantID` – gli audit-log sono isolati per mandante.

I super-amministratori (`TenantID = nil`) operano globalmente. Tutti gli altri utenti vedono solo i dati del proprio mandante. L'isolamento per mandante viene applicato a livello di database (Row-Level Security) e a livello di applicazione (`ctxutil.TenantIDFromContext`).

## Gestire i proprietari

I proprietari sono persone o organizzazioni con diritto di voto che possiedono una o più unità abitative. Vengono registrati con nome, indirizzo ed e-mail e associati alle unità corrispondenti tramite `Ownership`.

Un proprietario può possedere unità in diverse comunità dello stesso mandante. Le quote di proprietà (`ShareNumerator`/`ShareDenominator`) determinano la quota di valore. `IsPrimaryVoter` marca il votante principale di un'unità.

I proprietari archiviati (`IsArchived = true`) vengono nascosti nella gestione, ma conservati per i verbali storici.

## Mandatari

Un proprietario può incaricare un'altra persona con una procura (`Proxy`) di partecipare all'assemblea e votare al suo posto. Le procure possono essere concesse liberamente o con mandato.

Il `VoteValidator` garantisce che solo il mandatario (`GranteeID`) voti digitalmente – il mandante della procura (`GrantorID`) viene bloccato finché esiste una procura attiva. Le espressioni di voto mandate devono corrispondere all'istruzione (`MandatedVote`).

## Impersonazione

I super-amministratori possono assumere l'identità di un altro utente (`internal/application/impersonation_service.go`). Il processo utilizza ZITADEL Token Exchange (RFC 8693):

- Il super-amministratore scambia il proprio access-token contro un nuovo JWT che assume l'identità dell'utente di destinazione.
- Il JWT risultante contiene un claim `act` che identifica chi effettua l'impersonazione.
- Ogni azione durante l'impersonazione viene registrata nell'audit-log con `ImpersonatedByID` (versione hash v3).

<Aside type="note" title="Tracciabilità completa">
L'impersonazione è tracciabile nell'audit-log senza lacune. La catena di hash (v3) vincola l'identità di chi effettua l'impersonazione in ogni voce di audit.
</Aside>

## Garantire l'accesso in modo sicuro

Ogni utente accede tramite ZITADEL (OIDC). L'autenticazione avviene tramite link personali o codici di invito (`RedeemInvitation`). Gli amministratori del mandante vedono solo i dati del proprio mandante.

Per i dettagli sulla catena di hash di audit e la verifica dell'integrità si veda `/reference/sicherheit/`.

## Link di approfondimento

<LinkCard title="Riferimento dei ruoli" href="/reference/rollen/" description="Definizioni dettagliate di ruoli e autorizzazioni." />
<LinkCard title="Sicurezza e audit" href="/reference/sicherheit/" description="Catene di hash, registrazione dell'impersonazione e verifica dell'integrità." />
