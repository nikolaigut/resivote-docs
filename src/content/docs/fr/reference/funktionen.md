---
title: Fonctionnalités
description: Vue d'ensemble des principales fonctionnalités de ResiVote – numérique, transparent et conforme au droit.
---

import { CardGrid, Card, LinkCard } from '@astrojs/starlight/components';

ResiVote offre tous les outils nécessaires pour organiser des assemblées des propriétaires de manière numérique, transparente et conforme au droit. Chaque fonctionnalité est implémentée dans la base de code et sécurisable par des journaux d'audit.

## Assemblées numériques

ResiVote prend en charge deux modes d'assemblée (`MeetingMode` dans `internal/domain/entity/meeting.go`) :

- **`LIVE_MEETING`** — Assemblée en direct (physique, numérique ou hybride). Les propriétaires participent en direct via navigateur web et votent en temps réel.
- **`CIRCULAR_RESOLUTION`** — Résolution circulaire (Art. 712m al. 2 ZGB). Vote asynchrone avec date de début et de fin définies (`circular_voting_start`, `circular_voting_end`).

Une assemblée peut regrouper plusieurs communautés (STWEG/MEG) (table de jointure `meeting_communities`). Le cycle de vie de l'assemblée traverse les états `DRAFT` → `PUBLISHED` → `CHECK_IN` → `IN_PROGRESS` → `CLOSED` → `ARCHIVED`.

## Votes et résolutions

Chaque point de l'ordre du jour (`AgendaItem`) définit un type de vote :

- **`MOTION`** — Oui/Non/Abstention
- **`ELECTION`** — Élection de candidats (liste `candidates`, choix `CANDIDATE`)
- **`FREE_TEXT`** — Proposition en texte libre (choix `FREE_TEXT`)
- **`PROTOCOL`** — Désignation du rédacteur du procès-verbal (sans vote)

Le poids du vote dépend du modèle de droit de vote de la communauté (`VotingRightsModel`) :

- **`HEAD_AND_VALUE`** — Voix par tête et quote-part de valeur (standard STWEG)
- **`HEAD_ONLY`** — Une unité, une voix
- **`VALUE_ONLY`** — Uniquement la quote-part de valeur (MEA/millièmes)
- **`CUSTOM_SHARES`** — Parts personnalisées par unité (spécifique au MEG)

Fonctionnalités de vote supplémentaires :

- **Votes analogiques groupés** — Le président/admin enregistre les votes pour les propriétaires présents qui ne votent pas numériquement (`CastAnalogVote`, `CastBulkAnalogVotes`)
- **Pre-Voting** — Vote anticipé asynchrone (état `PRE_VOTING`, indicateur `IsPreVote` sur les votes)
- **Visibilité des résultats en direct** — Configurable par assemblée : `ALL` (tous les participants) ou `CHAIR` (uniquement président/admin)
- **Confirmation de vote** — `RequireVoteConfirmation` impose une confirmation du vote
- **Override de quorum** — Le président peut lever le quorum pour un point de l'ordre du jour (`QuorumOverride` avec `QuorumOverrideReason` obligatoire)
- **Immutabilité des votes** — Les votes modifiés sont marqués comme `IsSuperseded=true` ; un nouvel enregistrement de vote est créé

## Procurations

Les propriétaires transfèrent numériquement leur droit de vote à un mandataire (`Proxy` dans `internal/domain/entity/proxy.go`) :

- **`FULL`** — Procuration pour l'ensemble de l'assemblée
- **`RESTRICTED`** — Procuration pour des points de l'ordre du jour spécifiques

Pour `RESTRICTED`, `ProxyInstruction` définit un vote obligatoire (`mandated_vote`) pour un point de l'ordre du jour spécifique. Le mandataire doit voter conformément à l'instruction — une violation déclenche `PROXY_INSTRUCTION_VIOLATION`.

Les procurations sont définies par unité (`UnitID`) et par assemblée (`MeetingID`) et peuvent être révoquées (`RevokedAt`).

## Enregistrement

Trois méthodes d'enregistrement (`CheckinMethod`) :

- **`MANUAL`** — Le président/admin marque les participants manuellement (toujours disponible)
- **`QR_CODE`** — Le propriétaire scanne un QR-code avec son smartphone et effectue un self check-in (`SelfCheckIn`). Le jeton QR est un JWT signé avec le claim `meeting_id`.
- **`SIGNATURE`** — Le propriétaire se sélectionne sur la tablette de l'admin et signe numériquement ; toutes ses unités propres (et les unités sous procuration) sont marquées comme présentes

Les jetons d'enregistrement sont signés avec `CHECKIN_TOKEN_SIGNING_KEY` (HMAC-SHA-256, >= 32 octets en production) et ont une durée de validité configurable (`CHECKIN_TOKEN_EXPIRY`, par défaut 30m).

## Procès-verbaux

- **Éditeur en direct** — Notes de procès-verbal par point de l'ordre du jour (`DiscussionNotes`, `UpdateAgendaItemNotes`)
- **Suggestions IA** — Suggestions de procès-verbal générées par IA (`SuggestProtocolNotes`) ; providers : `mistral`, `ollama`, `llama`, `mock`, `disabled`
- **Rédacteur du procès-verbal** — Assignable par assemblée (`ProtocolWriterOwnerID`, `ProtocolWriterType` : `OWNER` ou `TENANT_ADMIN`)
- **Rapports PDF** — Procès-verbal en PDF (`DownloadMeetingProtocolPDF`), invitation en PDF (`DownloadInvitationPDF`), carte de procuration en PDF (`DownloadProxyCardPDF`)
- **Paquet de preuve** — PDF + JSON + vérification d'intégrité par assemblée (`EvidenceHandler`)

## Documents

Le portail client (`portal_enabled`) offre la gestion documentaire :

- **Dossiers** — Structure de dossiers hiérarchique (`Folder`, visibilité `PUBLIC` ou `RESTRICTED`)
- **Catégories** — `PROTOCOL`, `INVITATION`, `ANNUAL_ACCOUNT`, `REGULATION`, `NOTICE`, `FORM`, `OTHER`
- **Import de règlement** — En deux phases : extraire (`reglement-extract`) → confirmer (`reglement-confirm`) ; utilise un provider IA pour l'extraction LLM
- **Chiffrement at Rest** — Les DEK (Data Encryption Keys) spécifiques au mandant sont enveloppés avec le `DOCUMENT_ENCRYPTION_MASTER_KEY` (`TenantKeyProvider`, `DocumentEncryption`)
- **Backends de stockage** — Système de fichiers local (`./uploads`) ou compatible S3 (`STORAGE_TYPE=s3`)
- **Conversion PDF** — LibreOffice (`soffice`) pour la conversion document-vers-PDF (`CONVERTER_ENABLED`)

## Quorum

Cinq types de quorum par point de l'ordre du jour (`QuorumType` dans `internal/domain/entity/agenda_item.go`) :

- **`SIMPLE_MAJORITY`** — OUI > 50% des voix par tête présentes/représentées
- **`QUALIFIED_MAJORITY`** — OUI > 50% des propriétaires présents/représentés (têtes) ET > 50% de toutes les quotes-parts de valeur autorisées (Art. 647b/d/e, Art. 712g al. 3 ZGB)
- **`UNANIMOUS`** — 100% de tous les propriétaires et quotes-parts de valeur enregistrés doivent voter OUI (Art. 647e ZGB)
- **`ABSOLUTE_MAJORITY`** — OUI > 50% de tous les propriétaires enregistrés (indépendamment de la présence)
- **`CUSTOM`** — OUI >= `custom_quorum_pct`% de la base configurée (`PRESENT` ou `ELIGIBLE`)

Le moteur de quorum en direct (`LiveQuorumEngine`, `LiveQuorumService`) calcule le quorum en temps réel et publie les mises à jour via WebSocket. Les overrides de règlement (`reglement_head_quorum_pct`, `reglement_value_quorum_pct`, `reglement_min_owners`) remplacent les valeurs par défaut par type de communauté (STWEG : 50/50/2, MEG : 50/50/1).

## Forum et tickets

- **Forum** — Forum communautaire public pour les propriétaires et l'administration (`ForumHandler` : créer des sujets, répondre, supprimer)
- **Tickets** — Demandes de support privées entre le propriétaire et l'administration (`TicketHandler` : créer, ajouter des messages, mettre à jour le statut, télécharger des pièces jointes)

Les deux fonctionnalités sont disponibles dans le portail client (`/api/v1/portal/...`) et requièrent `portal_enabled=true`.

## Messages

Le centre de messages (`MessageHandler`, `MessageService`) permet des diffusions aux communautés :

- Messages avec aperçu des destinataires (`PreviewRecipientCount`)
- Gestion des statuts de brouillon et d'envoi
- Boîte de réception des propriétaires dans le portail (`ListForOwner`, `MarkRead`, `Archive`)

## Notifications

- **In-App** — Liste des notifications, nombre non lus, marquer comme lu
- **E-mail** — Intégration via l'API Resend
- **Web Push** — Notifications push navigateur via VAPID (`WebPushSender`) ; gérer les abonnements push (`SubscribePush`, `UnsubscribePush`)
- **Paramètres** — Paramètres de notification configurables par propriétaire

## Facturation

- **Billing-Worker** — Crée mensuellement des factures pour tous les mandants actifs (`BILLING_WORKER_INTERVAL`, par défaut 1h)
- **Factures** — Export PDF (`DownloadInvoicePDF`), overrides d'expéditeur spécifiques au mandant
- **Métriques SaaS** — Vue d'ensemble de facturation super-admin (`/api/v1/admin/billing/tenants`)
- **Répartition des coûts** — Clés de répartition et décomptes de coûts pour le MEG (`CostDistributionHandler`, export PDF/CSV)

## Journal d'audit

- **Chaîne de hachage immuable** — Chaque entrée d'audit est chaînée avec HMAC-SHA-256 (`AUDIT_HASH_KEY`)
- **Fail-Closed** — En cas de détection de falsification, le serveur refuse le service (`AUDIT_FAIL_CLOSED`, seuil `AUDIT_FAIL_CLOSED_THRESHOLD`)
- **Vérification au démarrage** — L'intégrité de la chaîne est vérifiée au démarrage ; en cas de rupture et de Fail-Closed, `os.Exit(1)`
- **Vérification périodique** — Toutes les `AUDIT_VERIFY_INTERVAL` (5m), la chaîne est vérifiée
- **Application de l'immutabilité** — Les triggers DB et le rôle non-superuser sont vérifiés au démarrage
- **Export** — Journal d'audit en PDF ou JSON (`DownloadAuditPDF`, `DownloadAuditJSON`)
- **ZertES/nDSG** — La preuve d'intégrité contre la manipulation de base de données requiert une clé HMAC >= 32 octets

## Multilingue

Le frontend prend en charge les langues **DE**, **FR**, **IT** et **EN** (`SUPPORTED_LANGUAGES` dans `language.store.ts`, par défaut : `de`). La langue est résolue depuis `localStorage`, la langue du navigateur ou la valeur par défaut. Les catégories de documents sont synchronisées avec les clés i18n.

## Recherche globale

L'endpoint `/api/v1/search` recherche dans toutes les ressources indexées, par mandant (pour `tenant_admin`) ou à l'échelle de la plateforme (pour `super_admin`) (`SearchService`, `SearchHandler`).

## Mode démo

Le mode démo optionnel (`DemoResetConfig` fait tourner quotidiennement un mandant de démonstration :

- Le worker s'exécute à 00:00 UTC + `DEMO_RESET_RESET_OFFSET`
- Hard-delete (`DEMO_RESET_HARD_DELETE`) ou archivage de l'ancien mandant démo
- Re-seeding avec des données d'exemple (mandant, communauté, propriétaires, unités)
- Déclenchement manuel via `POST /internal/demo-reset` (protégé par clé API) ou `POST /api/v1/admin/system/demo-reset` (super-admin)
- Le slug démo doit être `demo` (`Config.Validate`)

<CardGrid>
<Card title="REST API" href="../reference/api/">Endpoints et middlewares</Card>
<Card title="Configuration" href="../reference/konfiguration/">Variables d'environnement</Card>
<Card title="Deployment" href="../reference/deployment/">Développement et production</Card>
<Card title="Glossaire" href="../reference/glossar/">Termes et abréviations</Card>
</CardGrid>
