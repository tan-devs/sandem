# Sandem

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)  
[![SvelteKit](https://img.shields.io/badge/framework-SvelteKit-orange.svg)]

Version: 0.8.0

**Status:** ✅ build succeeded on 2026‑02‑24; all checks (type, lint, format, E2E) are green

<picture>
  <source srcset="./bannerDark.webp" media="(prefers-color-scheme: dark)">
  <source srcset="./banner.webp" media="(prefers-color-scheme: light)">
  <img src="./banner.webp" alt="Auth components preview">
</picture>

## Quick summary ✅

- **Frontend:** [SvelteKit](https://svelte.dev/docs) ([`Svelte v5`](https://github.com/sveltejs/svelte) with runes)
- **UI toolkit:** a growing library of reusable, themeable components (`Button`, `Card`, `Accordion`, `Tabs`, etc.) built with modern Svelte conventions and semantic CSS tokens.
- **Theming:** four built‑in palettes (`default`, `forest`, `solar`, `ocean`) plus light/dark mode toggling via `ModeToggle`/`ThemeSwitcher`. Colors are managed with semantic custom properties and layered tokens.
- **IDE Engine:** [Monaco Editor](https://microsoft.github.io/monaco-editor/) + [WebContainer API](https://webcontainer.io) powering an in‑browser Node.js environment.
- **Auth:** [`better-auth`](https://github.com/better-auth/better-auth)) + [`@mmailaender/convex-better-auth-svelte`](https://github.com/mmailaender/convex-better-auth-svelte) with Convex-backed sessions.
- **Terminal:** [`xterm.js`](https://github.com/xtermjs/xterm.js) (via [`@battlefieldduck/xterm-svelte`](https://github.com/battlefieldduck/xterm-svelte)) hooked into the WebContainer shell.
- **Collaboration:** [`Liveblocks`](https://liveblocks.io/) + [`Yjs`](https://github.com/yjs/yjs) sync for realtime co‑editing.
- **Backend:** [`Convex`](https://github.com/get-convex/convex-backend) serverless functions (folder: `src/convex`).
- **Docker:** development and deployment ready with `Dockerfile` / `docker-compose` (`README.Docker.md`).
- **Tests:** [`Vitest`](https://github.com/vitest-dev/vitest) (unit) and [`Playwright`](https://github.com/microsoft/playwright) (E2E).

This repo serves both as a **modern Svelte auth starter kit** with a clean component library and as a **hands‑on reference** for building a collaborative, in‑browser IDE.

---

## Core Features 🚀

- **In-Browser Node.js OS:** Spin up a fully functional Node.js environment directly in the browser using the [WebContainer API](https://webcontainer.io). No cloud VMs required.
- **Interactive Terminal:** A fully integrated terminal built with `xterm` connected directly to the WebContainer's `jsh` shell. Run `npm install`, build scripts, and see output in real-time.
- **Collaborative Editing:** Multiplayer code editing powered by Liveblocks and Yjs, integrated seamlessly into the Monaco Editor.
- **Split-Pane Layout:** A responsive, VS Code-inspired 3-panel grid featuring the Editor, a Live Preview iframe, and the Terminal.

---

## Table of contents

- Architecture & key patterns
- Quick start
- Environment variables
- Development & testing
- Project layout
- Deployment
- Troubleshooting
- Contributing & roadmap

---

## Architecture & key patterns

Sandem is built as a modular example of how to compose several modern web-platform pieces:

- **SvelteKit** handles routing, SSR, and API routes while keeping the UI reactive with runes (`$state`, `$props`, `$derived`).
- **Convex** hosts serverless functions and acts as a realtime database; helpers in `src/lib/auth-client.ts` wire authentication state to the UI.
- **Auth** uses `better-auth` together with a small Convex adapter to manage sign‑in, sign‑out, and user sessions on both server and client.
- **UI component library** lives under `src/lib/components` and hosts colors, layout primitives, and atomic UI pieces that are wired to CSS custom properties defined in `src/app.css`.
- **Theming** uses two token layers: primitive color/spacing tokens in `app.css`, and semantic tokens (e.g. `--color-brand`) that are swapped per theme via `[data-theme]` attributes.

  To experiment yourself, open `/docs/theme` in the running app or copy the following snippet into a Svelte REPL or a new page:

  ```svelte
  <script>
  	let currentTheme = 'default';
  	let currentMode = 'light';
  	const themes = ['default', 'forest', 'solar', 'ocean'];
  	$: document.documentElement.dataset.theme = currentTheme;
  	$: document.documentElement.dataset.mode = currentMode;
  </script>

  <select bind:value={currentTheme}
  	>{#each themes as t}<option value={t}>{t}</option>{/each}</select
  >
  <select bind:value={currentMode}><option>light</option><option>dark</option></select>
  <button style="background:var(--accent);color:var(--fg)">Hello</button>
  ```

- **WebContainer / Terminal / Monaco** code is concentrated in the `routes/ide` page and supporting modules; COOP/COEP headers are enforced via `vite.config.ts` and `src/hooks.server.ts` so the container can boot securely.

---

## Quick start

1. `pnpm install` to fetch dependencies.
2. Put your Convex URL in `.env` (see `.env.example`).
3. `pnpm run dev` to start the dev server at http://localhost:5173.
4. Optionally, spin up with Docker: `docker compose up --build` (see [README.Docker.md](README.Docker.md)).

> Tip: switch themes with the selector in the header and toggle dark/light mode using the moon/sun icon. For a live demo of the color palettes, visit `/docs/theme` after the app is running; it provides interactive selectors and sample components.

---

## Environment variables

- `PUBLIC_CONVEX_URL` – Convex deployment URL used by the client.
- `CONVEX_ADMIN_KEY` – (server‑only) key for administrative operations, loaded automatically by Convex CLI.

---

## Project layout

- `src/routes` – SvelteKit pages; notable entry points:\
  `routes/(home)/+page.svelte` – marketing home with theme demo.\
  `routes/ide/...` – the in‑browser IDE layout and boot code.\
  `routes/test/` – various examples and auth test pages.\
- `src/lib/components` – shared component library organized by category\
  `colors`, `layout`, `ui`, `ide`, `preview`, etc.
- `src/convex` – Convex backend functions and schema definitions.
- `e2e/` and `src/lib/sveltekit` – integration and unit tests.
- `Dockerfile` / `compose.yaml` – container definitions for local dev and cloud builds.

---

## Docker support

Sandem ships with a production‑ready Dockerfile and a `docker compose` stack for development. See [README.Docker.md](README.Docker.md) for usage details.

---

## Development & testing

Run `pnpm run check` for TypeScript/Svelte diagnostics, `pnpm run format` for prettier, and `pnpm run lint` for ESLint. Unit tests: `pnpm run test` (Vitest). E2E: `pnpm run e2e` (Playwright).

---

## Deployment

Build with `pnpm run build` or via Docker. Ensure COOP/COEP headers are preserved on your hosting platform for WebContainer functionality.

---

## Troubleshooting

- If the IDE fails to boot, check COOP/COEP headers and open console errors.\
- Missing theme colours? Clear localStorage or verify `data-theme` attribute on `<html>`.

---

## Contributing & roadmap

The repository is evolving rapidly; contributions are welcome. Current top priorities:

1. Finish the shared webcontainer helper and extract logic from the IDE page.\
2. Create a live component catalog and improve theming documentation.\
3. Add CI workflows (lint → test → build → deploy) and Docker publish pipeline.\
4. Expand the E2E suite to cover auth edge cases and UI component rendering.\
5. Add accessibility audits and visual regression testing for theme variants.

Please run `pnpm format` and `pnpm lint` before submitting a PR.

---

## Where to look next

- WebContainer IDE UI: `src/routes/ide/+page.svelte` and `src/lib/components/`.
- Auth setup: `src/convex/*` and `src/lib/auth-client.ts`.
- Convex functions & schema go in `src/convex/`.
- Tests live in `e2e/` and `src/lib/sveltekit/index.spec.ts`.

---

## License

[MIT](LICENSE)

---
