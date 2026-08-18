---
title: Glossaire
description: Termes importants relatifs à ResiVote et aux assemblées des propriétaires suisses.
---

import { LinkCard } from '@astrojs/starlight/components';

## Absolutes Mehrheit (ABSOLUTE_MAJORITY)

Un type de quorum qui requiert OUI > 50% de tous les propriétaires enregistrés (indépendamment de la présence). Les abstentions et les absences comptent comme un non implicite. Voir [Fonctionnalités — Quorum](../reference/funktionen/#quorum).

## Audit-Log

Un journal infalsifiable et chaîné de toutes les actions pertinentes pour la sécurité. Chaque entrée est hachée avec HMAC-SHA-256 (`AUDIT_HASH_KEY`) et chaînée avec l'entrée précédente (chaîne de hachage). En cas de détection de falsification, le serveur refuse le service (Fail-Closed). Voir [Fonctionnalités — Journal d'audit](../reference/funktionen/#audit-log).

## Check-in

Le processus par lequel les propriétaires enregistrent leur présence à une assemblée. Trois méthodes : `MANUAL` (le président marque manuellement), `QR_CODE` (self check-in via jeton QR), `SIGNATURE` (signature numérique sur tablette). Voir [Fonctionnalités — Enregistrement](../reference/funktionen/#check-in).

## DEK (Data Encryption Key)

Une clé AES spécifique au mandant qui chiffre les documents at Rest. Les DEK sont enveloppés avec le `DOCUMENT_ENCRYPTION_MASTER_KEY` (master key) et stockés dans la base de données. Voir `internal/infrastructure/encryption/tenant_key.go`.

## Einfaches Mehrheit (SIMPLE_MAJORITY)

Un type de quorum qui requiert OUI > 50% des voix par tête présentes/représentées. Les abstentions et les votes non émis comptent comme un non implicite.

## Head-and-Value (HEAD_AND_VALUE)

Un modèle de droit de vote qui prend en compte à la fois les voix par tête et les quotes-parts de valeur. Standard pour les communautés STWEG. Voir [Fonctionnalités — Votes](../reference/funktionen/#abstimmungen-und-beschlüsse).

## IsSuperseded

Un indicateur sur les enregistrements de vote (`IsSuperseded`). Les votes sont immuables — en cas de modification, l'ancien vote est marqué comme `IsSuperseded=true` et un nouvel enregistrement de vote est créé. `IsActive()` renvoie `!IsSuperseded`. Voir `internal/domain/entity/vote.go`.

## Kopfstimme

Le principe de vote « une unité de logement, une voix ». Correspond au modèle de droit de vote `HEAD_ONLY` ou à la composante voix par tête de `HEAD_AND_VALUE`.

## Live-Quorum

Le calcul en temps réel du quorum pendant une assemblée. Le `LiveQuorumEngine` calcule la présence (présents + représentés par procuration) et publie les mises à jour du quorum via WebSocket. Voir [Fonctionnalités — Quorum](../reference/funktionen/#quorum).

## Master Key

Le `DOCUMENT_ENCRYPTION_MASTER_KEY` — une clé AES de 32 octets codée en base64 qui enveloppe et dépaquète les DEK spécifiques au mandant. Voir [DEK](#dek-data-encryption-key).

## MEG (Miteigentümergemeinschaft)

Une communauté de copropriétaires (`CommunityType = "MEG"`). Les communautés MEG peuvent hériter des propriétaires des STWEG associés (`InheritsOwners`) et utilisent des clés de répartition personnalisées (`CUSTOM_SHARES`).

## MEA (Miteigentumsanteil)

Une part de copropriété d'un immeuble. La quote-part de valeur (en millièmes) détermine le poids du vote lors des votes dépendant de la quote-part de valeur.

## Miteigentumsanteil

Voir [MEA](#mea-miteigentumsanteil).

## Präsenz

La somme des propriétaires présents et des propriétaires représentés par procuration. Le `PresenceBuilder` calcule la présence comme base du quorum en direct.

## Pre-Voting

Une phase de vote anticipé asynchrone (`AgendaItemState = "PRE_VOTING"`). Les propriétaires peuvent voter à l'avance ; les votes reçoivent l'indicateur `IsPreVote`. Le Pre-Voting peut être démarré (`start-pre-voting`) et annulé (`cancel-pre-voting`).

## Qualifizierte Mehrheit (QUALIFIED_MAJORITY)

Un type de quorum qui requiert OUI > 50% des propriétaires présents/représentés (têtes) ET > 50% de toutes les quotes-parts de valeur autorisées (Art. 647b/d/e, Art. 712g al. 3 ZGB).

## Quorum

Le nombre minimum requis de participants ayant droit de vote ou la majorité requise pour qu'une assemblée puisse siéger valablement ou qu'une résolution puisse être prise. ResiVote prend en charge cinq types de quorum : `SIMPLE_MAJORITY`, `QUALIFIED_MAJORITY`, `UNANIMOUS`, `ABSOLUTE_MAJORITY`, `CUSTOM`. Voir [Fonctionnalités — Quorum](../reference/funktionen/#quorum).

## Quorum Override

La possibilité pour le président de lever le quorum pour un point de l'ordre du jour spécifique (`QuorumOverride = true`). Requiert une justification obligatoire (`QuorumOverrideReason`). Les votes sont acceptés même si `QuorumMetAtOpen` est false.

## RLS (Row Level Security)

PostgreSQL Row Level Security. Le `DBTransactionMiddleware` définit `SET LOCAL app.current_tenant_id` par requête, de sorte que la base de données empêche les accès inter-mandants au niveau des lignes (Defense-in-Depth). La migration `000004` ajoute des clauses `WITH CHECK` à toutes les politiques RLS.

## STWEG (Stockwerkeigentümergemeinschaft)

Une communauté de propriétaires par étages (`CommunityType = "STWEG"`). Modèle de droit de vote standard : `HEAD_AND_VALUE`.

## Stimmrechtsbegrenzung (VotingRightsCap)

Une configuration réglementaire (`EnableVotingRightsCap`, `VotingRightsCapPct`) qui limite le poids de vote maximal d'un seul propriétaire (cf. Art. 712g ZGB). Pas d'obligation légale ; doit être explicitement activé.

## Tenant (Mandant)

Un contexte client isolé. Chaque mandant a ses propres communautés, propriétaires, assemblées et données. L'isolation est appliquée par RLS au niveau de la base de données.

## TOP

Un **point de l'ordre du jour** ou objet (`AgendaItem`). Chaque TOP est discuté et, si nécessaire, soumis au vote. Un TOP a un type (`MOTION`, `ELECTION`, `FREE_TEXT`, `PROTOCOL`) et un état (`PENDING`, `PRESENTING`, `PRE_VOTING`, `OPEN`, `CLOSED`, `SKIPPED`).

## Traktandum

Voir [TOP](#top).

## Überbauung (Development)

Un regroupement de plusieurs communautés (STWEG/MEG) sous un nom de développement commun (entité `Development`). L'arbre de développement (`/developments/tree`) affiche la hiérarchie.

## Unanimous (Einstimmigkeit)

Un type de quorum qui requiert 100% de tous les propriétaires enregistrés (têtes) et quotes-parts de valeur votant OUI (Art. 647e ZGB). Les absences sans procuration positive comptent comme un non implicite.

## Versammlung

Une assemblée des propriétaires (`Meeting`), où les participants se réunissent physiquement, numériquement ou en mode hybride pour prendre des résolutions. Modes : `LIVE_MEETING` ou `CIRCULAR_RESOLUTION`. Voir [Fonctionnalités — Assemblées numériques](../reference/funktionen/#digitale-versammlungen).

## Vollmacht

Le transfert du droit de vote d'un propriétaire (Grantor) à un mandataire (Grantee) pour une assemblée et une unité spécifiques. Portées : `FULL` (assemblée entière) ou `RESTRICTED` (points de l'ordre du jour spécifiques). Pour `RESTRICTED`, `ProxyInstruction` peut prescrire un vote obligatoire. Voir [Fonctionnalités — Procurations](../reference/funktionen/#vollmachten).

## WebSocket

Un protocole de communication bidirectionnel pour les mises à jour en direct. ResiVote utilise WebSocket sous `/ws/meetings/:meetingId` pour le statut de l'assemblée en direct, la progression des votes et les mises à jour du quorum. Cycle Ping/Pong : 54s/60s. Voir [REST API — WebSocket](../reference/api/#websocket-wsmeetingsmeetingid).

## Wertquote (MEA)

Les **parts de copropriété** en millièmes qui déterminent le poids du vote lors des votes dépendant de la quote-part de valeur. Correspond au modèle de droit de vote `VALUE_ONLY` ou à la composante quotes-parts de valeur de `HEAD_AND_VALUE`.

## ZITADEL

Le fournisseur d'identité OIDC pour ResiVote. ZITADEL gère l'authentification, la gestion des utilisateurs et des rôles. ResiVote valide les JWT access-tokens contre les JWKS ZITADEL. Voir [Configuration — Auth](../reference/konfiguration/#auth-zitadel).

## Zirkularbeschluss (CIRCULAR_RESOLUTION)

Un mode d'assemblée pour la prise de résolutions asynchrone sans assemblée physique (Art. 712m al. 2 ZGB). Défini par `circular_voting_start` et `circular_voting_end`. Voir [Fonctionnalités — Assemblées numériques](../reference/funktionen/#digitale-versammlungen).

<LinkCard title="Fonctionnalités" href="../reference/funktionen/" description="Descriptions détaillées des fonctionnalités." />
<LinkCard title="REST API" href="../reference/api/" description="Endpoints API et middlewares." />
