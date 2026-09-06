# Draftside

An open-source writing editor that runs 100% offline. Chrome's built-in Gemini Nano powers inline completions, rewrites, alternate phrasing, translation, chat, transcription, and draft classification — all on your device, without a model backend.

**Live:** [draftside.ai](https://draftside.ai)

## Why

Most AI writing tools send your drafts to a remote backend. Draftside doesn't. Every AI call runs on-device through Chrome's built-in Gemini Nano — no API key, no account, no backend model calls. The whole product is a web app you can install as a PWA and use on a plane.

## Features

- **Inline ghost-text completions** — pause briefly, press `Tab` to accept; choose Short, Medium, or Long in **More actions → Completion length**
- **Alternate wording** — highlight a phrase, click to swap
- **Rewrite** — shape a passage with the local Rewriter API
- **Classify** — read your own draft (form, intent, stance, friction, next move)
- **Translate** — on-device translation between supported languages
- **Chat** — ask the local model questions about your draft, with optional image attachments
- **Transcribe** — dictate via the multimodal Prompt API
- **Private Vault** — passkey-encrypted drafts via WebAuthn PRF, unlocked with Touch ID, Windows Hello, or a hardware key
- **Persistent local drafts** — stored in IndexedDB, never uploaded
- **Installable PWA** — works offline once the app shell is cached; AI features run when Chrome's local model is available

## Requirements

Draftside needs a Chrome (or Edge / Chromium) browser with the built-in AI APIs enabled. The first AI session can trigger a one-time Gemini Nano download (~1–2 GB), after which inference runs locally.

The editor and offline drafts work in any modern browser; AI features require Chrome's `LanguageModel` API. Some tools also use `Rewriter`, `Translator`, `LanguageDetector`, and multimodal `LanguageModel` input support when the browser exposes them.

## Privacy model

- Drafts are stored in your browser's IndexedDB under this origin. They are not uploaded by Draftside.
- AI prompts and responses are sent to Chrome's built-in AI APIs and run locally when those APIs are available.
- The optional Private Vault encrypts drafts in IndexedDB with AES-GCM. The vault key is wrapped with WebAuthn PRF output from your passkey, plus a one-time recovery key.
- The editor route (`/write`) does not load Google Analytics.
- The marketing page (`/`) currently loads Google Analytics, so Google may receive normal page-view metadata for visits to the landing page.
- Browser extensions, the browser vendor, operating system services, and a compromised local device are outside Draftside's control.

## Development

```bash
npm install
npm run dev
```

The dev server runs at `http://localhost:4321`.

## Browser regression tests

```bash
npx playwright install chromium
npm run test:e2e
```

The tests run the real editor in Chromium with deterministic responses at the built-in AI API boundary. They exercise ghost text, Tab acceptance, dismissal, saved draft persistence, and completion length preferences without requiring a Gemini Nano download. Use `PLAYWRIGHT_BASE_URL` to test an already running development or production build, or `PLAYWRIGHT_PORT` to change the test server port.

## Production build

```bash
npm run build      # static build
npm run preview    # build + run via wrangler
```

## Deploy

Deployment targets Cloudflare Workers via Wrangler:

```bash
npm run deploy
```

## Stack

- [Astro](https://astro.build) for the site, with a React island for the editor
- [TipTap](https://tiptap.dev) (ProseMirror) for the editing surface
- [Chrome Built-in AI APIs](https://developer.chrome.com/docs/ai/built-in-apis) — `LanguageModel`, `Rewriter`, `Translator`, `LanguageDetector`
- [Tailwind CSS](https://tailwindcss.com) for layout and styles
- [Cloudflare Workers](https://workers.cloudflare.com) for hosting

## Project structure

```
src/
  pages/
    index.astro            landing page
    write.astro            editor entry
  components/
    editor/
      DraftsideEditor.tsx  the editor + AI surface
  styles/
    global.css
    editor.css
  site-meta.js             shared site metadata
public/                    static assets (icons, og image, manifest)
scripts/
  generate-og.mjs          OG image generation
```

## Contributing

Issues and pull requests welcome. The project is small enough that a quick description in an issue is usually the right starting point.

For vulnerability reports, please see [SECURITY.md](./SECURITY.md).

## License

[MIT](./LICENSE) © Colin Armstrong
