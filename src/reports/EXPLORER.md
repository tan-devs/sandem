# Explorer — Architecture & Data Flow Report

## File Hierarchy

```
Sidebar.svelte
└── Explorer.svelte                          ← wiring root
    ├── createExplorerController()           ← brain (ExplorerController.svelte.ts)
    │   ├── createExplorerStateController()  ← selection / search / click state
    │   ├── createFileTree()                 ← WebContainer FS reader
    │   ├── projectFilesSync()               ← Convex + Liveblocks FS sync
    │   └── createExplorer.svelte.ts         ← pure action handlers (injected)
    ├── useExplorer()                        ← mount lifecycle hook
    └── ExplorerContent.svelte               ← layout shell / prop router
        ├── ExplorerOpenEditors.svelte       ← open tabs list
        ├── ExplorerFilesSection.svelte      ← file tree + search
        │   └── ExploerContextMenu.svelte    ← right-click menu
        ├── ExplorerProjectInfo.svelte       ← project metadata panel
        ├── ExplorerOutline.svelte           ← symbol outline
        └── ExplorerTimeline.svelte          ← action history log
```

---

## Layer-by-Layer Breakdown

### 1. `Sidebar.svelte` — Tab Router

**What it does:** reads the global `activity` store and swaps the active panel component. The Explorer is one of four panels (explorer, search, git, run). No props are passed — each panel is self-contained.

**Data in:** `activity.tab` (global `$state` from `activityStore.svelte.ts`)  
**Data out:** mounts `<Explorer />` with no props

```
activityStore.activity.tab
        │
        ▼
activityMap[tab] → <Explorer /> | <Search /> | <Git /> | <Debug />
```

---

### 2. `Explorer.svelte` — Wiring Root

**What it does:** the only file that touches both the IDE context and the controller. It instantiates the controller, hands it to the lifecycle hook, and passes the full controller API surface down as props to `ExplorerContent`. It also runs two `$effect`s that live here because they need both tree state and editor state simultaneously.

**Injections received:**

- `requireIDEContext()` — pulls the IDE context object from Svelte context (set by the layout above)
- `editorStore` — imported directly from `$lib/stores` (module singleton)
- `activity` — imported directly from `$lib/stores`

**Two `$effect`s:**

| Effect               | Trigger                                                   | Action                                                                                           |
| -------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Entry file auto-open | `explorer.tree` populates and `editorStore.tabs` is empty | Opens the project's `entry` file path in the editor                                              |
| Search expansion     | `explorer.hasSearch` is true                              | Iterates `explorer.expandOnSearch` and calls `explorer.toggleDir` for each path not yet expanded |

**Data passed down to `ExplorerContent`:** every getter on the controller object — ~30 props covering tree data, dialog state, context menu state, search, project info, timeline events, and all callback handlers.

```
requireIDEContext() ──┐
editorStore ──────────┼──► createExplorerController({ ide, editorStore })
                      │              │
                      │              ▼
                      │       explorer (ExplorerController)
                      │              │
useExplorer(explorer) ◄──────────────┤  (lifecycle only, no return value used)
                                     │
                                     ▼
                            <ExplorerContent ...30 props />
```

---

### 3. `ExplorerController.svelte.ts` — The Brain

**What it does:** the single source of truth for all Explorer state. It owns three inner controllers, computes all derived state, manages dialog and context menu lifecycles, and wires action handlers. Returns a flat API object consumed by `Explorer.svelte`.

#### Inner controllers instantiated:

**`createExplorerStateController()`**  
Owns: `selectedPath`, `focusedPath`, `renamingPath`, `searchQuery`, `contextMenuPath`, `showHidden`, double-click detection.  
Exposed via: `explorer.selectedPath`, `explorer.searchQuery`, `explorer.hasSearch`, `explorer.setSearchQuery`, `explorer.clearSearch`, and internally by `buildActionContext()`.

**`createFileTree(ide.getWebcontainer, { getWorkspaceRootFolders })`**  
Owns: the WebContainer directory scan, `expanded` record, auto-refresh timer, `loading`/`error` state.  
`getWorkspaceRootFolders` is a closure that calls `ide.getWorkspaceProjects()` at read-time and maps each project to its folder slug — so the tree only shows known project roots, not the raw WC root.  
Exposed via: `explorer.tree`, `explorer.treeLoading`, `explorer.treeError`, `explorer.isExpanded`, `explorer.toggleDir`, and `fileTree` (passed to `useExplorer`).

**`projectFilesSync({ getProject, getProjectForPath, getWebcontainer, onRemoteOperationApplied })`**  
Owns: Convex mutations, Liveblocks room subscription, broadcast of `fs-op` events.  
All three `get*` arguments are closures that resolve lazily at call time.  
`onRemoteOperationApplied` silently refreshes the file tree when a remote peer makes a FS change.  
Exposed via: `explorer.projectSync` (passed to `useExplorer` for lifecycle stop).

#### `$derived` state:

| Derived               | Source                                        | Consumer                                            |
| --------------------- | --------------------------------------------- | --------------------------------------------------- |
| `tree`                | `fileTree.tree`                               | `ExplorerContent` → `ExplorerFilesSection`          |
| `filteredTree`        | `filterNodesByQuery(tree, searchQuery)`       | `ExplorerContent` → `ExplorerFilesSection`          |
| `expandOnSearch`      | `getPathsToExpand(filteredTree, searchQuery)` | `Explorer.svelte` `$effect`, `ExplorerFilesSection` |
| `activeProject`       | `ide.getProject()`                            | `ExplorerContent` → `ExplorerProjectInfo`           |
| `activeProjectFolder` | `projectFolderName(activeProject)`            | `ExplorerContent`                                   |
| `nodeCount`           | `activeProject?.nodes.length`                 | `ExplorerContent` → `ExplorerProjectInfo`           |
| `isOwner`             | `activeProject?.isOwner`                      | `ExplorerContent` → `ExplorerProjectInfo`           |
| `activeTabPath`       | `editorStore.activeTabPath`                   | `ExplorerContent`                                   |
| `tabs`                | `editorStore.tabs`                            | `ExplorerContent` → `ExplorerOpenEditors`           |

#### `buildActionContext()` — dependency injection for action handlers

Every action (create file, rename, delete, etc.) needs a consistent set of dependencies. `buildActionContext()` assembles them from the controller's current state at call time. Optional `overrides` allow dialog actions to substitute `selectedPath` with the dialog's `targetPath`.

```ts
{
  fileTree,         // ← inner controller
  projectSync,      // ← inner controller
  editorOpenFile: editorStore.openFile,
  getWebcontainer: ide.getWebcontainer,
  getActiveProject: () => ide.getProject() as ProjectDoc,
  tree,             // ← current $derived snapshot
  selectedPath: explorerState.selectedPath,
  onMessage: setActionMessage,
  onError: setActionError,
  ...overrides      // ← dialog can override selectedPath
}
```

#### Dialog lifecycle:

```
openCreateDialog('file')
    │
    ├── computes suggestPath() → reads getSelectedDirectory() → reads explorerState.selectedPath → finds node in tree
    └── sets dialogState = { open: true, intent: 'create-file', value: suggested, targetPath: selected }

confirmDialog()
    │
    ├── buildActionContext({ selectedPath: dialogState.targetPath })
    ├── routes intent → handleCreateFile | handleCreateFolder | handleRenameNode | handleDeleteNode
    └── on success → closeDialog()
```

#### Node click handlers:

**`handleFileClick(node)`**  
Calls `explorerState.handleClick(node.path)` → returns `'single'` or `'double'` (300ms threshold).  
Selects the node, logs a timeline event. On double-click OR any file node → calls `editorStore.openFile(node.path)`.

**`handleDirClick(node)`**  
Selects node. If `node.depth === 0` (project root), resolves project by folder name and calls `ide.selectProject()`. Always calls `fileTree.toggleDir(node.path)`.

**`handleNodeContextMenu(node, event)`**  
Prevents default, selects node, sets `contextMenu = { open: true, x, y, path }`.

---

### 4. `useExplorer.svelte.ts` — Mount Lifecycle Hook

**What it does:** wires up all side effects that require DOM access or `window` — keyboard shortcuts, pointer dismissal, file tree bootstrap. Returns a `{ mount }` object; `mount()` is called inside `onMount` in `Explorer.svelte` and returns a cleanup function.

**Receives:** `explorer: ExplorerController`, `getActivityTab: () => string`

**Three things it sets up:**

**Keyboard shortcuts** (only fires when `activity.tab === 'explorer'`):

| Shortcut               | Action                                          |
| ---------------------- | ----------------------------------------------- |
| `Cmd/Ctrl + N`         | `explorer.openCreateDialog('file')`             |
| `Cmd/Ctrl + Shift + N` | `explorer.openCreateDialog('folder')`           |
| `F2`                   | `explorer.openRenameDialog()`                   |
| `Delete`               | `explorer.openDeleteDialog()`                   |
| `Escape`               | closes dialog if open, else closes context menu |

**Pointer dismissal:** any `pointerdown` on `window` → `explorer.closeContextMenu()`.

**Bootstrap loop:** calls `explorer.fileTree.startAutoRefresh(850)` then runs a polling loop (up to 80 × 300ms = 24s) that keeps refreshing until the tree length stabilises for 3 consecutive checks. This handles race conditions between WC boot and project mount.

**Cleanup:** removes event listeners, stops auto-refresh, calls `explorer.projectSync.stop()`, calls `explorer.reset()`.

---

### 5. `createExplorer.svelte.ts` — Action Handlers Service

**What it does:** pure, stateless functions that take an `ExplorerActionContext` and perform filesystem mutations. No `$state`, no lifecycle. Every function returns `boolean` (success/failure).

**Dependency injection pattern:** every handler receives the full context object rather than individual arguments. The controller builds and passes this context — handlers never import from the controller.

#### Handler summary:

| Function                    | WebContainer op             | Convex/sync op                | Tree op                                      |
| --------------------------- | --------------------------- | ----------------------------- | -------------------------------------------- |
| `handleCreateFile`          | `fs.mkdir` + `fs.writeFile` | `projectSync.createFile`      | `fileTree.refresh` + `editorOpenFile`        |
| `handleCreateFolder`        | `fs.mkdir`                  | `projectSync.createDirectory` | `fileTree.refresh`                           |
| `handleRenameNode`          | —                           | `projectSync.renamePath`      | `fileTree.refresh`                           |
| `handleDeleteNode`          | —                           | `projectSync.deletePath`      | `fileTree.refresh`                           |
| `handleRefreshTree`         | —                           | —                             | `fileTree.refresh`                           |
| `handleExpandAll`           | —                           | —                             | `fileTree.toggleDir` for all unexpanded dirs |
| `handleCollapseAll`         | —                           | —                             | `fileTree.toggleDir` for all expanded dirs   |
| `handleRefreshAndExpandAll` | —                           | —                             | refresh then expand all                      |

**`normalizeToProjectPath(input, tree, activeProject)`:**  
Strips leading slashes, validates the path, then either passes it through (if the first segment is a known root folder in `tree`) or prepends the active project's folder slug. This ensures user-typed relative paths like `src/App.tsx` become `my-project/src/App.tsx`.

**Guard pattern** (consistent across all write handlers):

```
1. projectSync.canWrite() → if false, onError + return false
2. validate/normalize path
3. WebContainer op (if needed)
4. Convex/sync op
5. fileTree.refresh()
6. onMessage(success) → return true
   onError(catch) → return false
```

---

### 6. `ExplorerContent.svelte` — Layout Shell / Prop Router

**What it does:** owns the `<Accordion.Root>` wrapper and routes the ~30 props from `Explorer.svelte` down to the correct child section. Also owns the dialog UI (modal overlay + form) and the status message strip. No logic — purely structural.

**Dialog rendering:** rendered directly here rather than in a child component because it needs to escape the accordion's overflow context. Reads `dialogState.intent` to derive titles, descriptions, and whether to show the text input.

**Props added in last refactor:** `nodeCount: number | null`, `isOwner: boolean` (previously missing, caused the type error).

---

### 7. `ExplorerFilesSection.svelte` — File Tree + Search

**What it does:** one accordion section wrapping the search input and the `<FileTreeView>` primitive. Hosts `<ExploerContextMenu>` (positioned fixed, not in DOM flow).

**Search toggle:** when `hasSearch` is true, passes `expandOnSearch.has(path)` as the `isExpanded` predicate to `FileTreeView` instead of the normal `isExpanded` function — so search results auto-expand without mutating the real expanded state.

**Data in:** tree, filteredTree, search state, selection state, all click/context-menu callbacks.  
**Data out:** fires `onDirClick`, `onFileClick`, `onNodeContextMenu`, `onSearchChange`, `onSearchClear`, `onContextMenuAction`, `onCloseContextMenu`.

---

### 8. `ExploerContextMenu.svelte` — Right-click Menu

**What it does:** renders a fixed-position `role="menu"` when `contextMenu.open` is true. Menu entries are `$derived` so `disabled` state reacts to `selectedPath` changes without re-mounting.

**Keyboard nav:** full arrow-key, Home/End, Enter/Space, Escape support. Uses `activeIndex` + `enabledIndexes()` to skip disabled items. On close, restores focus to the last tree row via `[data-tree-path]` selector.

**Data in:** `contextMenu: ContextMenuState`, `selectedPath`, `onAction`, `onClose`.  
**Data out:** calls `onAction(ContextMenuAction)` or `onClose()`.

---

### 9. `ExplorerOpenEditors.svelte` — Open Tabs List

**What it does:** shows the currently open editor tabs as a collapsible accordion section. Only renders if `tabs.length > 0`. Each row has an open button (activates the tab) and a close button (removes the tab).

**Data in:** `tabs: EditorTab[]`, `activeTabPath`, `onOpenFile`, `onCloseTab`.  
**Data out:** calls `onOpenFile(path)` or `onCloseTab(path)` → both route back to `editorStore`.

---

## Full Data Flow Diagram

```
Convex DB ──────────────────────────────────────────────────┐
Liveblocks room ─────────────────────────────────────────┐  │
WebContainer FS ──────────────────────────────────────┐  │  │
                                                      │  │  │
ide-context.ts (Svelte context)                       │  │  │
    getWebcontainer() ────────────────────────────────┤  │  │
    getProject() → Project { nodes[], isOwner }       │  │  │
    getWorkspaceProjects()                            │  │  │
    selectProject()                                   │  │  │
         │                                            │  │  │
         ▼                                            ▼  ▼  ▼
   Explorer.svelte                          ExplorerController
         │                                       │
         │  createExplorerController()           │
         │◄─────────────────────────────────────┤
         │                                       │
         │  useExplorer(explorer)                │
         │──────────────────────────────────────►│ (reads fileTree, projectSync)
         │   sets up window listeners            │
         │   runs bootstrap loop                 │
         │                                       │
         │  $effect: auto-open entry file        │
         │  $effect: expand on search            │
         │                                       │
         ▼                                       │
   ExplorerContent.svelte ◄─────────────────────┘
   (~30 props passed as flat object)
         │
         ├──► ExplorerOpenEditors   (tabs, activeTabPath, onOpenFile, onCloseTab)
         │
         ├──► ExplorerFilesSection  (tree, filteredTree, search, selection, callbacks)
         │         └──► ExploerContextMenu  (contextMenu, onAction, onClose)
         │
         ├──► ExplorerProjectInfo   (activeProject, folderName, nodeCount, isOwner)
         │
         ├──► ExplorerOutline       (activeFilePath)
         │
         └──► ExplorerTimeline      (timelineEvents, onOpenPath)
```

---

## Naming Convention Refactor Map (Explorer files)

Based on the new convention (`/controllers: [Name]Controller.svelte.ts`, `/hooks: use[Name].svelte.ts`, `/services: create[Name].svelte.ts`, `/utils: name-surname.ts`, `/stores: name.store.svelte.ts`):

| Current file                   | New file                        | Function rename                                                      |
| ------------------------------ | ------------------------------- | -------------------------------------------------------------------- |
| `ExplorerContoller.svelte.ts`  | `ExplorerController.svelte.ts`  | `createExplorerController` (fix typo only, function already correct) |
| `useExplorer.svelte.ts`        | `useExplorer.svelte.ts` ✓       | `useExplorer` ✓                                                      |
| `createExplorer.svelte.ts`     | `createExplorer.svelte.ts` ✓    | wrap all handlers in a single `createExplorer(ctx)` factory          |
| `file-tree.ts`                 | `file-tree.ts` ✓                | multiple exports OK (utils)                                          |
| `file-system.ts`               | `file-system.ts` ✓              | multiple exports OK (utils)                                          |
| `activityStore.svelte.ts`      | `activity.store.svelte.ts`      | —                                                                    |
| `editorStore.svelte.ts`        | `editor.store.svelte.ts`        | —                                                                    |
| `collaborationStore.svelte.ts` | `collaboration.store.svelte.ts` | —                                                                    |
| `panelStore.svelte.ts`         | `panel.store.svelte.ts`         | —                                                                    |
| `ide-context.ts`               | `ide-context.ts` ✓              | multiple exports OK (context)                                        |

### Editor files (pending refactor):

| Current file                 | New file                               | Function rename                                            |
| ---------------------------- | -------------------------------------- | ---------------------------------------------------------- |
| `EditorController.svelte.ts` | `EditorController.svelte.ts` ✓         | `createEditorPaneController` → `createEditorController`    |
| `createEditor.svelte.ts`     | `createEditor.svelte.ts` ✓             | `createEditorRuntime` → `createEditor`                     |
| `createStatus.svelte.ts`     | `createEditorStatus.svelte.ts`         | `createEditorStatus` → `createEditorStatus` ✓              |
| `createAutoSaver.svelte.ts`  | `createAutoSaver.svelte.ts` ✓          | `createAutoSaver` ✓                                        |
| `createFileWriter.svelte.ts` | `createFileWriter.svelte.ts` ✓         | `createFileWriter` ✓                                       |
| `createShortcuts.svelte.ts`  | `createEditorShortcuts.svelte.ts`      | `createEditorShortcuts` ✓                                  |
| `createSession.svelte.ts`    | `createCollaborationSession.svelte.ts` | `startCollaborationSession` → `createCollaborationSession` |
