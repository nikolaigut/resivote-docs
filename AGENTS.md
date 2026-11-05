## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Diagrams (D2)

Guides use [D2](https://d2lang.com/) diagrams via the `astro-d2` integration. D2 code blocks (` ```d2 `) are rendered to SVG at build time.

### Prerequisite: D2 / D2.js

The project uses `astro-d2` with `experimental: { useD2js: true }`, which runs D2 via WebAssembly (JS) without requiring a system D2 binary in CI / Cloudflare Pages.

For local development or testing with the native binary:

```sh
curl -fsSL https://d2lang.com/install.sh | sh -
```

### Deployment (Cloudflare Pages)

Cloudflare Pages builds run `astro build`. Because `astro-d2` is configured with `experimental: { useD2js: true }`, D2 diagrams are compiled using `@terrastruct/d2` (WASM) during the standard build step without needing the D2 binary installed on the build runner.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
