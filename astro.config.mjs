// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	integrations: [
		starlight({
			title: 'ResiVote Docs',
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/nikolaigut/resivote' }],
			sidebar: [
				{
					label: 'Guides',
					items: [
						{ label: 'So funktioniert ResiVote', slug: 'guides/so-funktioniert' },
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
