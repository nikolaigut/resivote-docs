// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import astroD2 from 'astro-d2';

// https://astro.build/config
export default defineConfig({
	redirects: {
		'/guides/so-funktioniert': '/verwaltung/uebersicht',
		'/guides/benutzer': '/verwaltung/uebersicht',
		'/guides/versammlung-erstellen': '/verwaltung/versammlung-erstellen',
		'/guides/abstimmung': '/eigentuemer/versammlung-mit-login',
		'/eigentuemer/versammlung-teilnahme': '/eigentuemer/versammlung-mit-login',
		'/guides/vollmachten': '/eigentuemer/vollmachten',
		'/guides/checkin': '/eigentuemer/checkin',
		'/guides/quorum': '/verwaltung/quorum',
		'/guides/protokoll': '/verwaltung/protokoll',
		'/guides/dokumente': '/eigentuemer/dokumente',
		'/guides/portal': '/eigentuemer/portal',
		'/guides/mitteilungen': '/eigentuemer/mitteilungen',
		'/guides/tickets': '/eigentuemer/tickets',
		'/guides/forum': '/eigentuemer/forum',
		'/guides/benachrichtigungen': '/eigentuemer/benachrichtigungen',
		'/guides/zirkularbeschluss': '/eigentuemer/zirkularbeschluss',
	},
	integrations: [
		starlight({
			title: 'ResiVote Docs',
			logo: {
				src: './src/assets/logo.png',
				replacesTitle: true,
				alt: 'ResiVote Logo',
			},
			customCss: ['./src/styles/custom.css'],
			head: [
				{ tag: 'link', attrs: { rel: 'apple-touch-icon', sizes: '180x180', href: '/favicon-180.png' } },
				{ tag: 'link', attrs: { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32.png' } },
				{ tag: 'link', attrs: { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon-16.png' } },
			],
			locales: {
				root: { label: 'Deutsch', lang: 'de' },
				en: { label: 'English', lang: 'en' },
				fr: { label: 'Français', lang: 'fr' },
				it: { label: 'Italiano', lang: 'it' },
			},
			sidebar: [
				{
					label: 'Handbuch für Eigentümer',
					items: [
						{ label: 'Portal-Dashboard', slug: 'eigentuemer/portal' },
						{ label: 'Meine Einheiten & Wertquoten', slug: 'eigentuemer/einheiten' },
						{ label: 'Teilnahme mit Login (Portal)', slug: 'eigentuemer/versammlung-mit-login' },
						{ label: 'Teilnahme ohne Login (Saal/PIN)', slug: 'eigentuemer/versammlung-ohne-login' },
						{ label: 'Vollmachten erteilen', slug: 'eigentuemer/vollmachten' },
						{ label: 'Check-in vor Ort & digital', slug: 'eigentuemer/checkin' },
						{ label: 'Zirkularbeschluss abstimmen', slug: 'eigentuemer/zirkularbeschluss' },
						{ label: 'Dokumente & Jahresakten', slug: 'eigentuemer/dokumente' },
						{ label: 'Mitteilungen & Anschlagwand', slug: 'eigentuemer/mitteilungen' },
						{ label: 'Service-Tickets & Schäden', slug: 'eigentuemer/tickets' },
						{ label: 'Gemeinschafts-Forum', slug: 'eigentuemer/forum' },
						{ label: 'Benachrichtigungseinstellungen', slug: 'eigentuemer/benachrichtigungen' },
					],
				},
				{
					label: 'Handbuch für Verwaltungen',
					items: [
						{ label: 'Übersicht & Rollenmodell', slug: 'verwaltung/uebersicht' },
						{ label: 'Liegenschaften & Eigentümer', slug: 'verwaltung/liegenschaften-eigentuemer' },
						{ label: 'Versammlung vorbereiten', slug: 'verwaltung/versammlung-erstellen' },
						{ label: 'Live-Versammlungssteuerung', slug: 'verwaltung/versammlungssteuerung' },
						{ label: 'Check-in & Anwesenheit', slug: 'verwaltung/checkin-praesenz' },
						{ label: 'Quorum & Beschlussfähigkeit', slug: 'verwaltung/quorum' },
						{ label: 'Protokollführung & KI', slug: 'verwaltung/protokoll' },
						{ label: 'Zirkularbeschlüsse verwalten', slug: 'verwaltung/zirkularbeschluss' },
						{ label: 'Dokumente & Vorlagen', slug: 'verwaltung/dokumente-vorlagen' },
						{ label: 'Mitteilungen verfassen', slug: 'verwaltung/mitteilungen' },
						{ label: 'Tickets & Pendenzen', slug: 'verwaltung/tickets-pendenzen' },
						{ label: 'Forum-Moderation', slug: 'verwaltung/forum-moderation' },
					],
				},
			],
		}),
		astroD2({
			experimental: {
				useD2js: true,
			},
		}),
	],
});
