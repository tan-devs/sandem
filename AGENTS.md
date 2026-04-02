You are able to use the Svelte MCP server, where you have access to comprehensive Svelte 5 and SvelteKit documentation. Here's how to use the available tools effectively:

> Last updated: 2026-04-01

## Available MCP Tools

### 1. list-sections

Use this FIRST to discover all available documentation sections. Returns a structured list with titles, use_cases, and paths. When asked about Svelte or SvelteKit topics, ALWAYS use this tool at the start of the chat to find relevant sections.

### 2. get-documentation

Retrieves full documentation content for specific sections. After calling list-sections, you MUST analyze returned sections (especially the use_cases field) and fetch ALL sections relevant to the task.

### 3. svelte-autofixer

Analyzes Svelte code and returns issues and suggestions. You MUST use this tool whenever writing Svelte code before sending it to the user. Keep calling it until no issues or suggestions are returned.

### 4. playground-link

Generates a Svelte Playground link. Only call after user confirmation and NEVER if code was written to files in their project.

---

## Core Directives

1. **Svelte 5 First**: Always prefer Runes (`$state`, `$props`, `$derived`) over Svelte 4 store/export syntax.
2. **Event Attributes**: Use `onclick`, `oninput`, etc. instead of `on:click` or `on:input`.
3. **DI + Pure Functions**: Components receive props and emit via callbacks. Services receive all dependencies. No layer reaches into a sibling or parent. `$state` lives exclusively in stores.
4. **No singleton store imports in components**: Components get data through props or context (`getIDEContext()`), never by importing stores directly.
5. **`/repo` Auth Gating**: Demo mode is guest-only. If authenticated, always run the full workspace flow — do not gate by project count.
6. **Starter Seed on First Visit**: For authenticated owners with zero projects, rely on `ensureUserIdentity` (which calls `seedStarterProjectForOwner` on first insert).
7. **Explorer Multi-root Contract**: In authenticated `/repo`, the WebContainer root is a multi-project workspace. Folder names are slugified Convex project titles. Explorer treats those as canonical top-level roots.
8. **Explorer Startup**: Explorer must not require manual refresh. Keep silent polling + bootstrap retries active so post-boot mount races self-heal.
9. **Explorer Action UX**: Use non-blocking in-panel dialogs (not `window.prompt`/`window.confirm`).
10. **Keep docs current**: Update `AGENTS.md` and relevant `.md` files whenever significant refactors happen.
11. **svelte-autofixer**: Run on EVERY code generation before sending to user.

---

## Styling Conventions

- **Token Layers**: Strict separation between Primitive Tokens (raw values) and Semantic Tokens (roles like `--color-brand`).
- **Global over scoped**: Interactive states (hover, active, focus) and base resets go in `app.css`.
- **Centering**: `display: grid; place-items: center;`
- **3-section headers**: `display: grid; grid-template-columns: 1fr auto 1fr;`

---

## Import Conventions (3-tier index.ts)

Prefer domain-level imports; fall back to leaf; avoid parent unless the file is at the parent level.

```typescript
// Domain level (preferred)
import { createExplorerController } from '$lib/controllers/explorer';
import { createWorkspaceController } from '$lib/controllers/workspace';

// Leaf level (when domain barrel doesn't export it)
import { createWorkspaceEditorSync } from '$lib/services/workspace/createWorkspaceEditorSync.svelte.js';

// Parent level (only for files directly in the parent dir)
import { createWorkspaceController } from '$lib/controllers';
```

---

## Architecture Systems

Each system follows the same layering: **Store → Service → Hook → Controller → Component**.
Read the relevant `.md` file before touching any system. Do not restructure without reading it.

### Workspace (IDE Shell + WebContainer + Projects)

> **Status: active.** `WorkspaceController` is the assembly root. `setupRepoLayout` / `syncRepoProjects` / `RepoLayoutController` / `RepoProjectsController` are deleted — do not re-add them.

- Assembly root: `src/lib/controllers/workspace/WorkspaceController.svelte.ts` → `createWorkspaceController()`
- SSR loader: `src/lib/controllers/workspace/WorkspaceLoaderController.svelte.ts` → `loadWorkspace()`
- Runtime service: `src/lib/services/workspace/createWorkspaceRuntime.svelte.ts`
- Editor sync bridge: `src/lib/services/workspace/createWorkspaceEditorSync.svelte.ts`
- Stores: `src/lib/stores/workspace/` (panels + projects)
- Hook: `src/lib/hooks/useWorkspace.svelte.ts`
- **Full reference**: `WORKSPACE.md`

**Deleted files — do not re-add:**

| Deleted                                             | Replaced by                           |
| --------------------------------------------------- | ------------------------------------- |
| `controllers/repo/RepoLayoutController.svelte.ts`   | `WorkspaceController.svelte.ts`       |
| `controllers/repo/RepoProjectsController.svelte.ts` | `useWorkspace` Effect #1              |
| `controllers/LoaderController.svelte.ts`            | `WorkspaceLoaderController.svelte.ts` |

### Explorer (File Tree + Sync)

> **Status: stable.** Follows the same DI/PF pattern as Terminal.

- Controller: `src/lib/controllers/ExplorerController.svelte.ts` → `createExplorerController()`
- Services: `src/lib/services/explorer/createFileTree.svelte.ts`, `createProjectSync.svelte.ts`
- Store: `src/lib/stores/explorer/explorer.state.store.svelte.ts`
- Utils: `src/lib/utils/explorer/explorer-ops.ts`, `file-tree.ts`, `file-system.ts`
- Hook: `src/lib/hooks/useExplorer.svelte.ts`
- **Full reference**: `EXPLORER.md`

**Deleted files — do not re-add:**

| Deleted                                          | Replaced by                                      |
| ------------------------------------------------ | ------------------------------------------------ |
| `controllers/ExplorerContoller.svelte.ts` (typo) | `controllers/ExplorerController.svelte.ts`       |
| `controllers/FileTreeController.svelte.ts`       | `services/explorer/createFileTree.svelte.ts`     |
| `controllers/StateController.svelte.ts`          | `stores/explorer/explorer.state.store.svelte.ts` |
| `services/explorer/createExplorer.svelte.ts`     | `utils/explorer/explorer-ops.ts`                 |
| `utils/ide/explorerTreeOps.ts`                   | `utils/explorer/explorer-ops.ts`                 |

### Terminal

> **Status: stable. Reference implementation** of DI + PF in this codebase.

- Controller: `src/lib/controllers/TerminalController.svelte.ts` → `createTerminalController()`
- Services: `src/lib/services/terminal/createTerminalWorkspace.svelte.ts`, `createTerminalShell.svelte.ts`
- Stores: `src/lib/stores/terminal/`
- Hook: `src/lib/hooks/useTerminal.svelte.ts`
- **Full reference**: `TERMINAL.md`

**Deleted files — do not re-add:**

| Deleted                            | Replaced by                                        |
| ---------------------------------- | -------------------------------------------------- |
| `createTerminalPanel.svelte.ts`    | `terminal.panel.store.svelte.ts`                   |
| `createTerminalSessions.svelte.ts` | `terminal.session.store.svelte.ts` + `useTerminal` |
| `createTerminal.svelte.ts`         | `Terminal.svelte` imports controller directly      |

### Editor

> **Status: functional — DI/PF cleansing in progress.** Do not model new features on Editor until gaps in `EDITOR.md` are resolved. Use Terminal as the reference instead.

- Controller: `src/lib/controllers/EditorController.svelte.ts` → `createEditorController()`
- Services: `src/lib/services/editor/` (createEditor, createEditorAutoSaver, createEditorFileWriter, createEditorStatus, createEditorActions)
- Store: `src/lib/stores/editor.store.svelte.ts`
- Hook: `src/lib/hooks/useEditor.svelte.ts`
- **Full reference**: `EDITOR.md`

**Known gaps** (fix in a dedicated pass, not piecemeal):

- `getCanWrite` accepted by controller but never threaded into the runtime — read-only mode not enforced
- `activity` parameter stored but never used
- `collaborationPermissionsStore` subscribed manually in `Editor.svelte` instead of via hook
- `editorStore` imported as singleton in `Editor.svelte` — should be injected

### Auth

> **Status: stable.** Two-table identity: Better Auth component tables (sessions/OAuth/JWKS) + your `users` table (app identity, ownership FKs, guest support). Never query Better Auth's internal tables from app code.

- Convex component: `src/convex/convex.config.ts`
- JWT config: `src/convex/config/auth.config.ts`
- Auth functions: `src/convex/functions/auth.ts` (`authComponent`, `createAuth`, `getCurrentUser`)
- Identity upsert: `src/convex/functions/users.ts` → `ensureUserIdentity()`
- SvelteKit helpers: `src/lib/sveltekit/index.ts` (`getToken`, `getAuthState`, `createConvexHttpClient`, `createSvelteKitHandler`)
- Proxy route: `src/routes/api/auth/[...path]/+server.ts`
- **Full reference**: `AUTH.md`

---

## Backend Source of Truth

- `src/convex/functions/projects.ts` — project CRUD + ownership guards
- `src/convex/functions/filesystem.ts` — node/file CRUD
- `src/convex/functions/auth.ts` — session + identity
- `src/convex/functions/users.ts` — user upsert + guest support
- `src/convex/types/index.ts` — typed schema/API contract

All client reads/writes go through `$convex/_generated/api` bindings. Document new endpoints here when added.

---

## Session Resume Checklist

- **Workspace root**: `c:\projects\capstone\sandem`
- **Dev server**: `http://localhost:5173/` — start with `pnpm run dev`

### Scripts

| Command                              | Purpose                                               |
| ------------------------------------ | ----------------------------------------------------- |
| `pnpm install`                       | Install dependencies                                  |
| `pnpm run dev`                       | Start dev server                                      |
| `pnpm run check`                     | Svelte/TypeScript diagnostics                         |
| `pnpm run format`                    | Prettier                                              |
| `pnpm run lint`                      | ESLint (run format first if it fails)                 |
| `pnpm run build`                     | Production build                                      |
| `pnpm run test`                      | Unit tests (one-shot)                                 |
| `pnpm run test:unit`                 | Vitest watch mode                                     |
| `pnpm run test:e2e`                  | E2E tests                                             |
| `pnpm run test:e2e:install-browsers` | One-time Playwright browser install                   |
| `pnpm run setup:test-user`           | Creates E2E auth user (skips if SITE_URL unreachable) |

### Key Files

| Area                               | File                                                                     |
| ---------------------------------- | ------------------------------------------------------------------------ |
| Global tokens + interactive states | `src/app.css`                                                            |
| Theme switcher                     | `src/lib/components/ui/theme/ThemeSwitcher.svelte`                       |
| App header                         | `src/lib/components/ui/navigation/AppHeader.svelte`                      |
| IDE shell                          | `src/routes/(app)/[repo]/+layout.svelte`                                 |
| IDE server load                    | `src/routes/(app)/[repo]/+layout.server.ts`                              |
| IDE page                           | `src/routes/(app)/[repo]/+page.svelte`                                   |
| SvelteKit auth helpers             | `src/lib/sveltekit/index.ts`                                             |
| App error helpers                  | `src/lib/sveltekit/errors.ts`                                            |
| Monaco static config               | `src/lib/services/editor/createMonacoConfig.svelte.ts`, `vite.config.ts` |

### Quick Troubleshooting

- **Explorer shows "WebContainer not ready"**: verify runtime boot via workspace controller mount; file tree keeps polling until runtime is available.
- **Auth endpoints failing with aborted fetches**: check `PUBLIC_CONVEX_SITE_URL` and timeout behavior in `src/lib/sveltekit/index.ts`.
- **Lint fails for formatting**: run `pnpm run format` then re-run `pnpm run lint`.
- **Monaco fails in production**: verify `static/monaco/vs/loader.js` and `static/monaco/vs/editor/editor.main.js` exist (copied by `monaco-static-assets` plugin in `vite.config.ts`).
- **`setup:test-user` appears skipped**: set `SKIP_SETUP_TEST_USER_IF_SITE_UNREACHABLE=0` to enforce failure.
- **Convex dashboard shows `*` on component**: run `npx convex dev` to resolve.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `src\convex\functions/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.

<!-- convex-ai-end -->
