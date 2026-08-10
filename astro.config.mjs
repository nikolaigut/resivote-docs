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
						{ label: 'Erste Schritte', slug: 'guides/erste-schritte' },
					],
				},
				{
					label: 'Referenz',
					items: [{ autogenerate: { directory: 'reference' } }],
				},
			],
		}),
	],
});
