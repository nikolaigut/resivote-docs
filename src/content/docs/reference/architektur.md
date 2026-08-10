---
title: Architektur
description: Überblick über die technische Architektur von ResiVote.
---

ResiVote ist eine mehrmandantenfähige B2B-SaaS-Anwendung für digitale Eigentümerversammlungen.

## Technologie-Stack

| Schicht | Technologie |
| --- | --- |
| Backend | Go mit Echo Framework |
| Datenbank | PostgreSQL mit GORM |
| Authentifizierung | ZITADEL (OpenID Connect) |
| Frontend | Angular mit Tailwind CSS |
| Realtime | WebSockets |

## Sicherheit

- Mandanten-Isolierung über PostgreSQL Row-Level Security (RLS)
- Prüffähiges Abstimmungsprotokoll mit HMAC-SHA-256 Verkettung
- Verschlüsselte Beweispakete als PDF/JSON
