# Security Policy

Draftside is a client-side, offline-first writing editor. It runs entirely in the browser, with no backend processing of user content. All AI inference happens locally via Chrome's built-in Gemini Nano. Drafts are stored in IndexedDB; the optional Private Vault encrypts drafts with a passkey-derived key via WebAuthn PRF.

Because the threat model is primarily about local data confidentiality and the integrity of the static web app, the most impactful issues are usually:

- Flaws in vault encryption, key derivation, or WebAuthn PRF handling
- Unintended exfiltration of draft content (network requests, third-party scripts, leaks via clipboard / drag-and-drop / extensions)
- XSS or content injection in the editor surface, landing page, or service worker
- Service-worker bugs that could serve stale or attacker-controlled responses
- Supply-chain risks in the build or deploy pipeline

## Reporting a vulnerability

Please **do not file a public GitHub issue** for suspected security problems.

Instead, email **colin@armstr.ng** with:

- A description of the issue and its impact
- Steps to reproduce (a minimal PoC is ideal)
- Affected version / commit / browser
- Whether the issue is already public

You should receive an initial response within a few days. Fixes for confirmed issues will typically ship in the next release. If you would like credit in the release notes, say so in your report.

## Scope

In scope:

- The Draftside web app source in this repository
- The deployed app at https://draftside.ai
- The service worker, manifest, and PWA install flow

Out of scope:

- Chrome's built-in AI APIs themselves (please report those to Chromium)
- The Cloudflare hosting layer
- Vulnerabilities that require a compromised local device, malicious browser extension, or physical access — these are assumed in the threat model

Thanks for helping keep Draftside safe.
