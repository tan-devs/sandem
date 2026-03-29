# Editor — Architecture & Data Flow Report

## File Hierarchy

```
Editor.svelte                                    ← wiring root + DOM owner
├── createEditorPaneController()                 ← brain (EditorController.svelte.ts)
│   ├── createAutoSaver()                        ← debounced Convex persistence
│   ├── createFileWriter()                       ← debounced WebContainer writes
│   ├── createEditorStatus()                     ← Monaco cursor/language status
│   ├── createEditorRuntime()                    ← Monaco + Yjs runtime (createEditor.svelte.ts)
│   │   ├── createMonacoInstance()               ← loads Monaco from CDN/assets
│   │   ├── startCollaborationSession()          ← Liveblocks + Yjs wiring
│   │   │   ├── enterRoom()                      ← Liveblocks room handle
│   │   │   ├── syncPresence()                   ← room presence → stores
│   │   │   ├── bindEditorCursor()               ← Monaco events → room.updatePresence
│   │   │   ├── createYjsDoc()                   ← Y.Doc + LiveblocksYjsProvider
│   │   │   └── bindEditorModels()               ← MonacoBinding per file
│   │   └── createOfflineModels()                ← fallback: no room, direct Monaco models
│   ├── createEditorActionHandlers()             ← openFile, closeTab, togglePanel, shutdown
│   └── useEditor()                              ← initialize / teardown lifecycle hook
├── Tabs.svelte                                  ← tab bar UI
├── EditorBreadcrumb.svelte                      ← active file path display
├── EditorSaveStatus.svelte                      ← save status badge
├── EmptyEditorState.svelte                      ← no-file-open placeholder
└── ErrorPanel.svelte                            ← runtime error display + retry
```

---

## Layer-by-Layer Breakdown

### 1. `Editor.svelte` — DOM Owner & Wiring Root

**What it does:** the only file that owns a DOM reference (`bind:this={element}`). It pulls context, instantiates the controller, wires lifecycle callbacks to `onMount`/`onDestroy`, and renders the Monaco mount point alongside the UI chrome.

**Injections received:**

- `requireIDEContext()` — pulls `IDEContext` from Svelte context (set by the layout)
- `getPanelsContext()` — pulls `IDEPanels` from Svelte context (panel visibility flags)
- `editorStore` — imported module singleton from `$lib/stores`
- `activity` — imported module singleton from `$lib/stores`
- `collaborationPermissionsStore` — imported writable store; subscribed manually to read `canWrite`

**`onMount` sequence:**

```
1. editorPane.mountShortcuts()        → registers Cmd+S keydown on window, returns cleanup
2. window.addEventListener('pagehide') → calls editorPane.shutdown() on tab close/navigate
3. editorPane.initializeEditor(element) → async: boots Monaco, sets up models/collab
```

**`$effect` — active path sync:**

```
$effect(() => {
    void editorStore.activeTabPath;       ← read to register dependency
    editorPane.syncAfterActivePathChange(); ← re-sync Monaco model on tab switch
})
```

This fires every time `activeTabPath` changes (user clicks a tab). It tells the runtime to swap the active Monaco model to match.

**`onDestroy` sequence:**

```
1. unsubscribePermissions()   ← stop listening to collaborationPermissionsStore
2. editorPane.shutdown()      ← drain saves, flush file writes, destroy Monaco + Yjs
```

**Template bindings:**

| Element                  | Data source                                                                      |
| ------------------------ | -------------------------------------------------------------------------------- |
| `<Tabs>`                 | `editorPane.tabs`, `editorStore.openFile`, `editorStore.closeTab`                |
| `<EditorSaveStatus>`     | `editorPane.autoSaver.status`, `editorPane.saveStatusVariant`                    |
| `<EditorBreadcrumb>`     | `editorStore.activeTabPath`                                                      |
| `<EmptyEditorState>`     | `editorPane.quickActions` (shown when `editorPane.showEmptyState`)               |
| `<ErrorPanel>`           | `editorPane.editorRuntimeError`, `editorPane.initializingEditor`, retry callback |
| `<div.editor-container>` | `bind:this={element}` — Monaco mounts here; hidden when error or empty           |

---

### 2. `EditorController.svelte.ts` — The Brain

**What it does:** assembles all services, wires them into a lifecycle hook and an action handler set, computes derived UI state, and returns a flat API object that `Editor.svelte` consumes directly.

**Receives:** `{ ide, editorStore, activity, getPanels, getCanWrite }`

#### Services instantiated and how they are wired:

**`createAutoSaver(() => ide.getProject())`**  
Owns: debounced Convex `upsertFile` mutations, `saveStatus` state, pending save queue.  
The `getProject` closure is lazy — evaluated at save time, not at construction. This means if the active project changes (workspace with multiple projects), the saver always targets the current one.  
Exposed: `autoSaver.status`, `autoSaver.triggerAutoSave`, `autoSaver.drainAndCleanup`.

**`createFileWriter(() => ide.getWebcontainer())`**  
Owns: debounced WebContainer `fs.writeFile` calls, per-file write queues, drain-on-dispose logic.  
Same lazy closure pattern as autoSaver.  
Exposed: `fileWriter.writeFile`, `fileWriter.drainAndDispose`.

**`createEditorStatus(editorStore)`**  
Owns: reads Monaco model state (cursor position, language, EOL, indentation) and writes it back into `editorStore` via `updateStatus` / `resetStatus`.  
The `editorStore` reference here is the store itself acting as both the status target and the source for `tabs`/`activeTabPath` — the same object, no duplication.  
Exposed: `status.syncFromEditor(editor)`.

**`createEditorRuntime(deps)`** — the most complex service, detailed below.

**`useEditor({ runtime, status })`**  
Wraps `runtime` and `status` in lifecycle state (`editorRuntimeError`, `editorReady`, `initializingEditor`).  
Owns: error reporting, the initialize/destroy/sync sequence.  
Exposed: `lifecycle.initializeEditor`, `lifecycle.syncAfterActivePathChange`, `lifecycle.destroy`.

#### The `onPersist` double-write:

```
runtime.onPersist({ nodePath, content })
    │
    ├──► autoSaver.triggerAutoSave(nodePath, content)
    │        └── debounced → Convex upsertFile (source of truth)
    │
    └──► fileWriter.writeFile(nodePath, content)
             └── debounced → WebContainer fs.writeFile (hot runtime)
```

Every file change writes to both Convex (persistence) and the WebContainer (live execution) on the same tick, debounced separately so neither blocks the other.

#### `createEditorActionHandlers(context)` — injected action surface

Receives `EditorActionContext`:

```ts
{
  ide,
  editorStore,
  services: { autoSaver, fileWriter, runtime, lifecycle },
  getPanels
}
```

Returns: `openFile`, `closeTab`, `initialize`, `syncAfterActivePathChange`, `shutdown`, `togglePanel`.  
`shutdown` sequences: `autoSaver.drainAndCleanup()` → `fileWriter.drainAndDispose()` → `lifecycle.destroy()`. Order matters — persistence is drained before the runtime is torn down.

#### Derived UI state:

| Getter              | Source                                                         | Consumer                           |
| ------------------- | -------------------------------------------------------------- | ---------------------------------- |
| `saveStatusVariant` | `deriveEditorSaveStatusVariant(autoSaver.status)`              | `<EditorSaveStatus>`               |
| `showEmptyState`    | `shouldShowEmptyEditorState(tabs, activeTabPath)`              | controls empty/editor/error render |
| `tabs`              | `deriveEditorTabItems(editorStore.tabs, editorStore.isActive)` | `<Tabs>`                           |

#### `mountShortcuts()`:

Registers `keydown` on `window`. Currently only handles `Cmd/Ctrl+S` (prevents default; actual saving is triggered by `onPersist`, not the shortcut). Returns a cleanup function called in `onMount`'s return.

---

### 3. `createEditor.svelte.ts` (createEditorRuntime) — Monaco + Yjs Runtime

**What it does:** owns the Monaco editor instance, all Yjs collaboration state, model bindings, and the persist scheduler. This is the most stateful piece of the system — everything else is coordination around it.

**Receives:** `EditorRuntimeDependencies` — a bag of lazy getters and callbacks:

| Dep                         | Type                         | Purpose                                     |
| --------------------------- | ---------------------------- | ------------------------------------------- |
| `getProject()`              | `() => Project \| undefined` | read nodes, room slug, at call time         |
| `getActivePath()`           | `() => string \| null`       | which file is currently open                |
| `toProjectFile(path)`       | `(path) => string`           | WC path → project-relative node path        |
| `toWebPath(path)`           | `(path) => string`           | node path → WC path                         |
| `readFile(path)`            | `async (path) => string`     | reads a file from WC for offline model init |
| `onStatusSync()`            | `() => void`                 | triggers `status.syncFromEditor`            |
| `onPersist(payload)`        | `(payload) => void`          | fires the double-write on content change    |
| `onPersistBatch?(payloads)` | optional batch variant       | used by the Yjs sync path                   |

#### Initialization branch — online vs offline:

```
initialize(element)
    │
    ├── createMonacoInstance()   ← tries CDN paths, throws on failure
    ├── editor.create(element, MONACO_OPTIONS)
    ├── setupStatusListeners()   ← onDidChangeCursorPosition, onDidChangeModel → onStatusSync
    │
    ├── project.room exists?
    │       YES → setupCollaborativeModels()
    │       NO  → setupOfflineModels()
    │
    └── deps.onStatusSync()      ← initial status read
```

#### Collaborative path — `setupCollaborativeModels()`:

```
startCollaborationSession({ project, editor, instance, bindings, ... })
    │
    ├── enterRoom(project.room)
    │       └── getLiveblocksClient().enterRoom(roomSlug)
    │
    ├── syncPresence({ room, roomId })
    │       └── room.subscribe('my-presence' | 'others') → setCollaborationPresence/Permissions stores
    │
    ├── bindEditorCursor({ editor, room })
    │       └── Monaco cursor/selection events → room.updatePresence({ cursor, selection })
    │
    ├── createYjsDoc({ room, onSync, onUpdate })
    │       ├── new Y.Doc()
    │       ├── new LiveblocksYjsProvider(room, ydoc)
    │       ├── onSync(isSynced) → if first sync: seedProjectFromConvex()
    │       └── onUpdate(ydoc, origin) → if not seed: schedulePersist(ydoc)
    │
    └── bindEditorModels({ files, ydoc, provider, editor, instance, bindings })
            └── for each file: MonacoBinding(ytext, model, editor, awareness)
```

**`seedProjectFromConvex()`** — called once when Yjs first syncs:

```
1. seedYDocFromNodes()      ← insert node.content into ydoc.getText(node.path) for each file node
2. seedPersistSignatures()  ← snapshot current ydoc content into lastPersistedByPath
                              (so the first diff sees 0 changes, not the entire project)
```

**`schedulePersist(ydoc)`** — debounced (900ms), called on every Yjs `update` event except `'seed'` origin:

```
diffYDocFiles(ydoc, project, lastPersistedByPath, toWebPath)
    └── for each file node: compare getText(path) vs lastPersistedByPath
        → changed files only → PersistPayload[]
            └── onPersistBatch(payloads) OR forEach onPersist(payload)
```

#### Offline path — `setupOfflineModels()`:

```
createOfflineModels({ project, instance, bindings, toWebPath })
    └── creates one Monaco model per file node, no Yjs

editor.onDidChangeModelContent(() => {
    onPersist({ activePath, projectFileName, content: editor.getValue() })
})
```

No batching, no Yjs — each keystroke fires the double-write directly.

#### Destroy sequence:

```
destroy()
    ├── clearTimeout(persistTimer)
    ├── disposeAll()             ← all Monaco IDisposable listeners
    ├── destroyModelBindings()   ← MonacoBinding.destroy() + model.dispose() per binding
    ├── session?.dispose()       ← detach Yjs listeners + provider.destroy()
    ├── session?.provider.destroy()
    ├── session?.leaveRoom()     ← dispose + Liveblocks leave()
    └── editor?.dispose()
```

---

### 4. `useEditor.svelte.ts` — Lifecycle Hook

**What it does:** wraps `runtime` and `status` in Svelte reactive state for error, ready, and loading flags. Provides a safe `initializeEditor` that guards against concurrent calls and catches errors into reactive state rather than crashing.

**Receives:** `{ runtime: EditorRuntime, status: EditorStatus }`

**Owns:** `editorRuntimeError`, `editorReady`, `initializingEditor` — all `$state`.

#### `initializeEditor(element)`:

```
if (!element || initializingEditor) return   ← guard: no double-init
initializingEditor = true
runtime.destroy()                            ← always tear down before re-init (retry safety)
await runtime.initialize(element)
status.syncFromEditor(runtime.getEditor())   ← initial status read
editorReady = true
```

On error: `reportEditorError()` sets `editorRuntimeError` → `Editor.svelte` renders `<ErrorPanel>` with a retry button that calls `initializeEditor(element)` again.

#### `syncAfterActivePathChange()`:

```
if (!editorReady || editorRuntimeError) return   ← guard: don't sync if broken
runtime.syncActiveEditorModel()                   ← swap Monaco model to active path
status.syncFromEditor(runtime.getEditor())        ← re-read cursor/language for new model
```

Called by `Editor.svelte`'s `$effect` on every `activeTabPath` change.

---

### 5. `editor.store.svelte.ts` — Editor State Store

**What it does:** owns the tab list, active tab path, and editor status (cursor, language, EOL, encoding). A module singleton (`editorStore`) is exported alongside the factory function so it can be imported directly — no Svelte context needed.

**Tab management:**

```
openFile(path)
    ├── if not in tabs: push { path, label: basename(path) }
    └── activeTabPath = path

closeTab(path)
    ├── remove from openTabs
    └── if was active: activate tabs[idx] ?? tabs[idx-1] ?? null
```

**Status update guard:** `updateStatus` does a field-by-field equality check before mutating `status` — prevents spurious reactive updates from Monaco firing `onDidChangeCursorPosition` with identical values.

**Consumers:**

| Consumer             | What it reads                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------ |
| `EditorController`   | `activeTabPath`, `tabs`, `isActive`, `openFile`, `closeTab`, `updateStatus`, `resetStatus` |
| `Editor.svelte`      | `activeTabPath` (breadcrumb, `$effect` dep), `openFile`, `closeTab` (tab bar)              |
| `ExplorerController` | `activeTabPath` (for project resolution), `tabs`, `openFile`, `closeTab`                   |
| `createEditorStatus` | `updateStatus`, `resetStatus` (writes Monaco state back into the store)                    |

---

## Full Data Flow Diagram

```
Convex DB ──────────────────────────────────────────────────────┐
Liveblocks room ─────────────────────────────────────────────┐  │
WebContainer FS ──────────────────────────────────────────┐  │  │
                                                          │  │  │
ide-context.ts (Svelte context)                           │  │  │
    getWebcontainer() ────────────────────────────────────┤  │  │
    getProject() → Project { nodes[], room, isOwner }     │  │  │
         │                                                │  │  │
         ▼                                                ▼  ▼  ▼
   Editor.svelte
         │
         │  createEditorPaneController({ ide, editorStore, panels })
         │◄──────────────────────────────────────────────────────────┐
         │                         EditorController                  │
         │                              │                            │
         │                    ┌─────────┼──────────┐                 │
         │                    ▼         ▼          ▼                 │
         │              autoSaver  fileWriter  createEditorRuntime   │
         │                    │         │          │                 │
         │                    │         │    ┌─────┴────┐           │
         │                    │         │    │          │            │
         │                    │         │  online    offline         │
         │                    │         │    │          │            │
         │                    │         │  Yjs+      Monaco          │
         │                    │         │  Liveblocks models only    │
         │                    │         │    │                       │
         │           onPersist callback ◄────┘                       │
         │                    │    │                                  │
         │                    ▼    ▼                                  │
         │           Convex   WC fs.write                            │
         │                                                           │
         │  useEditor({ runtime, status })                           │
         │      editorRuntimeError ──► <ErrorPanel>                  │
         │      initializingEditor ──► retry button disabled         │
         │      initializeEditor() ◄── onMount                       │
         │      syncAfterActivePathChange() ◄── $effect(activeTabPath)
         │                                                           │
         ▼                                                           │
   Template bindings ───────────────────────────────────────────────┘
         │
         ├──► <Tabs>             tabs, onSelect→openFile, onClose→closeTab
         ├──► <EditorSaveStatus> autoSaver.status, saveStatusVariant
         ├──► <EditorBreadcrumb> activeTabPath
         ├──► <EmptyEditorState> quickActions   (when showEmptyState)
         ├──► <ErrorPanel>       editorRuntimeError, retry  (when error)
         └──► <div.editor-container> bind:this={element}   (Monaco mounts here)
```

---

## Naming Convention Refactor Map (Editor files)

| Current file                   | New name                               | Function rename                                            |
| ------------------------------ | -------------------------------------- | ---------------------------------------------------------- |
| `EditorController.svelte.ts`   | `EditorController.svelte.ts` ✓         | `createEditorPaneController` → `createEditorController`    |
| `createEditor.svelte.ts`       | `createEditor.svelte.ts` ✓             | `createEditorRuntime` → `createEditor`                     |
| `useEditor.svelte.ts`          | `useEditor.svelte.ts` ✓                | `useEditor` ✓                                              |
| `editor.store.svelte.ts`       | `editor.store.svelte.ts` ✓             | multiple exports OK (store)                                |
| `createStatus.svelte.ts`       | `createEditorStatus.svelte.ts`         | `createEditorStatus` ✓                                     |
| `createAutoSaver.svelte.ts`    | `createAutoSaver.svelte.ts` ✓          | `createAutoSaver` ✓                                        |
| `createFileWriter.svelte.ts`   | `createFileWriter.svelte.ts` ✓         | `createFileWriter` ✓                                       |
| `createSession.svelte.ts`      | `createCollaborationSession.svelte.ts` | `startCollaborationSession` → `createCollaborationSession` |
| `createMonacoConfig.svelte.ts` | `createMonacoConfig.svelte.ts` ✓       | multiple exports OK (config util)                          |

### Key issues to fix for convention compliance:

1. **`createEditorPaneController`** — "Pane" is a stale qualifier. Rename to `createEditorController` to match the file name.
2. **`createEditorRuntime`** — rename to `createEditor` to match `createEditor.svelte.ts`.
3. **`startCollaborationSession`** — verb is wrong for the `create*` convention. Rename to `createCollaborationSession` and update the file to `createCollaborationSession.svelte.ts`.
4. **`createStatus.svelte.ts`** — too generic; rename file to `createEditorStatus.svelte.ts`, function already named correctly.
