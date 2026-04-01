# Workspace — Architecture & Data Flow

> **Philosophy: DI + pure functions.**
> Every layer receives its dependencies. `$state` lives exclusively in stores.
> WebContainer lifecycle, project CRUD, and editor sync are side-effects that
> belong in services. Components receive data through props and emit events
> upward through callbacks — they never import stores directly.

---

## Layer Map

```
src/routes/(app)/[repo]/
  +layout.server.ts                         ← thin coordinator: auth + loadWorkspace()
  +layout.svelte                            ← IDE shell: createWorkspaceController + onMount
  +page.svelte                              ← pane composition: Editor + Terminal + RightSidebar

src/lib/stores/panels/
  panel.store.svelte.ts                     ← createPanelsStore() — leftPane, downPane, rightPane

src/lib/stores/workspace/
  workspace.projects.store.svelte.ts        ← createWorkspaceProjectsStore() — projects, activeProjectId
  workspace.store.svelte.ts                 ← createWorkspaceStore() — composes projects only (NOT panels)

src/lib/services/panels/
  createPanelsService.svelte.ts             ← set/toggle/persist/reset logic for panel state

src/lib/hooks/
  usePanels.svelte.ts                       ← $effect: PanelsStore → PaneAPI expand/collapse
  useWorkspace.svelte.ts                    ← $effects + mount/cleanup; bridges store ↔ runtime

src/lib/controllers/panels/
  PanelsController.svelte.ts                ← self-contained: owns PanelsStore + service + usePanels
                                              exposes IDEPanelsAdapter for activity/editor/terminal

src/lib/services/workspace/
  createWorkspaceRuntime.svelte.ts          ← WebContainer lifecycle + project CRUD + derived state
  createWorkspaceEditorSync.svelte.ts       ← Liveblocks Yjs ↔ WebContainer ↔ Convex file bridge
  createWorkspaceProjects.svelte.ts         ← standalone project CRUD + path helpers service

src/lib/controllers/workspace/
  WorkspaceController.svelte.ts             ← assembly root; flat API consumed by +layout.svelte
  WorkspaceLoaderController.svelte.ts       ← pure SSR loader helpers
```

---

## Runtime Call Tree

```
Browser → /[repo]
│
├── +layout.server.ts
│     └── loadWorkspace(client, authState, currentUser, cookies)
│           ├── Authenticated → loadWorkspaceAuthenticated()
│           │     ├── mutation: api.users.ensureUserIdentity({})
│           │     ├── query:   api.projects.getAllProjects({ ownerId })
│           │     └── query:   api.filesystem.getWorkspaceTree({ ownerId })
│           └── Guest → loadWorkspaceGuest(client, guestId)
│                 └── mutation: api.users.ensureUserIdentity({ guestId })
│
└── +layout.svelte
      ├── useQuery(api.auth.getCurrentUser)       → currentUser (live, SSR-seeded)
      ├── useQuery(api.projects.getAllProjects)    → projectsResponse (live, SSR-seeded)
      │
      └── createWorkspaceController(...)
            ├── 1. createWorkspaceStore()
            │     └── createWorkspaceProjectsStore()  — projects[], activeProjectId ($state)
            │         NOTE: panels are NOT part of WorkspaceStore.
            │
            ├── 2. createPanelsController({ getSidebar })   ← self-contained panels system
            │     ├── createPanelsStore()             — leftPane, downPane, rightPane ($state)
            │     ├── createPanelsService(store)      — set/toggle/persist/reset
            │     ├── service.hydrate()               — restore localStorage on boot
            │     └── usePanels(store, service, getSidebar)
            │           └── $effect: store.leftPane → sidebar.expand/collapse
            │
            ├── 3. createWorkspaceRuntime(store, ...)
            │     ├── createRuntimeManager(...)       — WebContainer lifecycle
            │     ├── createRepoProjectManager(...)   — project CRUD (Convex mutations)
            │     └── $derived: folderMap, activeProject, statusText
            │
            ├── 4. createWorkspaceEditorSync(...)
            │     └── Liveblocks Yjs → WebContainer (75ms) + Convex (3s)
            │
            ├── 5. useWorkspace(store, runtime, ...)
            │     ├── $effect #1: getProjectsData() → syncProjects → store
            │     └── $effect #2: store.projects.activeProjectId → localStorage (untrack)
            │         NOTE: sidebar expand/collapse has moved to usePanels (step 2).
            │
            └── 6. setIDEContext(...)  → exposes panels + project + runtime surface
                  │   includes: getPanels() → IDEPanelsAdapter
                  │
                  onMount → ctrl.mount()
                    ├── store.projects.hydrate(initialProjects)
                    ├── localStorage → store.projects.setActiveProjectId
                    ├── runtime.startRuntime()
                    └── cleanup: destroyEditorSync + stopRuntime + remove window error listeners
```

---

## Store Responsibilities

| Store                    | Owns                                                    | Does NOT own                        |
| ------------------------ | ------------------------------------------------------- | ----------------------------------- |
| `PanelsStore`            | `leftPane`, `downPane`, `rightPane`                     | DOM calls (PaneAPI), IO             |
| `WorkspaceProjectsStore` | `projects[]`, `activeProjectId`, rename/delete UI state | localStorage, Convex, derived state |
| `WorkspaceStore`         | composes `projects` only                                | panels, everything else             |

`hydrate(initial)` — SSR injection point, called once by `useWorkspace.mount()`.
`setProjects(next)` — live update path, called by project sync effect and project manager.
`resetAll()` on panels — called by ErrorPanel recovery to restore all panes to visible.

---

## Panels System — Separation & DI Pattern

`PanelsController` is fully self-contained. It owns its `PanelsStore`, its service
(persistence + toggle logic), and the `usePanels` hook that syncs store → PaneAPI.
It has no dependency on `WorkspaceStore`.

```
PanelsController (createPanelsController)
  ├── PanelsStore      ← $state (leftPane, downPane, rightPane)
  ├── PanelsService    ← set/toggle/persist/hydrate
  └── usePanels        ← $effect: leftPane → sidebar.expand/collapse
        └── exposes IDEPanelsAdapter
```

### How panels reach consumers

There are two tiers of consumers:

**Tier 1 — layout-level (can receive props directly from +layout.svelte):**

```
+layout.svelte
  ├── <ActivityBar getPanels={() => ctrl.panels} />
  └── <Statusbar panels={ctrl.panels} />
```

**Tier 2 — page-level (behind the SvelteKit routing boundary):**

```
+page.svelte
  └── WorkspacePaneLayout   reads ide.getPanels()
Editor.svelte                reads ide.getPanels()
Terminal.svelte              reads ide.getPanels()
```

Page-level components cannot receive props across the SvelteKit
`{@render children()}` boundary, so they read panels through `IDEContext`
(the established DI mechanism for the entire workspace). `setIDEContext` in
`WorkspaceController` exposes `getPanels: () => panelsCtrl.panels`.

Writes always route through `IDEPanelsAdapter` setters, which call
`createPanelsService` so persistence always fires. Direct assignment to
store properties is not supported from outside `PanelsController`.

---

## `createWorkspaceEditorSync` — Editor Sync Bridge

```
Liveblocks Yjs doc  ──(every change)──►  WebContainer fs.writeFile  (75ms debounce)
                                     └──►  Convex upsertFile         (3s debounce)
```

| Method              | Trigger                               |
| ------------------- | ------------------------------------- |
| `watch(path, ydoc)` | File open                             |
| `flush(path)`       | File close — drains pending debounces |
| `unwatch(path)`     | File close                            |
| `flushAll()`        | CMD+S                                 |
| `destroy()`         | Layout unmount                        |

---

## `+layout.svelte` Usage Pattern

```ts
const ctrl = createWorkspaceController({
	getData: () => data,
	isGuest: () => isGuest,
	ownerId: () => currentUser?._id ?? null,
	convexClient,
	getSidebar: () => sidebar,
	getProjectsData: () => projectsResponse.data,
	getProjectsError: () => projectsResponse.error
});

// ctrl.panels (IDEPanelsAdapter) is passed to layout-level components directly.
// Page-level components (Editor, Terminal, WorkspacePaneLayout) read panels
// via requireIDEContext().getPanels() — no prop drilling through routing boundary.

onMount(() => {
	const cleanup = ctrl.mount();
	return () => {
		ctrl.destroyEditorSync();
		cleanup?.();
	};
});
```

`createWorkspaceController` must be called at the top of `<script>` — not in `onMount` — so `useWorkspace`'s `$effect` registrations execute in the correct Svelte reactive context.

The guest fallback casts `ownerId` to `'' as Id<'users'>` at the point of use inside the controller — the runtime never reads `ownerId` when `isGuest` is true so the empty string is a safe sentinel.

---

## WorkspaceController API Surface

| Category       | Properties / Methods                                                        |
| -------------- | --------------------------------------------------------------------------- |
| Lifecycle      | `mount`, `destroyEditorSync`                                                |
| Runtime state  | `runtimePhase`, `runtimeError`, `ready`, `statusText`                       |
| Panel object   | `panels` (IDEPanelsAdapter — pass to ActivityBar / Statusbar in layout)     |
| Panel state    | `leftPane`, `downPane`, `rightPane`                                         |
| Panel actions  | `setLeft`, `setDown`, `setRight`, `toggleLeft`, `toggleDown`, `toggleRight` |
|                | `resetPanes`                                                                |
| Project state  | `activeProjectId`                                                           |
| Runtime action | `startRuntime`                                                              |
| Editor sync    | `editorSync` (watch, unwatch, flush, flushAll, destroy)                     |

---

## IDEContext additions required

`src/lib/context/ide-context.ts` must include:

```ts
getPanels: () => IDEPanelsAdapter;
```

This is the hook used by `+page.svelte`, `Editor.svelte`, `Terminal.svelte`,
and `WorkspacePaneLayout.svelte` to access panel state without prop drilling
across the SvelteKit routing boundary.

---

## Files Reference

| File                                  | Purpose                                                   |
| ------------------------------------- | --------------------------------------------------------- |
| `+layout.server.ts`                   | Auth + `loadWorkspace()` coordinator                      |
| `+layout.svelte`                      | IDE shell, controller wiring, `onMount`                   |
| `+page.svelte`                        | Pane layout + snippet injection; reads panels via context |
| `panel.store.svelte.ts`               | Panel visibility `$state` — no IO                         |
| `workspace.projects.store.svelte.ts`  | Project list + selection `$state` — no IO                 |
| `workspace.store.svelte.ts`           | Store composition root — projects only, NOT panels        |
| `PanelsController.svelte.ts`          | Self-contained: PanelsStore + service + usePanels hook    |
| `WorkspacePaneLayout.svelte`          | PaneGroup layout — reads panels via IDE context           |
| `Statusbar.svelte`                    | Status bar — receives `panels` prop from +layout.svelte   |
| `Editor.svelte`                       | Editor root — reads panels via IDE context                |
| `Terminal.svelte`                     | Terminal root — reads panels via IDE context              |
| `createWorkspaceRuntime.svelte.ts`    | Runtime + project CRUD orchestration                      |
| `createWorkspaceEditorSync.svelte.ts` | Liveblocks ↔ WebContainer ↔ Convex bridge                 |
| `createWorkspaceProjects.svelte.ts`   | Standalone project CRUD + path helpers service            |
| `useWorkspace.svelte.ts`              | `$effects` + `mount()` / cleanup (no sidebar $effect)     |
| `usePanels.svelte.ts`                 | `$effect`: PanelsStore → PaneAPI expand/collapse          |
| `WorkspaceController.svelte.ts`       | Assembly root, flat API                                   |
| `WorkspaceLoaderController.svelte.ts` | Pure SSR loader helpers                                   |
