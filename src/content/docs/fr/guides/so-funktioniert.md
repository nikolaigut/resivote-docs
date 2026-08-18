---
title: Comment fonctionne ResiVote
description: Le déroulement d'une assemblée des propriétaires numérique avec ResiVote – du brouillon au procès-verbal archivé.
---

import { Steps, Aside, CardGrid, Card, LinkCard } from '@astrojs/starlight/components';

ResiVote vous accompagne du brouillon au procès-verbal signé – le tout dans un espace numérique unique. Une assemblée traverse une machine à états définie (`internal/domain/entity/meeting.go`) :

`DRAFT` → `PUBLISHED` → `CHECK_IN` → `IN_PROGRESS` → `CLOSED` → `ARCHIVED`

Outre l'assemblée en direct, ResiVote prend en charge la résolution circulaire (`CIRCULAR_RESOLUTION`, Art. 712m al. 2 ZGB) comme alternative.

## 1. Préparer l'assemblée

L'assemblée démarre à l'état `DRAFT`. L'administrateur définit la date, l'heure, le lieu et le titre.

### Plusieurs communautés

Une assemblée peut regrouper plusieurs communautés (`Meeting.Communities` via la table de jointure `meeting_communities`). Les communautés peuvent être regroupées en un ensemble immobilier (`Development`) – un STWEG plus un MEG associé dans la même assemblée.

### Points de l'ordre du jour

Chaque point de l'ordre du jour (`AgendaItem`) définit :

- **Type** – `MOTION` (oui/non/abstention), `ELECTION` (élection), `FREE_TEXT` (proposition en texte libre), `PROTOCOL` (désignation du rédacteur du procès-verbal, sans vote)
- **Quorum** – `SIMPLE_MAJORITY`, `QUALIFIED_MAJORITY`, `UNANIMOUS`, `ABSOLUTE_MAJORITY` ou `CUSTOM` avec un pourcentage personnalisé
- **Communauté** – `CommunityID` = `nil` signifie « toutes les communautés de l'assemblée »

Détails sur les types de quorum voir `/guides/quorum/`.

## 2. Inviter les participants

Le passage à `PUBLISHED` envoie les invitations.

### E-mails planifiés

Les invitations sont persistées en tant que `ScheduledEmail` (`internal/domain/entity/scheduled_email.go`). Un worker d'arrière-plan récupère les lignes échues et les envoie. Types : `INVITATION`, `REMINDER`, `CLOSED`. Statut : `pending` → `sent` (ou `failed`/`dead_letter` avec retry).

### PDF d'invitation et carte de procuration

Le `ReportService` génère pour chaque destinataire un PDF d'invitation (`GenerateInvitationPDF`) et une carte de procuration personnalisée (`GenerateProxyCardPDF`). Les deux sont envoyés en pièce jointe.

### Connexion OIDC

L'authentification s'effectue via ZITADEL (OIDC). Les propriétaires se connectent avec leur lien personnel. L'association entre l'identité ZITADEL (`ExternalUserID`/`sub`) et l'enregistrement du propriétaire s'effectue automatiquement lors de la première connexion (`LinkAllExternalUsersByEmail`).

## 3. Dérouler l'assemblée

L'administrateur ouvre l'assemblée (`CHECK_IN`), puis la démarre (`IN_PROGRESS`).

### Méthodes d'enregistrement

L'assemblée configure une `CheckinMethod` (`internal/domain/entity/meeting.go`) :

| Méthode | Déroulement |
|---------|-------------|
| `MANUAL` | Le président/l'administrateur marque les participants manuellement (par défaut) |
| `QR_CODE` | Les propriétaires scannent un QR-code avec leur smartphone (self check-in) |
| `SIGNATURE` | Les propriétaires se sélectionnent dans un menu déroulant sur la tablette de l'administrateur et signent numériquement ; toutes leurs unités et les unités sous procuration sont marquées comme présentes |

### Tableau de bord du président et procès-verbal en direct

Le président (`meeting_chair`) pilote l'assemblée via un tableau de bord : ouvrir/fermer les points de l'ordre du jour, lancer les votes, consulter les résultats en direct. Le procès-verbal en direct est tenu en parallèle – le rédacteur du procès-verbal (`OWNER` ou `TENANT_ADMIN`) rédige des notes pour chaque point de l'ordre du jour.

### Mises à jour en direct via WebSocket

La présence, le statut du quorum et les résultats des votes sont diffusés en temps réel à tous les participants via WebSocket. Le `presenceBuilder` (`internal/application/presence_builder.go`) est connecté au hub WebSocket et diffuse immédiatement les changements de présence.

## 4. Prendre des résolutions

Chaque point de l'ordre du jour traverse des états (`internal/domain/entity/agenda_item.go`) :

`PENDING` → `PRESENTING` → `PRE_VOTING` (optionnel) → `OPEN` → `CLOSED` (ou `SKIPPED`)

### Vote

Le `VoteValidator` (`internal/domain/service/vote_validator.go`) vérifie avant chaque vote :

1. L'assemblée est `IN_PROGRESS` (ou `PRE_VOTING` en cas de vote anticipé asynchrone)
2. Le point de l'ordre du jour est `OPEN` ou `PRE_VOTING`
3. Le quorum était atteint à l'ouverture – ou le président a accordé un `QuorumOverride`
4. L'unité appartient à une communauté de l'assemblée
5. Le point de l'ordre du jour s'applique à la communauté de l'unité
6. L'électeur est l'électeur principal (`PrimaryOwnership`) ou le mandataire (`Proxy.GranteeID`)
7. En cas de procuration : le point de l'ordre du jour est-il couvert ? Le vote correspond-il à l'instruction ?
8. Enregistrement requis (si `RequirePreCheckin`)

### Voix par tête et quotes-parts de valeur

Selon le `VotingRightsModel` de la communauté, les voix par tête (`HEAD_AND_VALUE`, `HEAD_ONLY`), les quotes-parts de valeur (`HEAD_AND_VALUE`, `VALUE_ONLY`) ou des parts personnalisées (`CUSTOM_SHARES`) sont prises en compte. La limitation du droit de vote (`EnableVotingRightsCap`, Art. 712g ZGB) plafonne les voix par tête lorsque le pourcentage réglementaire est dépassé.

### Moteur de quorum et résultats

Le `QuorumEngine` (`internal/domain/service/quorum_engine.go`) calcule par communauté les voix par tête et les quotes-parts de valeur, les compare au seuil et génère un `AgendaItemResult` avec `OverallPassed`. Détails voir `/guides/quorum/`.

### Visibilité des résultats en direct

`LiveResultsVisibleTo` contrôle qui voit les résultats en direct : `ALL` (tous les participants) ou `CHAIR` (uniquement le président/admin).

## 5. Finaliser le procès-verbal

Après le dernier point de l'ordre du jour, l'assemblée passe à `CLOSED`, puis à `ARCHIVED`.

### PDF du procès-verbal

`GenerateMeetingProtocolPDF` génère le procès-verbal contraignant avec tous les points de l'ordre du jour, les résultats des votes, les présences et les limitations du droit de vote. Les points de l'ordre du jour procéduraux de type `PROTOCOL` sont filtrés. Détails voir `/guides/protokoll/`.

### Journal d'audit et paquet de preuve

Chaque action a été enregistrée pendant l'assemblée dans la chaîne de hachage d'audit (`AuditEntry`, SHA-256/HMAC). Le paquet de preuve (`GenerateMeetingEvidencePDF`/`-JSON`) exporte la chaîne complète avec vérification d'intégrité. Détails voir `/reference/sicherheit/`.

### Archivage

Après `ARCHIVED`, aucune modification n'est plus possible. La chaîne de hachage d'audit rend toute manipulation ultérieure détectable.

<Aside type="note" title="Résolution circulaire">
En mode `CIRCULAR_RESOLUTION`, l'enregistrement et la séance en direct sont supprimés. Les propriétaires votent de manière asynchrone dans une fenêtre temporelle (`CircularVotingStart`/`CircularVotingEnd`). Le moteur de quorum et le procès-verbal fonctionnent de manière analogue.
</Aside>

## Liens complémentaires

<LinkCard title="Procès-verbal et rapports" href="/guides/protokoll/" description="Procès-verbal en direct, suggestions IA et rapports PDF." />
<LinkCard title="Quorum et présence" href="/guides/quorum/" description="Capacité de résolution et calcul du quorum." />
<LinkCard title="Utilisateurs et autorisations" href="/guides/benutzer/" description="Rôles, mandants et contrôle d'accès." />
