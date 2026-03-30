# Explorer — Architecture & Data Flow

> **Philosophy: Data Injection (DI) + Pseudo-Pure Functions**
>
> State lives exclusively in stores. Services own runtime orchestration (IO, WebContainer, Convex). Utils are pure or pseudo-pure (all deps injected as parameters). The hook bridges store → mount lifecycle. The controller is the only composition point. Components receive everything as props and emit everything through callbacks.

---

## Layer Map

```
stores/explorer/
  explorer.state.store.svelte.ts  ← selectedPath, searchQuery, openSections — zero IO

services/explorer/
  createFileTree.svelte.ts        ← WebContainer FS reader + adaptive auto-refresh
  createProjectSync.svelte.ts     ← Convex mutations + Liveblocks broadcast (renamed from projectFilesSync)

utils/explorer/
  file-tree.ts                    ← readDirRecursive, createSignature, pruneExpandedState, findNodeByPath
  file-system.ts                  ← nodesToFileSystemTree, path helpers
  explorer-ops.ts                 ← filterNodesByQuery, getPathsToExpand, findNode, getAllDirectoryPaths,
                                     validateProjectRelativePath, ExplorerActionContext,
                                     handleCreate*, handleRename*, handleDelete*, handleRefresh*, handleExpand*

hooks/
  useExplorer.svelte.ts           ← $effect (search→expand) + mount() (keyboard, pointer, bootstrap)

controllers/
  ExplorerController.svelte.ts    ← assembly root; instantiates store + services; returns flat API

components/explorer/
  Explorer.svelte                 ← wiring root; calls createExplorerController + useExplorer; onMount(mount)
  ExplorerContent.svelte          ← layout shell + prop router (~30 props → children)
  ExplorerFilesSection.svelte     ← search input + FileTreeView + context menu host
  ExplorerOpenEditors.svelte      ← open editor tabs list
  ExplorerProjectInfo.svelte      ← project metadata panel
  ExplorerOutline.svelte          ← active-file symbol outline
  ExplorerTimeline.svelte         ← action/error history log
  ExploerContextMenu.svelte       ← right-click menu (full keyboard nav)
```

---

## File Hierarchy (runtime call tree)

```
Sidebar.svelte
└── Explorer.svelte
      ├── createExplorerController({ ide, editorStore })
      │     ├── createExplorerStateStore()          ← pure $state
      │     ├── createFileTree(getWebcontainer)     ← WC FS service
      │     ├── createProjectSync(deps)             ← Convex/Liveblocks service
      │     └── returns flat ExplorerController API
      │
      ├── useExplorer(explorer, getActivityTab)
      │     ├── $effect: search → auto-expand dirs
      │     └── returns { mount }
      │
      ├── $effect: auto-open entry file on first boot
      ├── onMount(mount)                            ← keyboard, pointer, bootstrap
      │
      └── <ExplorerContent ...30 props />
            ├── <ExplorerOpenEditors />
            ├── <ExplorerFilesSection />
            │     └── <ExploerContextMenu />
            ├── <ExplorerProjectInfo />
            ├── <ExplorerOutline />
            └── <ExplorerTimeline />
```

---

## Layer-by-Layer

### `stores/explorer/explorer.state.store.svelte.ts`

**Exports:** `createExplorerStateStore()`, `ExplorerStateStore`

Owns all UI selection/search/section state. No IO, no services, no Svelte imports except `$state`/`$derived` runes.

| State          | Type                 | Description                     |
| -------------- | -------------------- | ------------------------------- |
| `selectedPath` | `string \| null`     | Currently selected tree node    |
| `searchQuery`  | `string`             | Active search query             |
| `hasSearch`    | `boolean` ($derived) | `searchQuery.trim().length > 0` |
| `openSections` | `string[]`           | Accordion open state            |

Key methods: `selectNode`, `setSearchQuery`, `clearSearch`, `handleClick` (double-click detection), `reset`.

---

### `services/explorer/createFileTree.svelte.ts`

**Exports:** `createFileTree()`, `FileTreeService`, `FileTreeServiceOptions`

Owns `tree`, `loading`, `error`, `expanded` as `$state`. Reads WebContainer FS via `readDirRecursive`, compares signatures to avoid unnecessary re-renders, prunes `expanded` state when paths disappear.

Auto-refresh is adaptive: starts at 850 ms, backs off to 6 s as the tree stabilises.

**API surface:** `tree`, `loading`, `error`, `isReady()`, `refresh()`, `toggleDir()`, `isExpanded()`, `startAutoRefresh()`, `stopAutoRefresh()`

---

### `services/explorer/createProjectSync.svelte.ts`

**Exports:** `createProjectSync()`, `ProjectSyncService`, `ProjectSyncDeps`

Renamed from `projectFilesSync` — signature and body unchanged, only the factory name updated to match the `create*` convention.

**API surface:** `canWrite()`, `createFile()`, `createDirectory()`, `renamePath()`, `deletePath()`, `stop()`

---

### `utils/explorer/explorer-ops.ts`

**Exports:** `ExplorerActionContext` type + all tree query utilities + all action handlers.

**Tree utilities (pure):**

- `filterNodesByQuery(nodes, query)` — recursive VS Code-style filter
- `getPathsToExpand(filteredTree, query)` — Set of dir paths to auto-expand on search
- `findNode(nodes, path)` — depth-first path lookup
- `getAllDirectoryPaths(nodes)` — flat list of all dir paths (for expand/collapse all)
- `validateProjectRelativePath(path)` — strips leading slashes, rejects `..`, throws on empty

**Action handlers (pseudo-pure — all deps in `ExplorerActionContext`):**

`ExplorerActionContext` carries: `fileTree`, `projectSync`, `editorOpenFile`, `getWebcontainer`, `getActiveProject`, `tree`, `selectedPath`, `onMessage`, `onError`.

Guard pattern used consistently across all write handlers:

1. `projectSync.canWrite()` → if false, `onError` + return false
2. Validate/normalize path
3. WebContainer op (where applicable)
4. Convex/sync op via `projectSync`
5. `fileTree.refresh()`
6. `onMessage(success)` → return true / `onError(catch)` → return false

---

### `hooks/useExplorer.svelte.ts`

**Exports:** `useExplorer(explorer, getActivityTab)`

Called during `Explorer.svelte` script evaluation so `$effect` runs in the correct reactive context.

**$effect registered:**

- Search expansion: when `explorer.hasSearch` is true, iterates `explorer.expandOnSearch` and calls `explorer.toggleDir` for any unexpanded path.

**`mount()` handles (called in `onMount`):**

- `window` keyboard shortcuts: `Cmd/Ctrl+N` (new file), `Shift+N` (new folder), `F2` (rename), `Delete` (delete), `Escape` (close dialog/menu)
- `window` pointer-down: close context menu on outside click
- `fileTree.startAutoRefresh(850)`
- Stabilised bootstrap loop (up to 80 silent refreshes × 300 ms, stops when tree length is stable for 3 consecutive reads)

Returns cleanup: removes listeners, stops auto-refresh, calls `projectSync.stop()`, calls `explorer.reset()`.

---

### `controllers/ExplorerController.svelte.ts`

**Exports:** `createExplorerController(deps)`, `ExplorerController` type, `ExplorerControllerDeps`

The only file that instantiates all three inner pieces (state store, file tree service, project sync service). Computes all `$derived` values (`filteredTree`, `expandOnSearch`, `activeProject`, `nodeCount`, `isOwner`, `tabs`, `activeTabPath`). Manages dialog + context menu lifecycle. Assembles `buildActionContext()` and dispatches to action handlers. Returns a single flat object with ~35 getters/methods for `Explorer.svelte`.

**Notable internal helper — `buildActionContext(overrides?)`:**
Assembles the full `ExplorerActionContext` from current state at call time. Optional overrides let dialog actions substitute `selectedPath` with `dialogState.targetPath`.

---

### `Explorer.svelte` — Wiring Root

Calls `createExplorerController` in script, calls `useExplorer` to get `mount`, registers one `$effect` (entry-file auto-open), passes `mount` to `onMount`. Fans the full controller API surface to `<ExplorerContent>` as props.

**Why entry-file `$effect` lives here and not in the hook:**
It needs both `ide.getEntryPath()` (from IDEContext) and `editorStore.tabs` (from the editor store), both of which are component-scoped. Putting it in the hook would require threading extra deps.

---

## Data Flow

```
Convex DB ──────────────────────────────────────────────────────────┐
Liveblocks room ──────────────────────────────────────────────────┐  │
WebContainer FS ────────────────────────────────────────────────┐  │  │
                                                                │  │  │
ide-context.ts (Svelte context)                                 │  │  │
  getWebcontainer() ─────────────────────────────────────────── ┤  │  │
  getProject() → Project { nodes[], isOwner }                   │  │  │
  getWorkspaceProjects()                                        │  │  │
  selectProject()                                               │  │  │
       │                                                        │  │  │
       ▼                                                        ▼  ▼  ▼
 Explorer.svelte                                    ExplorerController
       │  createExplorerController()                      │
       │◄─────────────────────────────────────────────── ┤
       │                                                  │
       │  useExplorer(explorer, getActivityTab)           │
       │  → registers $effect (search expand)             │
       │  → returns { mount }                             │
       │                                                  │
       │  $effect: entry-file auto-open                   │
       │  onMount(mount) ← keyboard, pointer, bootstrap   │
       │                                                  │
       ▼                                                  │
 ExplorerContent.svelte ◄──────────────────────────────── ┘
 (~30 props as flat spread)
       │
       ├──► ExplorerOpenEditors   (tabs, activeTabPath, onOpenFile, onCloseTab)
       ├──► ExplorerFilesSection  (tree, filteredTree, search, selection, callbacks)
       │         └──► ExploerContextMenu
       ├──► ExplorerProjectInfo   (activeProject, folderName, nodeCount, isOwner)
       ├──► ExplorerOutline       (activeFilePath)
       └──► ExplorerTimeline      (timelineEvents, onOpenPath)
```

---

## Deleted Files

The following files were removed. Do not re-add them.

| Deleted file                                 | Replaced by                                               |
| -------------------------------------------- | --------------------------------------------------------- |
| `controllers/ExplorerContoller.svelte.ts`    | `controllers/ExplorerController.svelte.ts` (typo fixed)   |
| `controllers/FileTreeController.svelte.ts`   | `services/explorer/createFileTree.svelte.ts`              |
| `controllers/StateController.svelte.ts`      | `stores/explorer/explorer.state.store.svelte.ts`          |
| `services/explorer/createExplorer.svelte.ts` | `utils/explorer/explorer-ops.ts` (action handlers merged) |
| `utils/ide/explorerTreeOps.ts`               | `utils/explorer/explorer-ops.ts` (tree utils merged)      |

---

## Key Design Decisions

### Why is `mount()` never called inside `useExplorer` itself?

`window.addEventListener` and `setTimeout`-based bootstrap loops are browser-only. Calling them during script evaluation would break SSR. `mount()` is deferred to `onMount`, which only fires on the client.

### Why is the search-expansion $effect in the hook, not Explorer.svelte?

It is a reactive side effect (store state → service mutation) that belongs with the lifecycle code, not with the component's one-time boot logic. Keeping it in the hook makes `Explorer.svelte` a pure wiring root.

### Why does `ExplorerActionContext` live in `utils/explorer/explorer-ops.ts`?

Action handlers and their context type are co-located so the type is always in sync with the functions that consume it. The controller imports the type from utils — not the other way around.

### Why is `projectFolderName(project)` called with the whole project object?

Passing the full object (vs. `_id, name` separately) is consistent with how every other call site in the codebase uses it and avoids argument-order bugs.
