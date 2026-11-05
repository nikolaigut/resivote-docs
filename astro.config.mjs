// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import astroD2 from 'astro-d2';

// https://astro.build/config
export default defineConfig({
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
					label: 'Eigentümer-Portal',
					items: [
						{ label: 'Das Eigentümer-Portal', slug: 'guides/portal' },
						{ label: 'Mitteilungen & Rundschreiben', slug: 'guides/mitteilungen' },
						{ label: 'Service-Tickets & Anfragen', slug: 'guides/tickets' },
						{ label: 'Gemeinschafts-Forum', slug: 'guides/forum' },
						{ label: 'Dokumente & Reglemente', slug: 'guides/dokumente' },
						{ label: 'Benachrichtigungen & Einstellungen', slug: 'guides/benachrichtigungen' },
					],
				},
				{
					label: 'Versammlungen & Beschlüsse',
					items: [
						{ label: 'So funktioniert ResiVote', slug: 'guides/so-funktioniert' },
						{ label: 'Versammlung erstellen', slug: 'guides/versammlung-erstellen' },
						{ label: 'Zirkularbeschluss & Urnenabstimmung', slug: 'guides/zirkularbeschluss' },
						{ label: 'Abstimmungen durchführen', slug: 'guides/abstimmung' },
						{ label: 'Vollmachten verwalten', slug: 'guides/vollmachten' },
						{ label: 'Check-in und Anwesenheit', slug: 'guides/checkin' },
						{ label: 'Quorum und Präsenz', slug: 'guides/quorum' },
						{ label: 'Protokoll und Berichte', slug: 'guides/protokoll' },
						{ label: 'Benutzer und Berechtigungen', slug: 'guides/benutzer' },
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
