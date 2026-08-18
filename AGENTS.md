## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Diagrams (D2)

Guides use [D2](https://d2lang.com/) diagrams via the `astro-d2` integration. D2 code blocks (` ```d2 `) are rendered to SVG at build time.

### Prerequisite: D2 binary

The D2 binary must be installed on the build machine. Install it user-locally:

```sh
curl -fsSL https://d2lang.com/install.sh | sh -
```

This installs `d2` to `~/.local/bin/d2`. Verify with `d2 --version`.

### Deployment (Cloudflare Pages)

Cloudflare Pages builds run `astro build`, which requires the D2 binary. Ensure the build environment installs D2 before the build command, e.g. by prepending the install step to the Pages build command, or use `skipGeneration: true` in `astro-d2` config and commit the prebuilt `public/d2/` SVGs.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
