# WebContainer & Terminal Integration To‑Do

> Build verified 2026‑02‑24: `pnpm run build` completes with only chunk-size warnings; CI commands (`check`, `format`, `lint`) all pass.

> The list below has been revised to reflect the current implementation and to drive the project toward a fully‑featured, StackBlitz‑style in‑browser IDE. Completed items are checked, remaining work is grouped by phase.

---

## ✅ Phase 1: Infrastructure & Security (complete)

- [x] Install runtime dependencies (`@webcontainer/api`, `xterm`, `@xterm/addon-fit`).
- [x] Add COOP/COEP headers in `vite.config.ts` and `src/hooks.server.ts` (dev & prod).
- [x] `.gitignore` updated to exclude `.env.local` and other sensitive files.

## ✅ Phase 2: Terminal component (implemented)

- [x] `src/lib/components/Terminal.svelte` built using `@battlefieldduck/xterm-svelte`.
- [x] Handles resizing, opens a `jsh` shell, pipes I/O, and exposes rows/cols for process resizing.
- [x] No manual `bind:this` needed; component interface handles the instance.

## ✅ Phase 3: Container boot logic (working)

- [x] Boot and mount logic lives in `/routes/ide/+page.svelte` (singleton guard prevents multiple boots).
- [ ] **Optional refactor:** extract to a shared `src/lib/webcontainer.ts` store/helper for reuse.

## ✅ Phase 4: Stream connection (done)

- [x] Shell spawned in `Terminal.svelte` with rows/cols sync.
- [x] Container output is written to xterm; keystrokes forward to container input.

## ✅ Phase 5: Liveblocks‑powered editor (done)

- [x] `Editor.svelte` initializes Monaco, binds multiple models to a Liveblocks/Yjs room.
- [x] On sync, database contents seed the document.
- [x] Model changes trigger debounced Convex save and immediate `webcontainer.fs.writeFile` for HMR.
- [x] Active file switching works, autosave indicator present.

## ✅ Phase 6: Preview iframe (done)

- [x] `Preview.svelte` runs `npm install` then `npm run dev` inside the container.
- [x] Listens for `server-ready` events and updates `iframeUrl`.

## ✅ Phase 7: Documentation & cleanup (partial)

- [x] Add WebContainer setup notes to `README.md`.
- [ ] Add Docker and docker-compose instructions to README and create `README.Docker.md`.
- [ ] Document new UI component library and theming system (buttons, cards, theme switcher, layout primitives).
- [ ] Explain semantic token architecture and theme variants (`default`, `forest`, `solar`, `ocean`, light/dark modes).
- [ ] Remove remaining `console.log` debugging and temporary comments.
- [x] Confirmed `.gitignore` already covers new files.

---

## 🚀 Phase 8: UI library & theming enhancements

This phase covers the expanding design system that now lives alongside the IDE features.

- [ ] Consolidate component props and ensure all new UI bits use Svelte 5 runes.
- [ ] Add `Accordion`, `Avatar`, `DropDown`, `Grid`, `MenuBar`, `Search`, `Tab`/`Tabs`, etc.
- [ ] Build a live component catalog page for previewing variants and themes (now implemented as `/docs/theme`).
- [ ] Expose a global `ThemeSwitcher` panel and add `ModeToggle` for light/dark mode.
- [ ] Create documentation for token layers (primitive vs semantic) and how to add a new theme.
- [ ] Implement persistent theme choice and default based on system preference.
- [ ] Hook theme variables into Storybook or similar visual explorer (optional).

---

## 🚀 Phase 9: StackBlitz‑level feature roadmap

These are the high‑value enhancements required to transform Sandem into a production‑quality online IDE.

- [ ] **File explorer/tree view** – display, add, delete, rename files and folders.
- [ ] **Template gallery** – choose from React, Vue, Svelte, plain HTML, etc.
- [ ] **Import/export** – download a ZIP, push/pull from GitHub URLs.
- [ ] **Workspace snapshots** – reset container, take/restore snapshots, clone sharable sessions.
- [ ] **Package.json editor / dependency manager** – UI for editing dependencies with auto‑install.
- [ ] **Custom run/test commands** – allow users to run arbitrary `npm` scripts and view results.
- [ ] **Sharing & deep links** – create guest links that spin up a project without auth.
- [ ] **Monaco IntelliSense & LSP** – enable language servers, auto‑completion, error underlining.
- [ ] **Collaborative cursors & user list** – surface who’s in the room and show their cursors.
- [ ] **Error overlays & console logs** – surface compile/runtime errors outside of the terminal.
- [ ] **Resource monitoring** – warn on container OOM or high CPU/memory usage.
- [ ] **Prod build preview** – add a "Build" button and show `/dist` output in iframe.
- [ ] **Responsive/mobile layout** – ensure panes work on narrow screens.
- [ ] **Accessibility audit** – keyboard navigation for tabs, file tree, and panes.
- [ ] **E2E tests** – add Playwright (or equivalent) for full‑stack integration scenarios.
- [ ] **CI/CD & deploy notes** – verify headers and container build on target hosts.

---

> 📝 Progress tip: complete the refactor in Phase 3 first – a clean shared container API makes many of the Phase 9 tasks easier.
