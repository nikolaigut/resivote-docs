---
title: Procès-verbal et rapports
description: Procès-verbal en direct, suggestions IA, paquets de preuve et rapports PDF dans ResiVote.
---

import { Steps, Aside, CardGrid, Card, LinkCard } from '@astrojs/starlight/components';

ResiVote tient le procès-verbal de l'assemblée en direct pendant la séance et génère à la fin des rapports PDF vérifiables. Chaque action du procès-verbal est auditée et stockée dans une chaîne de hachage infalsifiable.

## Éditeur de procès-verbal en direct

Le backend stocke les notes du procès-verbal par point de l'ordre du jour dans le champ `DiscussionNotes` de l'entité `AgendaItem` (`internal/domain/entity/agenda_item.go`). L'éditeur frontend (Angular, basé sur TipTap) envoie du HTML à l'API, qui le persiste dans une colonne `text`.

### Désigner le rédacteur du procès-verbal

L'assemblée détermine au début qui rédige le procès-verbal. L'entité `Meeting` contient deux champs à cet effet (`internal/domain/entity/meeting.go`) :

- **`ProtocolWriterType`** – `OWNER` ou `TENANT_ADMIN`
- **`ProtocolWriterOwnerID`** – obligatoire pour `OWNER`, interdit pour `TENANT_ADMIN`

Le service `meetingService` valide la combinaison dans `normalizeAndValidateProtocolWriter` (`internal/application/meeting_service.go`). Pour `OWNER`, il vérifie que la personne est propriétaire dans l'une des communautés de l'assemblée. La désignation du rédacteur du procès-verbal ferme automatiquement le point procédural « Désignation du rédacteur du procès-verbal » (`AgendaItemTypeProtocol`) afin qu'il n'apparaisse pas dans le procès-verbal final.

## Droit d'écriture

La méthode `canWriteLiveProtocol` (`internal/application/meeting_service.go`) accorde l'accès en écriture si :

1. l'appelant a le rôle `tenant_admin`, ou
2. `ProtocolWriterType` = `OWNER` et l'appelant correspond à `ProtocolWriterOwnerID` et appartient à l'assemblée.

<Aside type="note" title="Rédacteur du procès-verbal uniquement pour les assemblées en direct">
Le rédacteur du procès-verbal ne peut être désigné que pour les assemblées `LIVE_MEETING`, pas pour `CIRCULAR_RESOLUTION` (résolution circulaire). La méthode `UpdateProtocolWriter` rejette les modifications sur des assemblées clôturées ou archivées.
</Aside>

## Suggestions de procès-verbal par IA

Le service `meetingService.SuggestProtocolNotes` (`internal/application/meeting_ai_service.go`) génère des brouillons de passages de procès-verbal. L'appelant doit posséder le droit d'écriture sur le procès-verbal en direct.

### Déroulement

<Steps>
  1. **Collecter le contexte** – Le service charge l'assemblée, le point de l'ordre du jour, la présence et le résultat du vote.
  2. **Construire le prompt** – `buildSystemPrompt` et `buildUserPrompt` génèrent un prompt système allemand (contexte STWEG/MEG suisse) et un prompt utilisateur avec le point de l'ordre du jour, le quorum, la présence et le résultat.
  3. **Appeler le LLM** – `AIProvider.GenerateProtocolNotes` envoie `AIGenerateRequest` (SystemPrompt, UserPrompt, MaxTokens 1024, Temperature 0.3) au provider configuré.
  4. **Nettoyer le HTML** – `sanitizeHTML` filtre la réponse via bluemonday et n'autorise que `<p>`, `<br>`, `<ul>`, `<ol>`, `<li>`, `<strong>`, `<em>`, `<u>`, `<h1>`, `<h2>`, `<h3>`, `<a>`.
  5. **Retourner le résultat** – `ProtocolNotesSuggestion` avec le HTML nettoyé, `TokensUsed` et `Provider`.
</Steps>

## Intents

L'appelant transmet un `AIProtocolIntent` (`internal/application/ai_provider.go`) qui contrôle ce que l'IA doit faire :

| Intent | Description |
|--------|-------------|
| `continue` | Poursuivre les notes comme un paragraphe formel de procès-verbal |
| `summarize` | Résumer les notes et la discussion en un paragraphe concis |
| `resolution` | Formuler un texte de résolution clair à partir du résultat du vote |

### Provider IA

La factory `ai.NewProvider` (`internal/infrastructure/ai/factory.go`) crée le provider à partir de la configuration :

| Valeur du provider | Implémentation |
|---------------|----------------|
| `""` / `disabled` | `disabledProvider` – renvoie `ServiceUnavailable` |
| `mock` | `mockProvider` – réponse de test statique |
| `mistral` | `mistralProvider` – Mistral AI (endpoint UE, `mistral-small-latest`) |
| `ollama` | `ollamaProvider` – Ollama local (`llama3.1`, `localhost:11434`) |
| `llama` / `llama.cpp` | `mistralProvider` avec endpoint llama.cpp local |

Si `LogOnly` est actif, `mockProvider` est toujours utilisé – indépendamment du provider configuré.

## Paquets de preuve (Evidence Service)

Le `EvidenceService` (`internal/application/evidence_service.go`) exporte la chaîne de hachage d'audit infalsifiable d'une assemblée.

### Fonctions

- **`GenerateMeetingEvidencePDF`** – PDF avec toutes les entrées d'audit (horodatage, entité, action, acteur, IP, extrait du hash SHA-256) et statut d'intégrité.
- **`GenerateMeetingEvidenceJSON`** – export JSON avec les métadonnées de l'assemblée, le statut de vérification et toutes les entrées d'audit.
- **`VerifyMeetingEvidenceIntegrity`** – recalcul de chaque chaîne de hachage (`ComputeHashWith` avec clé HMAC) et rapporte `valid`, `total_entries` et le cas échéant `broken_at_id`.

La chaîne de hachage utilise les versions v1 (SHA-256, sans IP/UserAgent), v2 (SHA-256/HMAC, tous les champs) et v3 (v2 + `ImpersonatedByID`). Détails sur l'entité d'audit voir `/reference/sicherheit/`.

## Rapports PDF

Le `ReportService` (`internal/application/report_service.go`) génère des PDF avec `gofpdf` (jung-kurt/gofpdf). Tous les rapports utilisent le schéma de couleurs ResiVote et intègrent le logo.

### Rapports disponibles

<CardGrid>
  <Card title="Procès-verbal d'assemblée PDF" icon="document">
    `GenerateMeetingProtocolPDF` – procès-verbal complet avec les points de l'ordre du jour, les résultats des votes, la présence et la limitation du droit de vote. Les points procéduraux `PROTOCOL` sont filtrés.
  </Card>
  <Card title="Invitation PDF" icon="envelope">
    `GenerateInvitationPDF` – document d'invitation avec date, lieu et ordre du jour.
  </Card>
  <Card title="Carte de procuration PDF" icon="id-card">
    `GenerateProxyCardPDF` – carte de procuration personnalisée par propriétaire et assemblée.
  </Card>
  <Card title="Décompte des coûts PDF" icon="receipt">
    `GenerateCostStatementPDF` – décompte des coûts avec répartition en pourcentage par unité.
  </Card>
  <Card title="Décompte des coûts CSV" icon="table">
    `GenerateCostStatementCSV` – le même décompte en export CSV.
  </Card>
  <Card title="Paquet de preuve PDF" icon="shield">
    `GenerateMeetingEvidencePDF` – chaîne de hachage d'audit en PDF (via EvidenceService).
  </Card>
</CardGrid>

### Infrastructure PDF

La génération PDF est basée sur `github.com/jung-kurt/gofpdf` (Pure-Go, aucun binaire externe). Le logo est chargé via `frontend.DistFS` (embed FS) ; s'il n'est pas trouvé, `loadLogo` recherche des chemins alternatifs relatifs au répertoire de travail et à l'exécutable.

Pour l'**extraction de texte depuis les PDF de règlement**, ResiVote utilise `internal/infrastructure/pdf/extractor.go` : d'abord `pdftotext` (poppler-utils, `-layout`), puis repli sur `github.com/ledongthuc/pdf`. Les PDF scannés sans couche de texte sont détectés et rejetés.

## Connexion au journal d'audit

Chaque action significative crée une `AuditEntry` (`internal/domain/entity/audit_entry.go`) :

- **Append-only** – les entrées ne sont jamais mises à jour ni supprimées.
- **Chaîne de hachage** – chaque entrée fait référence à `PreviousHash` et calcule `Hash` sur tous les champs.
- **Impersonation** – `ImpersonatedByID` enregistre lorsqu'un super-administrateur emprunte l'identité d'un autre utilisateur (version de hachage v3).
- **Événements du procès-verbal** – les changements de statut des points de l'ordre du jour, les résultats des votes et la finalisation du procès-verbal sont audités.

Détails sur le calcul de hachage et la vérification d'intégrité voir `/reference/sicherheit/`.

## Finaliser le procès-verbal

Après la clôture de l'assemblée (`CLOSED`), l'administrateur finalise le procès-verbal :

<Steps>
  1. **Vérifier le procès-verbal** – L'administrateur passe en revue toutes les notes des points de l'ordre du jour dans l'éditeur en direct.
  2. **Générer le PDF** – `GenerateMeetingProtocolPDF` génère le document de procès-verbal contraignant.
  3. **Exporter le paquet de preuve** – `GenerateMeetingEvidencePDF` ou `-JSON` sécurise la chaîne d'audit.
  4. **Archiver l'assemblée** – changement de statut `CLOSED` → `ARCHIVED`.
</Steps>

<Aside type="warning" title="Aucune modification ultérieure">
Après le statut `ARCHIVED`, aucune modification n'est plus possible. La chaîne de hachage d'audit rend toute manipulation ultérieure détectable.
</Aside>

## Liens complémentaires

<LinkCard title="Sécurité et audit" href="/reference/sicherheit/" description="Chaînes de hachage, HMAC et vérification d'intégrité." />
<LinkCard title="Quorum et présence" href="/guides/quorum/" description="Capacité de résolution et calcul du quorum." />
