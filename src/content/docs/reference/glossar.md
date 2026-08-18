---
title: Glossar
description: Wichtige Begriffe rund um ResiVote und Schweizer Eigentümerversammlungen.
---

import { LinkCard } from '@astrojs/starlight/components';

## Absolutes Mehrheit (ABSOLUTE_MAJORITY)

Ein Quorum-Typ, bei dem JA > 50% aller registrierten Eigentümer (unabhängig von Anwesenheit) erforderlich ist. Enthaltungen und Abwesenheiten zählen als implizites NEIN. Siehe [Funktionen — Quorum](../reference/funktionen/#quorum).

## Audit-Log

Ein unveränderliches, verkettetes Protokoll aller sicherheitsrelevanten Aktionen. Jeder Eintrag wird mit HMAC-SHA-256 (`AUDIT_HASH_KEY`) gehasht und mit dem vorherigen Eintrag verkettet (Hash-Chain). Bei Tamper-Erkennung verweigert der Server den Dienst (Fail-Closed). Siehe [Funktionen — Audit-Log](../reference/funktionen/#audit-log).

## Check-in

Der Prozess, mit dem Eigentümer ihre Anwesenheit bei einer Versammlung registrieren. Drei Methoden: `MANUAL` (Chair markiert manuell), `QR_CODE` (Self-Check-in via QR-Token), `SIGNATURE` (digitale Unterschrift auf Tablet). Siehe [Funktionen — Check-in](../reference/funktionen/#check-in).

## DEK (Data Encryption Key)

Ein mandanten-spezifischer AES-Schlüssel, der Dokumente at Rest verschlüsselt. DEKs werden mit dem `DOCUMENT_ENCRYPTION_MASTER_KEY` (Master Key) gewrappt und in der Datenbank gespeichert. Siehe `internal/infrastructure/encryption/tenant_key.go`.

## Einfaches Mehrheit (SIMPLE_MAJORITY)

Ein Quorum-Typ, bei dem JA > 50% der anwesenden/vertretenen Kopfstimmen erforderlich ist. Enthaltungen und nicht abgegebene Stimmen zählen als implizites NEIN.

## Head-and-Value (HEAD_AND_VALUE)

Ein Stimmrechtsmodell, das sowohl Kopfstimmen als auch Wertquoten berücksichtigt. Standard für STWEG-Communities. Siehe [Funktionen — Abstimmungen](../reference/funktionen/#abstimmungen-und-beschlüsse).

## IsSuperseded

Ein Flag auf Vote-Records (`IsSuperseded`). Stimmen sind immutable — bei Änderung wird der alte Vote als `IsSuperseded=true` markiert und ein neuer Vote-Record erstellt. `IsActive()` gibt `!IsSuperseded` zurück. Siehe `internal/domain/entity/vote.go`.

## Kopfstimme

Das Abstimmungsprinzip «eine Wohneinheit, eine Stimme». Entspricht dem Stimmrechtsmodell `HEAD_ONLY` oder dem Kopfstimmen-Anteil bei `HEAD_AND_VALUE`.

## Live-Quorum

Die Echtzeit-Berechnung des Quorums während einer Versammlung. Der `LiveQuorumEngine` berechnet Präsenz (anwesend + vertreten via Vollmacht) und publiziert Quorum-Updates via WebSocket. Siehe [Funktionen — Quorum](../reference/funktionen/#quorum).

## Master Key

Der `DOCUMENT_ENCRYPTION_MASTER_KEY` — ein base64-kodierter 32-Byte-AES-Key, der mandanten-spezifische DEKs wrappt und entwrappt. Siehe [DEK](#dek-data-encryption-key).

## MEG (Miteigentümergemeinschaft)

Eine Gemeinschaft von Miteigentümern (`CommunityType = "MEG"`). MEG-Communities können Eigentümer von verknüpften STWEGs erben (`InheritsOwners`) und verwenden benutzerdefinierte Verteilungsschlüssel (`CUSTOM_SHARES`).

## MEA (Miteigentumsanteil)

Ein Miteigentumsanteil an einer Liegenschaft. Die Wertquote (in Tausendstel) bestimmt das Stimmgewicht bei wertquoteabhängigen Abstimmungen.

## Miteigentumsanteil

Siehe [MEA](#mea-miteigentumsanteil).

## Präsenz

Die Summe aus anwesenden Eigentümern und durch Vollmacht vertretenen Eigentümern. Der `PresenceBuilder` berechnet die Präsenz als Grundlage für das Live-Quorum.

## Pre-Voting

Eine asynchrone Vorabstimmungsphase (`AgendaItemState = "PRE_VOTING"`). Eigentümer können vorab stimmen; Votes erhalten das `IsPreVote`-Flag. Pre-Voting kann gestartet (`start-pre-voting`) und abgebrochen (`cancel-pre-voting`) werden.

## Qualifizierte Mehrheit (QUALIFIED_MAJORITY)

Ein Quorum-Typ, bei dem JA > 50% der anwesenden/vertretenen Eigentümer (Köpfe) UND > 50% aller berechtigten Wertquoten erforderlich sind (Art. 647b/d/e, Art. 712g Abs. 3 ZGB).

## Quorum

Die erforderliche Mindestanzahl an stimmberechtigten Teilnehmern bzw. die erforderliche Mehrheit, damit eine Versammlung rechtsgültig tagen oder ein Beschluss gefasst werden kann. ResiVote unterstützt fünf Quorum-Typen: `SIMPLE_MAJORITY`, `QUALIFIED_MAJORITY`, `UNANIMOUS`, `ABSOLUTE_MAJORITY`, `CUSTOM`. Siehe [Funktionen — Quorum](../reference/funktionen/#quorum).

## Quorum Override

Die Möglichkeit des Chairs, das Quorum für ein spezifisches Traktandum aufzuheben (`QuorumOverride = true`). Erfordert eine obligatorische Begründung (`QuorumOverrideReason`). Stimmen werden auch akzeptiert, wenn `QuorumMetAtOpen` false ist.

## RLS (Row Level Security)

PostgreSQL Row Level Security. Die `DBTransactionMiddleware` setzt `SET LOCAL app.current_tenant_id` pro Request, sodass die Datenbank mandantenübergreifende Zugriffe auf Zeilenebene verhindert (Defense-in-Depth). Migration `000004` fügt `WITH CHECK`-Klauseln zu allen RLS-Policies hinzu.

## STWEG (Stockwerkeigentümergemeinschaft)

Eine Gemeinschaft von Stockwerkeigentümern (`CommunityType = "STWEG"`). Standard-Stimmrechtsmodell: `HEAD_AND_VALUE`.

## Stimmrechtsbegrenzung (VotingRightsCap)

Eine reglementarische Konfiguration (`EnableVotingRightsCap`, `VotingRightsCapPct`), die das maximale Stimmgewicht eines einzelnen Eigentümers begrenzt (vgl. Art. 712g ZGB). Keine gesetzliche Pflicht; muss explizit aktiviert werden.

## Tenant (Mandant)

Ein isolierter Kundenkontext. Jeder Tenant hat eigene Communities, Eigentümer, Versammlungen und Daten. Die Isolation wird durch RLS auf Datenbankebene erzwungen.

## TOP

Ein **Traktandum** oder Tagesordnungspunkt (`AgendaItem`). Jeder TOP wird besprochen und, falls nötig, abgestimmt. Ein TOP hat einen Typ (`MOTION`, `ELECTION`, `FREE_TEXT`, `PROTOCOL`) und einen Zustand (`PENDING`, `PRESENTING`, `PRE_VOTING`, `OPEN`, `CLOSED`, `SKIPPED`).

## Traktandum

Siehe [TOP](#top).

## Überbauung (Development)

Eine Gruppierung mehrerer Communities (STWEG/MEG) unter einem gemeinsamen Entwicklungsnamen (`Development`-Entity). Der Entwicklungsbaum (`/developments/tree`) zeigt die Hierarchie.

## Unanimous (Einstimmigkeit)

Ein Quorum-Typ, bei dem 100% aller registrierten Eigentümer (Köpfe) und Wertquoten JA stimmen müssen (Art. 647e ZGB). Abwesenheiten ohne positive Vollmacht zählen als implizites NEIN.

## Versammlung

Eine Eigentümerversammlung (`Meeting`), bei der die Teilnehmer physisch, digital oder hybrid zusammenkommen, um Beschlüsse zu fassen. Modi: `LIVE_MEETING` oder `CIRCULAR_RESOLUTION`. Siehe [Funktionen — Digitale Versammlungen](../reference/funktionen/#digitale-versammlungen).

## Vollmacht

Die Übertragung des Stimmrechts von einem Eigentümer (Grantor) an einen Bevollmächtigten (Grantee) für eine spezifische Versammlung und Unit. Scopes: `FULL` (ganze Versammlung) oder `RESTRICTED` (spezifische Traktanden). Bei `RESTRICTED` kann `ProxyInstruction` eine obligatorische Stimmabgabe vorschreiben. Siehe [Funktionen — Vollmachten](../reference/funktionen/#vollmachten).

## WebSocket

Ein bidirektionales Kommunikationsprotokoll für Live-Updates. ResiVote verwendet WebSocket unter `/ws/meetings/:meetingId` für Live-Meeting-Status, Abstimmungsfortschritt und Quorum-Updates. Ping/Pong-Zyklus: 54s/60s. Siehe [REST API — WebSocket](../reference/api/#websocket-wsmeetingsmeetingid).

## Wertquote (MEA)

Die **Miteigentumsanteile** in Tausendstel, die das Stimmgewicht bei wertquoteabhängigen Abstimmungen bestimmen. Entspricht dem Stimmrechtsmodell `VALUE_ONLY` oder dem Wertquoten-Anteil bei `HEAD_AND_VALUE`.

## ZITADEL

Der OIDC-Identity-Provider für ResiVote. ZITADEL übernimmt Authentifizierung, Benutzer- und Rollenverwaltung. ResiVote validiert JWT-Access-Tokens gegen die ZITADEL-JWKS. Siehe [Konfiguration — Auth](../reference/konfiguration/#auth-zitadel).

## Zirkularbeschluss (CIRCULAR_RESOLUTION)

Ein Versammlungsmodus für asynchrone Beschlussfassung ohne physische Versammlung (Art. 712m Abs. 2 ZGB). Definiert durch `circular_voting_start` und `circular_voting_end`. Siehe [Funktionen — Digitale Versammlungen](../reference/funktionen/#digitale-versammlungen).

<LinkCard title="Funktionen" href="../reference/funktionen/" description="Detaillierte Feature-Beschreibungen." />
<LinkCard title="REST API" href="../reference/api/" description="API-Endpunkte und Middlewares." />
