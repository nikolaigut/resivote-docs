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
			sidebar: [
				{
					label: 'Guides',
					items: [
						{ label: 'So funktioniert ResiVote', slug: 'guides/so-funktioniert' },
						{ label: 'Benutzer und Berechtigungen', slug: 'guides/benutzer' },
					],
				},
				{
					label: 'Konzepte',
					items: [
						{ label: 'Funktionen', slug: 'reference/funktionen' },
						{ label: 'Glossar', slug: 'reference/glossar' },
					],
				},
			],
		}),
	],
});
