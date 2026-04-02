# Workspace System

> **Philosophy: DI + pure functions.**
> `$state` lives exclusively in stores. Services handle side effects.
> Components receive data through props and read cross-boundary deps via
> IDEContext — they never import stores directly.

---

## Layer Map

```
src/routes/(app)/[repo]/
  +layout.server.ts                ← auth + loadWorkspace() → RepoLayoutData
  +layout.svelte                   ← IDE shell: consumes sandbox context + createWorkspaceController
  +page.svelte                     ← pane composition: reads panels via requireIDEContext()

src/lib/services/webcontainer/
  createWebcontainerSingleton.svelte.ts  ← module-level WC singleton, booted at (app) layout level
  createWebcontainer.svelte.ts           ← createRuntimeManager + getWebContainer()

src/lib/context/
  sandbox-context.ts               ← SandboxContext: WC singleton + preloaded projects
  ide-context.ts                   ← IDEContext: runtime, panels, editor sync
  workspace-context.ts             ← WorkspaceContext: project CRUD surface

src/lib/stores/
  panel.store.svelte.ts            ← createPanelsStore() — leftPane, downPane, rightPane
  workspace.projects.store.ts      ← createWorkspaceProjectsStore() — projects[], activeProjectId
  workspace.store.svelte.ts        ← createWorkspaceStore() — composes projects only

src/lib/controllers/
  workspace/WorkspaceController.svelte.ts   ← assembly root; flat API for [repo]/+layout.svelte
  workspace/LoaderController.svelte.ts      ← pure SSR loader helpers
  panels/PanelsController.svelte.ts         ← self-contained: PanelsStore + service + usePanels

src/lib/services/workspace/
  createWorkspaceRuntime.svelte.ts      ← WebContainer lifecycle + project CRUD + derived state
  createWorkspaceEditorSync.svelte.ts   ← Liveblocks Yjs ↔ WebContainer ↔ Convex bridge

src/lib/hooks/
  usePanels.svelte.ts              ← $effect: PanelsStore → PaneAPI expand/collapse
  useWorkspace.svelte.ts           ← $effects: project sync + activeProjectId persistence
```

---

## Runtime Call Tree

```
Browser hits any (app) route
└── (app)/+layout.svelte
      ├── createSvelteAuthClient()
      ├── setSandboxContext({ wc: wcSingleton, getPreloadedProjects, isGuest })
      └── onMount → wcSingleton.boot()

Browser navigates to /[repo]
│
├── +layout.server.ts
│     └── loadWorkspace(client, authState, currentUser, cookies)
│           ├── Authenticated → ensureUserIdentity + getAllProjects + getWorkspaceTree
│           └── Guest         → ensureUserIdentity({ guestId })
│
└── +layout.svelte
      ├── requireSandboxContext()
      ├── useAuth()
      ├── useQuery(getCurrentUser,  initialData: data.currentUser)
      ├── useQuery(getAllProjects,   initialData: sandbox.getPreloadedProjects())
      │
      └── createWorkspaceController({ getExternalWebcontainer: wc.getWebcontainer, ... })
            ├── 1. createWorkspaceStore()
            │     └── createWorkspaceProjectsStore()
            │
            ├── 2. createPanelsController({ getSidebar })
            │     ├── createPanelsStore()
            │     ├── createPanelsService(store)
            │     └── usePanels → $effect: leftPane → sidebar.expand/collapse
            │
            ├── 3. createWorkspaceRuntime({ getExternalWebcontainer, ... })
            │     ├── createRuntimeManager    ← skips WebContainer.boot(), uses singleton
            │     ├── createRepoProjectManager
            │     └── $derived: activeProject, statusText
            │
            ├── 4. createWorkspaceEditorSync(...)
            │
            ├── 5. useWorkspace(store, runtime, ...)
            │
            └── 6. setIDEContext + setWorkspaceContext
                  onMount → ctrl.mount()
                    ├── store.projects.hydrate(initialProjects)
                    ├── localStorage → activeProjectId
                    └── runtime.startRuntime()   ← mount + install only, boot already done
```

---

## WC Singleton

Module-level instance shared across the entire app lifetime.

```
wcSingleton.boot()                — idempotent, returns same promise on repeat calls
wcSingleton.getWebcontainer()     — sync, throws if phase !== 'ready'
wcSingleton.waitForWebcontainer() — async, safe to call anytime
```

`createRuntimeManager` accepts `getExternalWebcontainer?: () => Promise<WebContainer>`.
When provided it skips `WebContainer.boot()` and uses the singleton.
`stopRuntime()` skips `teardown()` since it doesn't own the instance.

Pass `wcSingleton.waitForWebcontainer` (async, always safe) — **not**
`wcSingleton.getWebcontainer` (sync, throws if boot isn't complete yet).

---

## Store Responsibilities

| Store                    | Owns                                                    | Does NOT own                        |
| ------------------------ | ------------------------------------------------------- | ----------------------------------- |
| `PanelsStore`            | `leftPane`, `downPane`, `rightPane`                     | DOM calls, IO                       |
| `WorkspaceProjectsStore` | `projects[]`, `activeProjectId`, rename/delete UI state | localStorage, Convex, derived state |
| `WorkspaceStore`         | composes `projects` only                                | panels, everything else             |

---

## Panels — Two Consumer Tiers

**Tier 1 — layout-level** (props from `[repo]/+layout.svelte`):

```
<ActivityBar getPanels={() => ctrl.panels} />
<Statusbar panels={ctrl.panels} />
<SidebarPanel getPanels={() => ctrl.panels} />
```

**Tier 2 — page-level** (via IDEContext across routing boundary):

```
+page.svelte → requireIDEContext() → ide.getPanels!()
```

Writes always route through `IDEPanelsAdapter` → `createPanelsService`.

---

## Editor Sync Bridge

```
Liveblocks Yjs doc ──► WebContainer fs.writeFile  (75ms debounce)
                   └──► Convex upsertFile          (3s debounce)
```

| Method          | Trigger        |
| --------------- | -------------- |
| `watch(path)`   | File open      |
| `unwatch(path)` | File close     |
| `flushAll()`    | CMD+S          |
| `destroy()`     | Layout unmount |

---

## WorkspaceController API Surface

## ownerId Contract

`WorkspaceControllerOptions.ownerId` accepts `() => string`.

- **Authenticated users** — pass `currentUser._id` (an `Id<'users'>`, which satisfies `string`)
- **Guests** — pass a UUID from `localStorage` (`getOrCreateGuestId()`)

The cast to `Id<'users'>` happens once, inside `WorkspaceController`, at the
`createWorkspaceRuntime` boundary. Guest Convex operations are skipped at the
service layer so the cast is safe at runtime.

---

| Category       | Properties / Methods                                             |
| -------------- | ---------------------------------------------------------------- |
| Lifecycle      | `mount`, `destroyEditorSync`                                     |
| Runtime        | `runtimePhase`, `runtimeError`, `ready`, `statusText`            |
| Panels         | `panels` (IDEPanelsAdapter), `leftPane`, `downPane`, `rightPane` |
| Panel actions  | `setLeft/Down/Right`, `toggleLeft/Down/Right`, `resetPanes`      |
| Projects       | `activeProjectId`                                                |
| Runtime action | `startRuntime`                                                   |
| Editor sync    | `editorSync` (watch, unwatch, flush, flushAll, destroy)          |

---

## IDEContext Shape

```ts
interface IDEContext {
	getWebcontainer: () => WebContainer;
	getProject: (path?: string) => Project | undefined;
	getEntryPath: () => string | undefined;
	editorSync?: WorkspaceEditorSync;
	getPanels?: () => IDEPanelsAdapter;
}
```
