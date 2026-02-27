# Sandem

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![SvelteKit](https://img.shields.io/badge/framework-SvelteKit-orange.svg)](https://svelte.dev)
[![Convex](https://img.shields.io/badge/backend-Convex-purple.svg)](https://convex.dev)

---

<picture>
  <source srcset="./bannerDark.webp" media="(prefers-color-scheme: dark)">
  <source srcset="./banner.webp" media="(prefers-color-scheme: light)">
  <img src="./banner.webp" alt="Auth components preview">
</picture>

**Version:** 0.0.1 · **Status:** ✅ build passing · all checks green

---

A collaborative, in-browser IDE powered by [WebContainer API](https://webcontainer.io). Spin up a real Node.js environment in your browser tab, edit files in Monaco, run commands in a full terminal, see a live preview — all without a cloud VM.

---

## What it does

| Feature                          | Tech                              |
| -------------------------------- | --------------------------------- |
| In-browser Node.js runtime       | WebContainer API (StackBlitz)     |
| Code editor with multi-file tabs | Monaco Editor + Yjs               |
| Real-time collaboration          | Liveblocks + Yjs CRDT             |
| Live preview iframe              | WebContainer `server-ready` event |
| Integrated terminal              | xterm.js → `jsh` shell            |
| Project persistence              | Convex real-time database         |
| Auth (email + GitHub OAuth)      | better-auth + Convex adapter      |
| Themeable UI                     | CSS semantic tokens, 4 palettes   |

---

## How it does

- **Frontend:** [SvelteKit](https://svelte.dev/docs) ([`Svelte v5`](https://github.com/sveltejs/svelte) with runes)
- **UI toolkit:** a growing library of reusable, themeable components (`Button`, `Card`, `Accordion`, `Tabs`, etc.) built with modern Svelte conventions and semantic CSS tokens.
- **Theming:** four built‑in palettes (`default`, `forest`, `solar`, `ocean`) plus light/dark mode toggling via `ModeToggle`/`ThemeSwitcher`. Colors are managed with semantic custom properties and layered tokens.
- **IDE Engine:** [Monaco Editor](https://microsoft.github.io/monaco-editor/) + [WebContainer API](https://webcontainer.io) powering an in‑browser Node.js environment.
- **Auth:** [`better-auth`](https://github.com/better-auth/better-auth) + [`@mmailaender/convex-better-auth-svelte`](https://github.com/mmailaender/convex-better-auth-svelte) with Convex-backed sessions.
- **Terminal:** [`xterm.js`](https://github.com/xtermjs/xterm.js) (via [`@battlefieldduck/xterm-svelte`](https://github.com/battlefieldduck/xterm-svelte)) hooked into the WebContainer shell.
- **Collaboration:** [`Liveblocks`](https://liveblocks.io/) + [`Yjs`](https://github.com/yjs/yjs) sync for realtime co‑editing.
- **Backend:** [`Convex`](https://github.com/get-convex/convex-backend) serverless functions (folder: `src/convex`).
- **Docker:** development and deployment ready with `Dockerfile` / `docker-compose` (`README.Docker.md`).
- **Tests:** [`Vitest`](https://github.com/vitest-dev/vitest) (unit) and [`Playwright`](https://github.com/microsoft/playwright) (E2E).

---

## Quick start

```bash
pnpm install
cp .env.local   # add your Convex / Liveblocks / OAuth keys
# (also set PUBLIC_LIVEBLOCKS_KEY, SITE_URL, etc. as shown below)
pnpm dev
```

App runs at `http://localhost:5173`. The Convex dev server starts alongside it via `concurrently`.

> **Note:** WebContainer requires `Cross-Origin-Embedder-Policy: require-corp` and `Cross-Origin-Opener-Policy: same-origin` headers. These are set automatically by `src/hooks.server.ts` for all non-API routes.

---

## Environment variables

```env
# .env.local (copy from .env.example)

# Convex backend
CONVEX_DEPLOYMENT=dev:your-team,project-name      # e.g. dev:tan-devs/sandem
PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
PUBLIC_CONVEX_SITE_URL=https://your-app-domain.com

# Liveblocks (client + server keys)
PUBLIC_LIVEBLOCKS_KEY=pk_live_...               # published to browser
LIVEBLOCKS_SECRET_KEY=sk_live_...               # server only

# Application URL (used by auth callbacks, Playwright, etc.)
SITE_URL=http://localhost:5173

# OAuth credentials
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
```

---

## Project layout

```
src/
├── convex/               # Backend (schema, mutations, auth, generated API)
│   ├── _generated/       # Convex‑generated types & client code
│   ├── auth.config.ts
│   ├── auth.ts
│   ├── convex.config.ts
│   ├── http.ts
│   ├── projects.ts
│   ├── schema.ts
│   └── tsconfig.json
├── lib/                  # front‑end helper code
│   ├── assets/           # static images, icons
│   ├── components/       # UI library (colors, layout, ide, ui)
│   ├── context/          # svelte context helpers (ide, auth-client)
│   ├── hooks/            # custom svelte hooks (autoSaver, projectMount, etc.)
│   ├── liveblocks.config.ts
│   ├── svelte/           # svelte kit bridges & clients
│   ├── sveltekit/        # server helpers & tests
│   └── utils/            # filesystem, language, template helpers
├── routes/               # sveltekit pages & endpoints
│   ├── (home)/           # landing page
│   ├── api/              # server endpoints (auth, liveblocks-auth)
│   ├── dev/              # development/debug dashboard
│   ├── projects/         # project list + creation
│   │   ├── +layout.server.ts
│   │   ├── +layout.svelte
│   │   ├── +page.svelte
│   │   └── [project]/    # dynamic IDE route
│   └── test/             # misc test pages (ssr, client-only, queries)
├── app.css
├── app.html
├── hooks.server.ts
├── demo.spec.ts
└── types/
    └── env.d.ts
```

---

## Architecture

### Boot sequence (`/projects/[project]`)

1. A server loader (`+layout.server.ts`) runs on every visit to the
   dynamic route. It uses the `locals.token` to create a Convex HTTP
   client, fetches `currentUser`, and then retrieves the project
   document by ID. Ownership is validated and only then are the data
   objects returned to the client along with `authState` for the
   authentication handshake.

2. The client layout (`+layout.svelte`) immediately disables SSR and
   boots a WebContainer instance. Booting is intentionally fire‑and‑forget
   to minimise perceived latency; a loading spinner displays until the
   filesystem is mounted.

3. Parallel to the container, a reactive Convex query (`useQuery`) asks
   for the same project by ID. Because Convex queries are live, updates
   to the document (for example, from another browser tab) flow through
   automatically.

4. A `$effect` block waits for both the container and the project data
   to be ready. When they are, the layout transforms `project.files` (a
   flat array of `{name, contents}`) into a WebContainer
   `FileSystemTree` using `filesystem-utils.ts` and calls
   `webcontainer.mount()`.

5. Once the filesystem is populated the layout calls `setIDEContext()`
   with two getters: `getWebcontainer` returns the live container instance
   (throwing if not yet available) and `getProject` returns the latest
   project document. These getters allow child components to access the
   shared state lazily without prop drilling.

6. Editor, Terminal and Preview components call `requireIDEContext()`
   during their own `onMount` hooks. They initialise Monaco models,
   spawn a shell process or register for preview reloads only after
   `getWebcontainer` resolves.

7. A layout-level boolean `ready` gate (`{#if ready}`) ensures the panes
   appear only when the mount and context setup have finished. This
   prevents flashes of uninitialised editors.

### Data flow outside the IDE

- The project listing page (`/projects`) uses the authenticated
  user's ID (obtained via `auth.getCurrentUser`) to fetch
  `getProjects`. It creates and deletes projects via Convex mutations,
  and updates the local list in real time thanks to Convex's live
  querying.

- The root layout uses the `useAuth()` store to render the navigation
  bar differently depending on authentication state. It also preloads
  `currentUser` via a server `load` function so the avatar and sign‑out
  button render correctly.

### File sync

- **Convex → WebContainer:** when a project first loads its files are
  written in bulk via `webcontainer.mount()`. Any later updates to the
  Convex document (for example, shared edits from collaboration) will
  trigger additional mounts if the code is expanded to handle them.

- **Editor → WebContainer:** every keystroke writing to Monaco flows
  through `createFileWriter` which uses `wc.fs.writeFile()` to keep the
  container's filesystem synchronized in real time.

- **Editor → Convex:** `createAutoSaver` debounces edits (1.5 s) and
  sends them to the `updateProject` mutation. Pending saves are tracked
  per file to avoid clobbering and to retry on failure.

- **Collaboration:** when a project has a `room` ID, the Editor
  connects a `LiveblocksYjsProvider` to a shared `Y.Doc`. The provider
  emits a `sync` event; once synced a `seedYjsFromConvex()` routine
  populates Yjs documents with the current file contents. Local
  changes (origin `null`) trigger auto‑saves; changes originating from
  remote peers are ignored by the autosaver.

### Template format

Files are stored in Convex as `{ name: string, contents: string }[]` —
a flat array. `filesystem-utils.ts` converts this to a WebContainer
`FileSystemTree` at mount time, handling nested paths.

```ts
// Creating a project from a template
await client.mutation(api.projects.createProject, {
	title: 'My App',
	owner: user._id,
	files: VITE_REACT_TEMPLATE.files, // ProjectFile[] — flat array
	entry: VITE_REACT_TEMPLATE.entry,
	visibleFiles: VITE_REACT_TEMPLATE.visibleFiles
});
```

---

## UI / Theming

Four built-in palettes (`default`, `forest`, `solar`, `ocean`) with light/dark variants, controlled via `data-theme` and `data-mode` attributes on `<html>`. All component colors reference semantic CSS variables (`--bg`, `--mg`, `--fg`, `--text`, `--muted`, `--border`, `--accent`, etc.) defined in `app.css`.

The IDE route (`/projects/[project]`) overrides the theme with hardcoded dark values via `body:has(.ide-grid)` — editors always render dark regardless of the active theme.

---

## Scripts

```bash
pnpm dev          # start client + Convex dev server
pnpm build        # production build
pnpm check        # svelte-check TypeScript diagnostics
pnpm lint         # ESLint
pnpm format       # Prettier
pnpm test         # Vitest unit tests
pnpm e2e          # Playwright E2E
```

---

## Docker

```bash
docker compose up --build
```

See [README.Docker.md](README.Docker.md) for environment variable injection and production deployment notes.

---

## Deployment notes

- Ensure COOP/COEP headers survive your hosting proxy/CDN — WebContainer will not boot without them
- Convex deployment URL must be set (`PUBLIC_CONVEX_URL`) and you may also need `PUBLIC_CONVEX_SITE_URL` for auth callbacks.
- SITE_URL should reflect your public-facing address (used by auth, tests, and scripts).
- Liveblocks secret key is server-only (`LIVEBLOCKS_SECRET_KEY`); never expose it client-side.
- Remember to set `PUBLIC_LIVEBLOCKS_KEY` for the client and GitHub OAuth credentials.

---

## License

[MIT](LICENSE)
