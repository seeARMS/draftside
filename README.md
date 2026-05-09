# draftside-web

Astro app and landing page for Draftside, an offline AI writing editor.

## Development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

## Dependency notes

- The Astro and Cloudflare adapter dependencies are declared in `package.json`.
- Tailwind is installed from npm and wired through Astro's Vite pipeline via `@tailwindcss/vite`.
- The Tailwind entry stylesheet lives at `src/styles/global.css`.
