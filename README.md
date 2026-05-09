# Draftside

An open-source writing editor that runs 100% offline. Chrome's built-in Gemini Nano powers inline completions, rewrites, alternate phrasing, and draft classification — all on your device, never on a server.

**Live:** [draftside.ai](https://draftside.ai)

## Why

Most AI writing tools send your drafts to someone else's server. Draftside doesn't. Every AI call runs on-device through Chrome's built-in Gemini Nano — no API key, no account, no cloud. The whole product is a static web app you can install as a PWA and use on a plane.

## Features

- **Inline ghost-text completions** — pause briefly, press `Tab` to accept
- **Alternate wording** — highlight a phrase, click to swap
- **Rewrite** — shape a passage with the local Rewriter API
- **Classify** — read your own draft (form, intent, stance, friction, next move)
- **Translate** — on-device translation between supported languages
- **Chat** — ask the local model questions about your draft, with optional image attachments
- **Transcribe** — dictate via the multimodal Prompt API
- **Persistent local drafts** — stored in IndexedDB, never uploaded
- **Installable PWA** — works fully offline once the model is cached

## Requirements

Draftside needs a Chrome (or Edge / Chromium) browser with the built-in AI APIs enabled. The first session will trigger a one-time Gemini Nano download (~1–2 GB), after which everything runs locally.

The editor and offline drafts work in any modern browser; only the AI features require Chrome's `LanguageModel`, `Writer`, `Rewriter`, and related APIs.

## Development

```bash
npm install
npm run dev
```

The dev server runs at `http://localhost:4321`.

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
- [Chrome Built-in AI APIs](https://developer.chrome.com/docs/ai/built-in-apis) — `LanguageModel`, `Writer`, `Rewriter`, `Translator`, `LanguageDetector`
- [Tailwind CSS](https://tailwindcss.com) for layout and styles
- [Cloudflare Workers](https://workers.cloudflare.com) for hosting

## Project structure

```
src/
  pages/
    index.astro            landing page
    editor.astro           editor entry
  components/
    editor/
      LocalWriteEditor.tsx the editor + AI surface
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

## License

[MIT](./LICENSE) © Colin Armstrong
