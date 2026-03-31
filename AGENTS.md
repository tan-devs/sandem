You are able to use the Svelte MCP server, where you have access to comprehensive Svelte 5 and SvelteKit documentation. Here's how to use the available tools effectively:

> Last updated: 2026-03-31

## Available MCP Tools:

### 1. list-sections

Use this FIRST to discover all available documentation sections. Returns a structured list with titles, use_cases, and paths.
When asked about Svelte or SvelteKit topics, ALWAYS use this tool at the start of the chat to find relevant sections.

### 2. get-documentation

Retrieves full documentation content for specific sections. Accepts single or multiple sections.
After calling the list-sections tool, you MUST analyze the returned documentation sections (especially the use_cases field) and then use the get-documentation tool to fetch ALL documentation sections that are relevant for the user's task.

### 3. svelte-autofixer

Analyzes Svelte code and returns issues and suggestions.
You MUST use this tool whenever writing Svelte code before sending it to the user. Keep calling it until no issues or suggestions are returned.

### 4. playground-link

Generates a Svelte Playground link with the provided code.
After completing the code, ask the user if they want a playground link. Only call this tool after user confirmation and NEVER if code was written to files in their project.

# Agent Instructions & Session Learnings

## Core Directives

1. **Svelte 5 First**: Always prefer Runes ($state, $props, $derived) over Svelte 4 store/export syntax.
2. **Event Attributes**: Use `onclick`, `oninput`, etc., instead of `on:click` or `on:input`.
3. **Data Injection + Pure Functions**: Use explicit dependency injection pattern where components receive props (not state) and action handlers are pure functions taking context.
4. **Data Injection**: Pass configuration data (like nav links) from layouts to components using props to keep components pure and reusable.
5. **`/repo` Auth Gating**: Demo mode is guest-only. If authenticated, always run repo workspace flow; do not gate by project count.
6. **Starter Seed on First Visit**: For authenticated owners with zero projects, rely on `ensureStarterProjectForOwner` to create starter content.
7. **Keep this file current**: Whenever `AGENTS.md` is read during work, update it as needed so it accurately reflects the app’s current behavior, architecture, scripts, and known status.
8. **Agent docs ownership**: Agents must update architecture docs, README, and AGENTS.md whenever significant refactors are made, especially when key controller/service paths change.
9. **Explorer Multi-root Contract**: In authenticated `/repo`, the WebContainer root is a multi-project workspace (folder names are slugified from each Convex project title). Explorer tree should treat those folders as the canonical top-level roots.
10. **Explorer Sync Status**: Treat Convex ↔ Explorer sync as foundational/in-progress unless explicitly wired in the active `/repo` shell. Avoid documenting it as fully shipped if delete/rename root actions are still scaffolded.
11. **Explorer Startup Sync**: Explorer must not require manual refresh to reveal project root folders; keep silent polling + bootstrap retries active so post-boot mount races self-heal.
12. **Project Selection Sync**: Selecting a root project folder should re-target sync context immediately (room/subscription and tree refresh behavior should follow selected project).
13. **Explorer Action UX**: Use non-blocking in-panel dialogs (create/rename/delete intents) instead of `window.prompt`/`window.confirm` in the active Explorer flow.

## Styling Architecture (The "Svelte.dev" Way)

- **Token Layers**: Maintain a strict separation between Primitive Tokens (raw colors/spacing) and Semantic Tokens (roles like `--color-brand`).
- **Global Over Scoped**: Put interactive states (hover, active, focus) and base resets in `app.css` to keep `.svelte` file styles minimal.
- **Centering**: Use `display: grid; place-items: center;` on the `main` or wrapper element for modern, robust centering.
- **Header Layouts**: Use `display: grid; grid-template-columns: 1fr auto 1fr;` for perfectly balanced 3-section headers (Nav | Search | Action).

## MCP Tool Utilization

- **svelte-autofixer**: Run this on EVERY code generation to ensure Svelte 5 compatibility.
- **list-sections**: Use at the start of any new technical implementation to verify the latest API changes in the Svelte 5 docs.

## Explorer Architecture (Stores → Services → Utils → Hook → Controller → Presentation)

The explorer system follows the same DI + Pure Functions pattern as the terminal. Read `EXPLORER.md` before restructuring.

**Layer overview** (bottom-up, each layer depends only on the one below it):

1. **Store** (`src/lib/stores/explorer/explorer.state.store.svelte.ts` → `createExplorerStateStore()`): Pure `$state` — selectedPath, searchQuery, openSections, double-click tracking. Zero IO. Zero service knowledge.

2. **Services** (`src/lib/services/explorer/`):
   - `createFileTree.svelte.ts` — WebContainer FS reader; owns `tree`, `loading`, `error`, `expanded` as `$state`; adaptive auto-refresh (850 ms → 6 s back-off); signature-based change detection.
   - `createProjectSync.svelte.ts` — Convex mutations + Liveblocks broadcast. Renamed from `projectFilesSync`. API: `canWrite()`, `createFile()`, `createDirectory()`, `renamePath()`, `deletePath()`, `stop()`.

3. **Utils** (`src/lib/utils/explorer/explorer-ops.ts`): Pure tree query functions (`filterNodesByQuery`, `getPathsToExpand`, `findNode`, `getAllDirectoryPaths`, `validateProjectRelativePath`) + pseudo-pure action handlers (`handleCreateFile`, `handleCreateFolder`, `handleRenameNode`, `handleDeleteNode`, `handleRefreshTree`, `handleExpandAll`, `handleCollapseAll`, `handleRefreshAndExpandAll`). All handlers take `ExplorerActionContext` — no closures, fully testable.

4. **Hook** (`src/lib/hooks/useExplorer.svelte.ts` → `useExplorer(explorer, getActivityTab)`): Called from `Explorer.svelte` script. Registers one `$effect` (search → auto-expand dirs). Returns `mount()` for onMount: keyboard shortcuts, pointer dismissal, auto-refresh start, stabilised bootstrap loop. Returns cleanup.

5. **Controller** (`src/lib/controllers/ExplorerController.svelte.ts` → `createExplorerController()`): The only composition point. Instantiates store + services, computes all `$derived` state, manages dialog/context-menu lifecycle, assembles `buildActionContext()`. Returns flat API for `Explorer.svelte`.

6. **Presentation** (`src/lib/components/explorer/`): Props-in / callbacks-out. No store imports, no context reads.
   - `Explorer.svelte` — wiring root; calls controller, calls `useExplorer`, has one `$effect` (entry-file auto-open), calls `onMount(mount)`.
   - `ExplorerContent.svelte` — layout shell + prop router + dialog UI.
   - Sub-components: `ExplorerFilesSection`, `ExplorerOpenEditors`, `ExplorerProjectInfo`, `ExplorerOutline`, `ExplorerTimeline`, `ExploerContextMenu`.

**Deleted files** (do not re-add):

| Deleted                                          | Replaced by                                      |
| ------------------------------------------------ | ------------------------------------------------ |
| `controllers/ExplorerContoller.svelte.ts` (typo) | `controllers/ExplorerController.svelte.ts`       |
| `controllers/FileTreeController.svelte.ts`       | `services/explorer/createFileTree.svelte.ts`     |
| `controllers/StateController.svelte.ts`          | `stores/explorer/explorer.state.store.svelte.ts` |
| `services/explorer/createExplorer.svelte.ts`     | `utils/explorer/explorer-ops.ts`                 |
| `utils/ide/explorerTreeOps.ts`                   | `utils/explorer/explorer-ops.ts`                 |

**Full architecture reference**: `src/reports/EDITOR.md`

## Terminal Architecture (Stores → Services → Hook → Controller → Presentation)

The terminal system is fully refactored and stable. It is the reference implementation of the DI + Pure Functions philosophy in this codebase. Do not restructure it without reading `TERMINAL.md` first.

**Layer overview** (bottom-up, each layer depends only on the one below it):

1. **Stores** (`src/lib/stores/terminal/`): Pure `$state` — zero IO, zero shell knowledge. Three files: `terminal.panel.store.svelte.ts` (active tab + xterm init options), `terminal.session.store.svelte.ts` (session metadata list, starts empty for SSR safety, exposes `hydrate()` injection point), `terminal.store.svelte.ts` (composes both + permissions via `applyPermissions()`).

2. **Services** (`src/lib/services/terminal/`): Shell lifecycle and theme.
   - `createTerminalShell.svelte.ts` — owns a single `jsh` WebContainer process; enforces execute permissions; audits every command; manages `FitAddon` and a git command shim on first attach.
   - `createTerminalTheme.ts` — **pure utility function** (`applyTerminalTheme(terminal)`). Reads CSS vars from `document.documentElement`, writes to `terminal.options`. No state, no runes, `.ts` extension (not `.svelte.ts`).
   - `createTerminalWorkspace.svelte.ts` — orchestration layer; owns `runtimes[]` (`$state`); reconciles live shell+terminal pairs against session metadata via `syncRuntimes()` (wrapped in `untrack`); exposes all panel/session/shell actions as thin delegators.

3. **Hook** (`src/lib/hooks/useTerminal.svelte.ts`): Registers two `$effect`s that must run during component initialization. Effect 1 syncs `store.sessions.sessions` → `workspace.syncRuntimes()`. Effect 2 auto-persists session state to `localStorage` (keeping IO out of the store). `mount()` handles client-side hydration, theme `MutationObserver`, and `collaborationPermissionsStore` subscription. Returns a `cleanup()` function.

4. **Controller** (`src/lib/controllers/TerminalController.svelte.ts` → `createTerminalController()`): The only composition point. Instantiates workspace + hook, returns a single flat API object. Nothing else should instantiate these services directly.

5. **Presentation** (`src/lib/components/terminal/`): Pure props-in / callbacks-out. No store imports, no context reads, no logic.
   - `Terminal.svelte` — wiring root only; calls `createTerminalController`, fans props to children.
   - `TerminalPanelHeader.svelte` — tab bar + header action buttons (Clear, Restart, Kill, Maximize, Close).
   - `TerminalToolbar.svelte` — per-session tab buttons + rename/reorder/new. Session tab click calls only `onSelectSession` — `ensureShellReady` is handled internally by the workspace; there is no `onEnsureShell` prop.
   - `TerminalViewport.svelte` — selects active session, delegates to `TerminalSessionPane`.
   - `TerminalSessionPane.svelte` — owns the `Xterm` widget; holds local `terminal = $state<Terminal>()` and forwards it to `onLoad(sessionId, terminal!)` on mount so the workspace can register it directly on `runtimes[idx]` (derived state is read-only in Svelte 5 — this pattern is intentional).

**Key Files**:

- `src/lib/stores/terminal/terminal.panel.store.svelte.ts`
- `src/lib/stores/terminal/terminal.session.store.svelte.ts`
- `src/lib/stores/terminal/terminal.store.svelte.ts`
- `src/lib/stores/terminal/index.ts`
- `src/lib/services/terminal/createTerminalShell.svelte.ts`
- `src/lib/services/terminal/createTerminalTheme.ts`
- `src/lib/services/terminal/createTerminalWorkspace.svelte.ts`
- `src/lib/services/terminal/index.ts`
- `src/lib/hooks/useTerminal.svelte.ts`
- `src/lib/controllers/TerminalController.svelte.ts`
- `src/lib/components/terminal/Terminal.svelte`
- `src/lib/components/terminal/TerminalPanelHeader.svelte`
- `src/lib/components/terminal/TerminalToolbar.svelte`
- `src/lib/components/terminal/TerminalViewport.svelte`
- `src/lib/components/terminal/TerminalSessionPane.svelte`
- `src/lib/components/terminal/index.ts`

**Full architecture reference**: `src/reports/TERMINAL.md`

## Editor Architecture (Controller + Hook + Services — DI/PF in progress)

> **Status: functional but not fully cleansed.** The layering is correct; several DI/PF violations remain. Do not model new features on the current Editor implementation until the gaps listed in `EDITOR.md` are resolved. Use the Terminal system as the reference instead.

**Layer overview:**

1. **Store** (`src/lib/stores/editor.store.svelte.ts` → `createEditorStore()`): Owns tab list, `activeTabPath`, and Monaco status (cursor, language, EOL). Singleton `editorStore` exported alongside the factory. `updateStatus` has a field-by-field equality guard to prevent spurious reactive updates.

2. **Services** (`src/lib/services/editor/`):
   - `createEditor.svelte.ts` — Monaco + Yjs runtime. No `$state`, no error reporting. Online path: Liveblocks room → Yjs → `MonacoBinding`. Offline path: direct `ITextModel` per file. Exposes `initialize`, `syncActiveEditorModel`, `destroy`.
   - `createEditorAutoSaver.svelte.ts` — debounced Convex `upsertFile` (1500 ms).
   - `createEditorFileWriter.svelte.ts` — debounced WebContainer `fs.writeFile` (120 ms), sequential per-file queue.
   - `createEditorStatus.svelte.ts` — reads Monaco cursor/language state into the store.
   - `createEditorActions.svelte.ts` — pure action functions over an injected `EditorActionContext` (`openFile`, `closeTab`, `shutdown`, `togglePanel`).

3. **Hook** (`src/lib/hooks/useEditor.svelte.ts`): Wraps the runtime with `$state` for `editorRuntimeError`, `editorReady`, `initializingEditor`. Provides `initializeEditor(element)` (with retry safety via pre-init `destroy`) and `syncAfterActivePathChange()`.

4. **Controller** (`src/lib/controllers/EditorController.svelte.ts` → `createEditorController()`): Assembly only. Instantiates all services + hook, computes derived UI state (`tabs`, `showEmptyState`, `saveStatusVariant`), registers keyboard shortcuts, and returns a flat API.

5. **Component** (`src/lib/components/editor/Editor.svelte`): Wiring root. Calls `createEditorController`, runs `onMount`/`onDestroy`/`$effect`, renders Monaco mount point and UI chrome.

**Known DI/PF gaps** (full list in `EDITOR.md`):

- `getCanWrite` is accepted by `EditorControllerOptions` but never threaded into the runtime — read-only mode is not enforced at the shell level.
- `activity` is passed as `unknown` and unused in the controller body.
- `collaborationPermissionsStore` is subscribed manually in `Editor.svelte` with a raw `$state` variable instead of going through the controller/hook.
- `editorStore` and `activity` are imported as module singletons in `Editor.svelte` — should eventually be injected.

**Key files:**

- `src/lib/stores/editor.store.svelte.ts`
- `src/lib/services/editor/createEditor.svelte.ts`
- `src/lib/services/editor/createEditorAutoSaver.svelte.ts`
- `src/lib/services/editor/createEditorFileWriter.svelte.ts`
- `src/lib/services/editor/createEditorStatus.svelte.ts`
- `src/lib/services/editor/createEditorActions.svelte.ts`
- `src/lib/services/editor/index.ts`
- `src/lib/hooks/useEditor.svelte.ts`
- `src/lib/controllers/EditorController.svelte.ts`
- `src/lib/components/editor/Editor.svelte`
- `src/lib/components/editor/index.ts`

**Full architecture reference**: `src/reports/EDITOR.md`

## Auth Architecture (Two-Table Identity — Better Auth + Convex)
 
> **Status: stable.** Better Auth runs inside Convex. Your app has two user tables that serve different purposes and must not be conflated. Read `AUTH.md` before touching any auth or identity code.
 
**The two tables:**
 
- **Better Auth component tables** (`betterAuth.*` on the Convex dashboard): `user`, `session`, `account`, `jwks`, `verification`, `rateLimit`. Managed entirely by the Better Auth library. Never query these from app code.
- **Your `users` table** (`src/convex/functions/schema.ts`): `tokenIdentifier`, `username`, `name`, `email`, `isGuest`, `createdAt`, `lastSeen`. Owns app identity, project ownership FKs, and guest support.
 
**Layer overview** (request flow top-down):
 
1. **HTTP proxy** (`src/routes/api/auth/[...path]/+server.ts`): SvelteKit catch-all. Forwards all `/api/auth/*` requests to `PUBLIC_CONVEX_SITE_URL` via `createSvelteKitHandler()`. 10-second timeout, manual redirect handling.
 
2. **Convex HTTP router** (`src/convex/functions/http.ts`): `authComponent.registerRoutes(http, createAuth)` — registers Better Auth's sign-in, sign-up, OAuth callback, JWKS, and token endpoints onto Convex's HTTP layer.
 
3. **Better Auth instance** (`src/convex/functions/auth.ts` → `createAuth(ctx)`): Built per-request. Configured with email/password, GitHub OAuth, and the required `convex()` plugin. The `convex()` plugin is what issues JWTs that Convex can verify.
 
4. **JWT verification config** (`src/convex/config/auth.config.ts`): Tells Convex's built-in middleware how to verify those JWTs via a `customJwt` + JWKS provider. This file must be resolvable from the functions root.
 
5. **SSR bootstrap** (`src/routes/+layout.server.ts`): On every page load — `getAuthState()` (cookie presence check, no Convex round-trip) + `client.query(api.auth.getCurrentUser)` via HTTP client. Returns `{ currentUser, authState }` to all layouts/pages.
 
6. **Identity upsert** (`src/convex/functions/users.ts` → `ensureUserIdentity()`): Mutation called from layout. Upserts your `users` table row for both authenticated users (via `tokenIdentifier` from JWT) and guests (via stable `guestId` cookie). Fires `seedStarterProjectForOwner()` on first authenticated insert.
 
7. **`getCurrentUser` query** (`src/convex/functions/auth.ts`): Returns the row from **your** `users` table (not Better Auth's). This is the single source of truth for "who am I" in the app. Returns `null` for guests/unauthenticated.
 
8. **Ownership guards** (`projects.ts`, `nodes.ts`): All write mutations call `ctx.auth.getUserIdentity()` → `tokenIdentifier` → look up your `users` table → compare `_id` to `project.ownerId`. If `ensureUserIdentity` hasn't run yet, they throw.
 
**Key files:**
 
- `src/convex/convex.config.ts` — registers the `@convex-dev/better-auth` component
- `src/convex/config/auth.config.ts` — JWT provider config for Convex middleware
- `src/convex/functions/auth.ts` — `authComponent`, `createAuth`, `getCurrentUser`
- `src/convex/functions/users.ts` — `ensureUserIdentity` (guest + auth upsert)
- `src/convex/functions/http.ts` — HTTP route registration
- `src/lib/sveltekit/index.ts` — `getToken`, `getAuthState`, `createConvexHttpClient`, `createSvelteKitHandler`
- `src/routes/api/auth/[...path]/+server.ts` — SvelteKit → Convex auth proxy
- `src/routes/+layout.server.ts` — SSR auth bootstrap
 
**Full architecture reference**: `src/reports/AUTH.md`

---

## Session resume checklist — quick onboarding (for assistants) ✅

Use this checklist when picking up the project in a new session to get productive quickly.

- Workspace root: `c:\projects\capstone\sandem`
- Dev server URL: `http://localhost:5173/` (start with `pnpm run dev`)

### Helpful scripts

- `pnpm install` — install dependencies
- `pnpm run dev` — start development server
- `pnpm run check` — run `svelte-check` diagnostics
- `pnpm run format` — run Prettier
- `pnpm run lint` — run ESLint
- `pnpm run build` — produce a production build
- `pnpm run test` — run unit tests in one-shot mode
- `pnpm run test:unit` — run Vitest in watch/interactive mode
- `pnpm run test:e2e:install-browsers` — one-time Playwright browser install
- `pnpm run test:e2e` — run E2E tests
- `pnpm run setup:test-user` — creates/verifies E2E auth user; skips by default if SITE_URL is unreachable (`SKIP_SETUP_TEST_USER_IF_SITE_UNREACHABLE=0` to fail hard)
- `pnpm run changeset` — wrapper that runs interactive prompt locally and a non-interactive status check in CI/audits
- `pnpm run release` — wrapper that skips publish when npm auth is missing; use `pnpm run release:publish` for strict publish behavior

### Key files & areas

- Global tokens & interactive states: `src/app.css`
- Header/layout shell: `src/lib/components/ui/navigation/AppHeader.svelte`
- Card component shell: `src/lib/components/ui/primitives/Card.svelte`
- Theme switcher: `src/lib/components/ui/theme/ThemeSwitcher.svelte`
- IDE route shell: `src/routes/(app)/[repo]/+layout.svelte`, `src/routes/(app)/[repo]/+layout.server.ts`
- Repo workspace controller (runtime + project orchestration): `src/lib/controllers/repo/RepoLayoutController.svelte.ts` and `src/lib/controllers/repo/RepoProjectsController.svelte.ts`
- Explorer controller suite (with action + state + panel controllers): `src/lib/controllers/explorer/*.svelte.ts`
- Explorer file-tree utilities: `src/lib/utils/file-tree.ts` (along with `src/lib/utils/project/filesystem.ts` for persistent node conversion)
- Git activity controller (real repository ops via isomorphic-git + WebContainer FS): `src/lib/controllers/activity/createGitActivity.svelte.ts`
- Terminal system (stores → services → hook → controller → presentation): `src/lib/stores/terminal/`, `src/lib/services/terminal/`, `src/lib/hooks/useTerminal.svelte.ts`, `src/lib/controllers/TerminalController.svelte.ts`, `src/lib/components/terminal/Terminal*.svelte`
- Editor assembly controller (services + hook wiring): `src/lib/controllers/EditorController.svelte.ts`
- Explorer/Convex sync scaffolding: `src/lib/hooks/explorer/createProjectSyncController.svelte.ts`, `src/lib/controllers/explorer/createExplorerActionsController.svelte.ts`
- Project folder sync helpers: `src/lib/utils/editor/projectFolderSync.ts`
- App-level SvelteKit error helpers: `src/lib/sveltekit/errors.ts`
- SvelteKit auth forwarding + timeout handling: `src/lib/sveltekit/index.ts`
- Lifecycle hooks: `src/lib/hooks/*`
- Editor lifecycle hook (reactive error/loading state wrapper): `src/lib/hooks/useEditor.svelte.ts`
- Monaco loader/static asset config (build-safe): `src/lib/services/editor/createMonacoConfig.svelte.ts`, `vite.config.ts`, `static/monaco/vs/*`
- UI command controllers: `src/lib/controllers/*`
- Runtime/persistence services: `src/lib/services/*`
- Editor derived UI helpers (pure): `src/lib/utils/ide/editorPaneView.ts`
- Layout and pages: `src/routes/+layout.svelte`, `src/routes/(home)/*`, `src/routes/repo/*`
- Project file-tree conversion utility: `src/lib/utils/project/filesystem.ts`
- Docker status reference: `README.md` (compose exists, root Dockerfile currently missing)
- Architecture docs hub: `docs/README.md` (ordered docs `00_...` through `11_...`)

### lib/ Organization (3-tier index.ts structure)

**New Structure** (updated 2026-03-22): Lib subdirectories now support single-line imports via consolidated index.ts files:

Tier 1 (Parent level): `src/lib/components/`, `src/lib/controllers/`, `src/lib/hooks/`, `src/lib/services/`, `src/lib/stores/`, `src/lib/context/`, `src/lib/utils/`

- Re-exports from domain-level (Tier 2) folders for convenient `import { Component } from '$lib/components'` patterns

Tier 2 (Domain level): Within each parent, folders like `activity/`, `editor/`, `explorer/`, `workspace/`, etc.

- Re-export their contained modules for convenient `import { handler } from '$lib/controllers/explorer'` patterns

Tier 3 (Leaf level): Actual implementation files (components, functions, types)

- Exported individually and aggregated through Tier 2 index files

Example imports (Domain level should always be first choice otherwise Leaf, avoid use Parent unless the file is in the parent dir):

```typescript
// Leaf level
import { createExplorerActionHandlers } from '$lib/controllers/explorer/createExplorerActionHandlers.svelte.js';

// Domain level
import { createExplorerActionHandlers } from '$lib/controllers/explorer';

// Parent level
import { createExplorerActionHandlers } from '$lib/controllers'; 
```

**Benefits**: Zero ambiguity (no `export *` conflicts), flexible import styles, clear dependency scoping.

Total structure: 38 index.ts files organized as 8 parent-level consolidators → 19 domain-level re-exporters → leaf-level implementations. All verified with `pnpm run check` (0 errors) and `pnpm run build` (success).

### Conventions & best practices

- Svelte 5 runes: prefer `$state`, `$props`, `$derived` (avoid legacy `export let` where possible)
- Use event attributes (`onclick`, `oninput`) instead of legacy `on:` syntax
- Keep architecture boundaries strict:
  - `src/lib/hooks/*` = lifecycle/composition hooks only
  - `src/lib/controllers/*` = UI command orchestration
  - `src/lib/services/*` = runtime/persistence/integration logic
  - Do not add compatibility re-export shims under `hooks/*`; import controllers/services directly where needed.
- Keep interactive states (hover, focus, active) in `src/app.css`; components should be layout-only shells and accept content via `$props` or `#snippet`
- Theme: controlled by `ThemeSwitcher.svelte`, stored in `localStorage`, and applied via `document.documentElement.dataset.theme`
- App-wide error shaping/formatting should use `createAppError`, `toAppError`, and `formatAppError` from `src/lib/sveltekit/errors.ts`
- Explorer: `createFileTree` should filter top-level roots to known workspace project folders when provided; nested files/folders remain fully recursive like VS Code.

### Workflow tips

- Run `pnpm run format` before `pnpm run lint` if formatting fails in CI
- Run `pnpm run check` to catch Svelte/TypeScript diagnostics

## Backend refactor + source-of-truth pattern

- Convex backend has been refactored into `src/convex/functions/*` for action/query logic and `src/convex/utils/*` for pure helpers.
- `src/convex/functions/projects.ts`, `src/convex/functions/filesystem.ts`, `src/convex/functions/auth.ts`, and `src/convex/functions/identity.ts` are now the authoritative storage/branch of truth for project state and filesystem operations.
- `src/convex/types/index.ts` and companion `*.d.ts` files represent the typed schema/API contract, with `filesystem.d.ts` added and `getPublicData` removed from the Auth API.
- Client and server integration should read/write through these Convex mutations/queries; the backend view gets propagated to the frontend via generated `$convex/_generated/api` bindings.
- Keep this section in sync as the backend evolves; new endpoints should be documented here as part of the agent checklist.

- Run `pnpm run test` after non-trivial logic changes
- For E2E on a fresh machine, run `pnpm run test:e2e:install-browsers` once first
- E2E specs should fail fast for missing auth credentials and runtime readiness; avoid silent early returns/reload-based retries when validating benchmark reliability
- When adding components, run the `svelte-autofixer` on generated code

### Quick troubleshooting

- If banner image 404s in dev, verify root assets `banner.webp` / `bannerDark.webp` exist and README references them correctly.
- If `docker compose up --build` fails, check `README.md` Docker section: the compose file references a root Dockerfile that is not currently present.
- If lint fails for formatting, run `pnpm run format` and re-run `pnpm run lint`.
- If explorer shows "WebContainer not ready", verify runtime boot via repo controller mount; the file tree now keeps polling and clears once the runtime is available.
- If auth endpoints intermittently fail with aborted fetches, verify `PUBLIC_CONVEX_SITE_URL` and current timeout behavior in `src/lib/sveltekit/index.ts`.
- If `setup:test-user` appears skipped, ensure frontend server is running at `SITE_URL` or set `SKIP_SETUP_TEST_USER_IF_SITE_UNREACHABLE=0` to enforce failure.
- If Monaco fails to boot in production, verify `static/monaco/vs/loader.js` and `static/monaco/vs/editor/editor.main.js` exist (copied by `monaco-static-assets` plugin in `vite.config.ts`) and that the app can serve `/monaco/vs/*`.

---
