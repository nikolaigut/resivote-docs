---
title: Ruoli e autorizzazioni
description: Documentazione di riferimento dei ruoli di ResiVote, del modello di autorizzazioni, delle guardie frontend e dell'impersonazione.
---

import { Aside, LinkCard, Steps } from '@astrojs/starlight/components';

ResiVote distingue quattro ruoli con autorizzazioni graduate. I ruoli vengono risolti tramite claim JWT di ZITADEL e la tabella `user_tenant_roles`. Le guardie frontend completano il RBAC del backend con protezione del routing lato client.

## Ruoli

I ruoli sono definiti in `internal/domain/entity/user.go`:

| Ruolo | Ambito | Descrizione |
|---|---|---|
| `super_admin` | Globale | Amministrazione della piattaforma, gestione dei mandanti, billing |
| `tenant_admin` | Per mandante | Gestione di tutte le risorse del mandante |
| `meeting_chair` | Per mandante | Presidenza dell'assemblea, check-in su tablet, redazione del verbale |
| `owner` | Per mandante | Proprietario, espressione del voto, accesso al portale |

## User vs. Owner

ResiVote separa l'identità di autenticazione dalla proprietà:

- **User** (tabella `users`): identità di autenticazione con ZITADEL `sub`, e-mail e ruolo. Un User può essere proprietario, ma non deve esserlo.
- **Owner** (tabella `owners`): record del proprietario con quote di proprietà. Ha un FK opzionale `UserID` sulla tabella `users`. Gli Owner legacy senza `UserID` vengono collegati tramite `ExternalUserID` (ZITADEL sub).

Un Owner può appartenere a più mandanti (tramite `ExternalUserID`), ma possedere proprietà sempre solo all'interno dello stesso mandante.

## UserTenantRole — Fonte di verità

La tabella `user_tenant_roles` è la fonte vincolante per le assegnazioni dei mandanti — **non** i claim JWT. Un User può avere più entry `UserTenantRole`, una per mandante.

<Aside type="warning" title="super_admin è globale">
`super_admin` non viene salvato in `user_tenant_roles`. Questo ruolo rimane un claim JWT globale, verificato da `claims.IsSuperAdmin()` in `RequireSuperAdmin`. Il `TenantID` nel record `User` è nullable per `super_admin`.
</Aside>

## Isolamento per mandante

La `TenantMiddleware` risolve l'appartenenza al mandante nel seguente ordine:

1. Claim JWT `TenantMemberships` (primario — impostato tramite ZITADEL Action Script)
2. `TenantMembershipCache` (cache in-process su `user_tenant_roles`)
3. Tabella di join `user_tenant_roles` (fallback DB in caso di cache-miss)
4. Tabella `users` singolo `TenantID` (fallback legacy)
5. Tabella `owners` (fallback legacy per dati precedenti alla tabella users)

I super-amministratori (non impersonati) ottengono accesso universale con tutti i ruoli (`super_admin`, `tenant_admin`, `meeting_chair`, `owner`). La PostgreSQL RLS impone l'isolamento per mandante addizionalmente a livello di database.

## Autorizzazioni per ruolo

Le autorizzazioni sono definite dalle chiamate `RequireRole` in `router.go` e dalle guardie frontend in `app.routes.ts`.

### super_admin

Gestione globale della piattaforma. Route sotto `/api/v1/tenants` e `/api/v1/admin/*` protette con `RequireSuperAdmin`.

- Creare, elencare, modificare, sospendere, attivare, cancellare mandanti
- Recuperare metriche dei mandanti
- Attivare/disattivare le funzioni portale e meeting del mandante
- Gestire utenti (ZITADEL: creare, assegnare ruoli)
- Assegnazioni multi-tenant degli utenti (`/admin/users/:userId/tenant-assignments`)
- Health della piattaforma e integrità dell'audit (`/admin/system/health`, `/admin/system/audit-integrity`)
- Metriche billing SaaS (`/admin/billing/tenants`)
- Avviare impersonazione (`/admin/impersonate`)

Route frontend: `/super-admin/*` con `superAdminGuard`.

### tenant_admin

Gestione a livello di mandante. Route con `RequireRole("tenant_admin")`.

- Creare/modificare/cancellare community e unità
- Gestire collegamenti tra community (STWEG↔MEG)
- Gestire development (complessi immobiliari)
- Creare, importare (Excel), archiviare, modificare owner
- Gestire ownership
- Creare meeting e controllare l'intero ciclo di vita (pubblicare, aprire, avviare, chiudere, archiviare)
- Creare e controllare agenda-item
- Eseguire check-in (manuale, QR-Code, firma)
- Registrare voti analogici e voti analogici collettivi
- Gestire ripartizione dei costi e conteggi
- Consultare ed esportare audit-log (PDF/JSON)
- Scaricare e verificare il pacchetto di prove
- Gestire documenti e cartelle del portale
- Gestire forum e ticket
- Creare e inviare messaggi (broadcast)
- Consultare le fatture

Route frontend: `/admin/*` con `roleGuard(['tenant_admin', 'super_admin'])`.

### meeting_chair

Presidenza dell'assemblea. Route con `RequireRole("meeting_chair")` o `RequireRole("tenant_admin", "meeting_chair")`.

- Consultare meeting ed eseguire transizioni di stato (aprire, avviare, chiudere)
- Controllare agenda-item (presentare, aprire, chiudere, saltare, pre-voting)
- Modificare le note del verbale e richiedere proposte IA
- Controllare il timer di presentazione
- Eseguire check-in (manuale, QR-Code, firma)
- Registrare voti analogici e voti analogici collettivi
- Gestire allegati e slide
- Scaricare e verificare il pacchetto di prove

Route frontend: `/meeting/:id/chair` e `/meeting/:id/tablet-checkin` con `chairGuard`.

### owner

Proprietario con accesso al portale e diritto di voto. Route con `RequireRole("owner")`.

- Consultare meeting e agenda-item (solo proprie community)
- Votare (`CastVote`)
- Consultare il proprio voto (`GetMyVote`)
- Self-check-in (`SelfCheckIn`)
- Concedere e revocare procure
- Scaricare PDF di invito e carta di procura
- Scaricare il PDF del verbale
- Consultare e scaricare documenti del portale
- Creare e rispondere a post del forum
- Creare e rispondere a ticket
- Consultare messaggi
- Gestire notifiche

Route frontend: `/portal/*` con `portalEnabledGuard` e `tenantSelectionGuard`.

## Guardie frontend

Le guardie del router Angular (`frontend/src/app/app.routes.ts`) proteggono il routing lato client:

| Guard | Funzione |
|---|---|
| `authGuard` | Verifica l'autenticazione OIDC |
| `chairGuard` | Verifica il ruolo `meeting_chair` |
| `superAdminGuard` | Verifica il ruolo `super_admin` |
| `superAdminRedirectGuard` | Reindirizza i super-admin alla dashboard super-admin |
| `roleGuard(['tenant_admin', 'super_admin'])` | Verifica ruoli specifici |
| `portalEnabledGuard` | Verifica se il portale è attivato per il mandante |
| `portalRedirectGuard` | Reindirizza gli owner al portale |
| `tenantSelectionGuard` | Verifica se è stato selezionato un mandante |
| `meetingRoleRedirectGuard` | Reindirizza alla vista meeting corretta in base al ruolo |

## Middleware Community-Access

La `CommunityAccessMiddleware` limita l'accesso degli owner alle community, unità, meeting e agenda-item con cui sono effettivamente collegati. Il middleware carica i dati di ownership dell'owner e salva i set di ID community e unità nel contesto della richiesta.

`tenant_admin` e `meeting_chair` sono esentati — possono accedere a tutte le risorse all'interno del proprio mandante.

I titolari di procura (Proxy-Grantee) ottengono accesso ai meeting le cui community rappresentano tramite una procura attiva — anche se non sono owner diretti nella community.

## Impersonazione

Un super-admin può assumere l'identità di un altro utente (impersonazione) tramite ZITADEL Token Exchange (RFC 8693). Il service `ImpersonationService` (`internal/application/impersonation_service.go`) scambia il token del super-admin contro un JWT che contiene un claim `act` con l'identità del super-admin.

<Aside type="note" title="Misure di sicurezza">
- `RequireSuperAdmin` blocca i token impersonati — nessun privilege escalation possibile.
- `RequireSuperAdminOrImpersonated` permette solo l'endpoint di stop-impersonation per i token impersonati.
- La `TenantMiddleware` impone per i token impersonati la normale risoluzione dell'appartenenza dell'utente di destinazione.
- L'`ImpersonatorSub` viene salvato nel contesto (`WithImpersonatorID`) e nell'audit-log (`ImpersonatedByID`).
</Aside>

## Cache dell'appartenenza al mandante

Il `TenantMembershipCache` (`internal/application/tenant_membership_cache.go`) evita query DB ripetute nella `TenantMiddleware`, quando i claim JWT non contengono `tenant_memberships` (caso di produzione — ZITADEL fornisce solo autenticazione, l'appartenenza al mandante si trova nel DB).

| Configurazione | Variabile env | Predefinito |
|---|---|---|
| `Enabled` | `TENANT_CACHE_ENABLED` | `true` |
| `TTL` | `TENANT_CACHE_TTL` | 5 minuti |

La cache viene invalidata in caso di modifiche dei ruoli, sospensione del mandante e demo-reset.

<LinkCard title="Gestire gli utenti" description="Guida alla gestione degli utenti e all'assegnazione dei ruoli" href="/guides/benutzer/" />
<LinkCard title="Sicurezza e conformità" description="Autenticazione, RLS, cifratura e audit" href="/reference/sicherheit/" />
