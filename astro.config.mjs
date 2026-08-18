// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

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
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/nikolaigut/resivote' }],
			customCss: ['./src/styles/custom.css'],
			locales: {
				root: { label: 'Deutsch', lang: 'de' },
				en: { label: 'English', lang: 'en' },
				fr: { label: 'Français', lang: 'fr' },
				it: { label: 'Italiano', lang: 'it' },
			},
			sidebar: [
				{
					label: 'Guides',
					items: [
						{ label: 'So funktioniert ResiVote', slug: 'guides/so-funktioniert' },
						{ label: 'Benutzer und Berechtigungen', slug: 'guides/benutzer' },
						{ label: 'Versammlung erstellen', slug: 'guides/versammlung-erstellen' },
						{ label: 'Abstimmungen durchführen', slug: 'guides/abstimmung' },
						{ label: 'Vollmachten verwalten', slug: 'guides/vollmachten' },
						{ label: 'Check-in und Anwesenheit', slug: 'guides/checkin' },
						{ label: 'Quorum und Präsenz', slug: 'guides/quorum' },
						{ label: 'Protokoll und Berichte', slug: 'guides/protokoll' },
						{ label: 'Dokumente und Reglemente', slug: 'guides/dokumente' },
					],
				},
				{
					label: 'Konzepte',
					items: [
						{ label: 'Funktionen', slug: 'reference/funktionen' },
						{ label: 'Glossar', slug: 'reference/glossar' },
						{ label: 'Architektur', slug: 'reference/architektur' },
						{ label: 'Datenmodell', slug: 'reference/datenmodell' },
						{ label: 'Rollen und Berechtigungen', slug: 'reference/rollen' },
						{ label: 'Sicherheit und Compliance', slug: 'reference/sicherheit' },
						{ label: 'REST API', slug: 'reference/api' },
						{ label: 'Konfiguration', slug: 'reference/konfiguration' },
						{ label: 'Deployment und Entwicklung', slug: 'reference/deployment' },
					],
				},
			],
		}),
	],
});
