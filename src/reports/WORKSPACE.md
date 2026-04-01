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

src/lib/stores/workspace/
  workspace.panels.store.svelte.ts          ← createWorkspacePanelsStore() — leftPane, downPane, rightPane
  workspace.projects.store.svelte.ts        ← createWorkspaceProjectsStore() — projects, activeProjectId
  workspace.store.svelte.ts                 ← createWorkspaceStore() — composes the two above

src/lib/services/workspace/
  createWorkspaceRuntime.svelte.ts          ← WebContainer lifecycle + project CRUD + derived state
  createWorkspaceEditorSync.svelte.ts       ← Liveblocks Yjs ↔ WebContainer ↔ Convex file bridge
  createWorkspaceProjects.svelte.ts         ← standalone project CRUD + path helpers service

src/lib/hooks/
  useWorkspace.svelte.ts                    ← $effects + mount/cleanup; bridges store ↔ runtime

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
            │     ├── createWorkspacePanelsStore()    — leftPane, downPane, rightPane ($state)
            │     └── createWorkspaceProjectsStore()  — projects[], activeProjectId ($state)
            │
            ├── 2. createWorkspaceRuntime(store, ...)
            │     ├── createRuntimeManager(...)       — WebContainer lifecycle
            │     ├── createRepoProjectManager(...)   — project CRUD (Convex mutations)
            │     └── $derived: folderMap, activeProject, statusText
            │
            ├── 3. createWorkspaceEditorSync(...)
            │     └── Liveblocks Yjs → WebContainer (75ms) + Convex (3s)
            │
            ├── 4. useWorkspace(store, runtime, ...)
            │     ├── $effect #1: getProjectsData() → syncProjects → store
            │     ├── $effect #2: store.panels.leftPane → sidebar.expand/collapse (untrack)
            │     └── $effect #3: store.projects.activeProjectId → localStorage (untrack)
            │
            └── 5. setIDEContext(...)  → ActivityBar, Sidebar, Explorer, Editor via Svelte context
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
| `WorkspacePanelsStore`   | `leftPane`, `downPane`, `rightPane`                     | DOM calls (PaneAPI), IO             |
| `WorkspaceProjectsStore` | `projects[]`, `activeProjectId`, rename/delete UI state | localStorage, Convex, derived state |
| `WorkspaceStore`         | composes the two above                                  | everything else                     |

`hydrate(initial)` — SSR injection point, called once by `useWorkspace.mount()`.
`setProjects(next)` — live update path, called by project sync effect and project manager.
`resetAll()` on panels — called by ErrorPanel recovery to restore all panes to visible.

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
	ownerId: () => currentUser?._id ?? null, // null = useQuery 'skip' sentinel
	convexClient,
	getSidebar: () => sidebar,
	getProjectsData: () => projectsResponse.data,
	getProjectsError: () => projectsResponse.error
});

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

| Category       | Properties / Methods                                                                |
| -------------- | ----------------------------------------------------------------------------------- |
| Lifecycle      | `mount`, `destroyEditorSync`                                                        |
| Runtime state  | `runtimePhase`, `runtimeError`, `ready`, `statusText`                               |
| Panel state    | `leftPane`, `downPane`, `rightPane`, `setLeft`, `setDown`, `setRight`, `resetPanes` |
| Project state  | `activeProjectId`                                                                   |
| Runtime action | `startRuntime`                                                                      |
| Editor sync    | `editorSync` (watch, unwatch, flush, flushAll, destroy)                             |

---

## Files Reference

| File                                  | Purpose                                           |
| ------------------------------------- | ------------------------------------------------- |
| `+layout.server.ts`                   | Auth + `loadWorkspace()` coordinator              |
| `+layout.svelte`                      | IDE shell, controller wiring, `onMount`           |
| `+page.svelte`                        | Pane layout + snippet injection (pure structural) |
| `workspace.panels.store.svelte.ts`    | Panel visibility `$state` — no IO                 |
| `workspace.projects.store.svelte.ts`  | Project list + selection `$state` — no IO         |
| `workspace.store.svelte.ts`           | Store composition root                            |
| `createWorkspaceRuntime.svelte.ts`    | Runtime + project CRUD orchestration              |
| `createWorkspaceEditorSync.svelte.ts` | Liveblocks ↔ WebContainer ↔ Convex bridge         |
| `createWorkspaceProjects.svelte.ts`   | Standalone project CRUD + path helpers service    |
| `useWorkspace.svelte.ts`              | `$effects` + `mount()` / cleanup                  |
| `WorkspaceController.svelte.ts`       | Assembly root, flat API                           |
| `WorkspaceLoaderController.svelte.ts` | Pure SSR loader helpers                           |

## Deleted / Superseded Files

| Old File                                            | Replaced by                           |
| --------------------------------------------------- | ------------------------------------- |
| `controllers/repo/RepoLayoutController.svelte.ts`   | `WorkspaceController.svelte.ts`       |
| `controllers/repo/RepoProjectsController.svelte.ts` | `useWorkspace` Effect #1              |
| `controllers/repo/RepoController.svelte.ts`         | Split across store + runtime + hook   |
| `controllers/LiveblocksSyncController.svelte.ts`    | `createWorkspaceEditorSync.svelte.ts` |
| `controllers/LoaderController.svelte.ts`            | `WorkspaceLoaderController.svelte.ts` |
