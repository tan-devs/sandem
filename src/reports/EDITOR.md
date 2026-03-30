# Editor System

> **Status: Functional — DI/PF cleansing in progress.**
>
> The editor system follows the same controller/hook/service layering as the
> Terminal system, but has not yet completed the full Data Injection + Pure
> Functions pass. Known gaps are called out explicitly in each section.
> Do not assume parity with Terminal until those gaps are resolved.

---

## File Hierarchy

```
Editor.svelte                                       ← wiring root + DOM owner
├── createEditorController()                        ← assembly layer (EditorController.svelte.ts)
│   ├── createEditorAutoSaver()                     ← debounced Convex persistence
│   ├── createEditorFileWriter()                    ← debounced WebContainer writes
│   ├── createEditorStatus()                        ← Monaco cursor/language status
│   ├── createEditor()                              ← Monaco + Yjs runtime (createEditor.svelte.ts)
│   │   ├── createMonacoInstance()                  ← loads Monaco from CDN/assets
│   │   ├── startCollaborationSession()             ← Liveblocks + Yjs wiring
│   │   │   ├── enterRoom()                         ← Liveblocks room handle
│   │   │   ├── syncPresence()                      ← room presence → stores
│   │   │   ├── bindEditorCursor()                  ← Monaco events → room.updatePresence
│   │   │   ├── createYjsDoc()                      ← Y.Doc + LiveblocksYjsProvider
│   │   │   └── bindEditorModels()                  ← MonacoBinding per file
│   │   └── createOfflineModels()                   ← fallback: no room, direct Monaco models
│   ├── createEditorActions()                       ← openFile, closeTab, togglePanel, shutdown
│   └── useEditor()                                 ← Svelte 5 lifecycle hook
├── Tabs.svelte                                     ← tab bar UI
├── EditorBreadcrumbs.svelte                        ← active file path display
├── EditorSaveStatus.svelte                         ← save status badge
├── EditorEmptyState.svelte                         ← no-file-open placeholder
└── ErrorPanel.svelte                               ← runtime error display + retry
```

---

## Naming Convention

| Layer      | Pattern                       | Rule                                      |
| ---------- | ----------------------------- | ----------------------------------------- |
| Controller | `NameController.svelte.ts`    | Default function = `createNameController` |
| Hook       | `useName.svelte.ts`           | Default function = `useName`              |
| Service    | `createNameSurface.svelte.ts` | Default function = `createNameSurface`    |
| Store      | `name.store.svelte.ts`        | Multiple exports OK                       |
| Utils      | `name-surname.ts`             | Multiple exports OK                       |
| Context    | `name-surname.ts`             | Multiple exports OK                       |

### Editor file map

| File                               | Function                                      | Layer      |
| ---------------------------------- | --------------------------------------------- | ---------- |
| `EditorController.svelte.ts`       | `createEditorController`                      | controller |
| `useEditor.svelte.ts`              | `useEditor`                                   | hook       |
| `createEditor.svelte.ts`           | `createEditor`                                | service    |
| `createEditorStatus.svelte.ts`     | `createEditorStatus`                          | service    |
| `createEditorAutoSaver.svelte.ts`  | `createEditorAutoSaver`                       | service    |
| `createEditorFileWriter.svelte.ts` | `createEditorFileWriter`                      | service    |
| `createEditorActions.svelte.ts`    | `createEditorActions`                         | service    |
| `editor.store.svelte.ts`           | `createEditorStore` + singleton `editorStore` | store      |

---

## Known DI/PF Gaps (pending cleansing pass)

These are the outstanding violations relative to the Terminal system's standard.
Work through these in a dedicated refactor pass — do not fix them piecemeal.

| #   | Location                     | Issue                                                                                                                                                                                                                                                                                                                     |
| --- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `Editor.svelte`              | Subscribes to `collaborationPermissionsStore` manually with a raw `$state` variable instead of injecting a `getCanWrite` closure from a hook (like `useTerminal` handles permissions via `store.applyPermissions`). The subscription is created at module init time, before `onMount`, which is fragile.                  |
| 2   | `EditorController.svelte.ts` | `getCanWrite: () => boolean` is declared in `EditorControllerOptions` and accepted by the controller but **never passed into any service**. It is a dead parameter — the runtime has no way to honour read-only mode. Fix: thread it through `createEditor`'s `EditorRuntimeDependencies` so the runtime can gate writes. |
| 3   | `EditorController.svelte.ts` | `activity: unknown` is passed in and stored in options but never used by the controller body. Either wire it up or remove it from the type.                                                                                                                                                                               |
| 4   | `createEditor.svelte.ts`     | `onPersist` / `onPersistBatch` callbacks use an inline `nodePath` alias inconsistently (`activePath` in offline branch vs `nodePath` in the persist payload type). Audit the payload shape against `EditorRuntimeDependencies`.                                                                                           |
| 5   | `Editor.svelte`              | Imports `editorStore` and `activity` as module singletons directly. Post-cleansing, these should be injected via context or passed from the parent layout, keeping `Editor.svelte` dependency-free beyond `requireIDEContext()`.                                                                                          |

---

## Layer-by-Layer Breakdown

### 1. `Editor.svelte` — DOM Owner & Wiring Root

**What it does:** the only file that owns a DOM reference (`bind:this={element}`). Pulls context, instantiates the controller, wires lifecycle, and renders the Monaco mount point alongside UI chrome.

**`createEditorController` call site — correct parameter shape:**

```ts
createEditorController({
	ide, // IDEContext from requireIDEContext()
	store: editorStore, // ← must be `store`, NOT `editorStore`
	activity,
	getPanels: () => panels,
	getCanWrite: () => canWrite
});
```

> ⚠️ **Bug fixed:** the original call passed `editorStore:` as the key name.
> `EditorControllerOptions` declares the field as `store:`. Mismatched key
> caused `options.store` to be `undefined` throughout the controller, silently
> breaking `createEditorStatus`, `deriveEditorTabItems`, and
> `shouldShowEmptyEditorState`.

**`onMount` sequence:**

```
1. editorPane.mountShortcuts()          → registers Cmd+S keydown, returns cleanup
2. window.addEventListener('pagehide')  → calls editorPane.shutdown() on tab close
3. editorPane.initializeEditor(element) → async: boots Monaco, sets up models/collab
```

**`$effect` — active path sync:**

```svelte
$effect(() => {
    void editorStore.activeTabPath;           ← register reactive dependency
    editorPane.syncAfterActivePathChange();   ← re-sync Monaco model on tab switch
})
```

**`onDestroy` sequence:**

```
1. unsubscribePermissions()   ← stop collaborationPermissionsStore subscription
2. editorPane.shutdown()      ← drain saves, flush file writes, destroy Monaco + Yjs
```

**Template bindings:**

| Element                  | Data source                                                                      |
| ------------------------ | -------------------------------------------------------------------------------- |
| `<Tabs>`                 | `editorPane.tabs`, `editorStore.openFile`, `editorStore.closeTab`                |
| `<EditorSaveStatus>`     | `editorPane.autoSaver.status`, `editorPane.saveStatusVariant`                    |
| `<EditorBreadcrumbs>`    | `editorStore.activeTabPath`                                                      |
| `<EditorEmptyState>`     | `editorPane.quickActions` (shown when `editorPane.showEmptyState`)               |
| `<ErrorPanel>`           | `editorPane.editorRuntimeError`, `editorPane.initializingEditor`, retry callback |
| `<div.editor-container>` | `bind:this={element}` — Monaco mounts here; hidden when error or empty           |

---

### 2. `EditorController.svelte.ts` — Assembly Layer

**Function:** `createEditorController(options: EditorControllerOptions)`
**Receives:** `{ ide, store, activity, getPanels, getCanWrite }`

Assembly only — no `$state` of its own. Instantiates all services and the hook, wires them together, computes derived UI state, and returns a flat API for `Editor.svelte`.

#### Services instantiated:

**`createEditorAutoSaver(() => ide.getProject())`**
Debounced Convex `upsertFile` mutations. The `getProject` closure is lazy.
Exposed: `autoSaver.status`, `autoSaver.triggerAutoSave`, `autoSaver.drainAndCleanup`.

**`createEditorFileWriter(() => ide.getWebcontainer())`**
Debounced WebContainer `fs.writeFile` calls, per-file sequential write queue.
Exposed: `fileWriter.writeFile`, `fileWriter.drainAndDispose`.

**`createEditorStatus(store)`**
Reads Monaco model state (cursor, language, EOL) and writes it into the editor store.
Exposed: `status.syncFromEditor(editor)`.

**`createEditor(deps)`** — the Monaco + Yjs runtime. Detailed in section 3.

#### Hook instantiated:

**`useEditor({ runtime, status })`**
Wraps the runtime with Svelte-reactive error/loading state. See section 4.

#### The `onPersist` double-write:

```
createEditor.onPersist({ nodePath, content })
    │
    ├──► autoSaver.triggerAutoSave(nodePath, content)
    │        └── debounced 1500 ms → Convex upsertFile (source of truth)
    │
    └──► fileWriter.writeFile(nodePath, content)
             └── debounced 120 ms → WebContainer fs.writeFile (live HMR)
```

#### Shutdown sequence — order is critical:

```
actions.shutdown()
    │
    ├── 1. autoSaver.drainAndCleanup()    ← flush pending Convex saves
    ├── 2. fileWriter.drainAndDispose()   ← flush pending WebContainer writes
    └── 3. editor.destroy()              ← tear down Monaco + Yjs (via useEditor hook)
```

Reversing steps 1/2 and 3 would attempt to read from a destroyed Monaco instance.

#### Derived UI state:

| Getter              | Source                                             | Consumer             |
| ------------------- | -------------------------------------------------- | -------------------- |
| `saveStatusVariant` | `deriveEditorSaveStatusVariant(autoSaver.status)`  | `<EditorSaveStatus>` |
| `showEmptyState`    | `shouldShowEmptyEditorState(tabs, activeTabPath)`  | template gate        |
| `tabs`              | `deriveEditorTabItems(store.tabs, store.isActive)` | `<Tabs>`             |

---

### 3. `createEditor.svelte.ts` — Monaco + Yjs Runtime Service

**Function:** `createEditor(deps: EditorRuntimeDependencies)`

Pure runtime — **no reactive state, no error reporting**. The hook (`useEditor`) wraps it with all Svelte-reactive lifecycle concerns.

**Receives (`EditorRuntimeDependencies`):**

| Dep              | Type                         | Purpose                                              |
| ---------------- | ---------------------------- | ---------------------------------------------------- |
| `getProject`     | `() => Project \| undefined` | Lazy project resolver — Yjs seeding and persist diff |
| `getActivePath`  | `() => string \| null`       | Current editor tab path                              |
| `toProjectFile`  | `(path) => string`           | Convert WC path to project-relative node path        |
| `toWebPath`      | `(path) => string`           | Inverse of toProjectFile                             |
| `readFile`       | `async (path) => string`     | Read from WebContainer FS (offline model creation)   |
| `onStatusSync`   | `() => void`                 | Called on cursor/model change — triggers status read |
| `onPersist`      | `(payload) => void`          | Called per-file with changed content                 |
| `onPersistBatch` | `(payloads) => void`         | Optional batch version of onPersist                  |

**Online path (room present):**

```
initialize(element)
    ├── createMonacoInstance()
    ├── editor.create(element, MONACO_OPTIONS)
    ├── setupStatusListeners()
    └── setupCollaborativeModels()
            ├── startCollaborationSession({ project, editor, ... })
            │       ├── enterRoom() → Liveblocks room
            │       ├── createYjsDoc() → Y.Doc + LiveblocksYjsProvider
            │       └── bindEditorModels() → MonacoBinding per open file
            ├── seedYDocFromNodes()     ← populate Yjs from Convex node content (once)
            ├── seedPersistSignatures() ← initialise lastPersistedByFile map
            └── onYDocUpdate → schedulePersist(ydoc)
                                    └── debounced diffYDocFiles → onPersist / onPersistBatch
```

**Offline path (no room):**

```
initialize(element)
    └── setupOfflineModels()
            ├── createOfflineModels() → direct Monaco ITextModels (no Yjs)
            └── editor.onDidChangeModelContent → onPersist immediately
```

**Destroy sequence:**

```
destroy()
    ├── clearTimeout(persistTimer)
    ├── lastPersistedByFile.clear()
    ├── disposeAll()             ← all Monaco IDisposable listeners
    ├── destroyModelBindings()   ← MonacoBinding.destroy() + model.dispose()
    ├── session?.dispose()
    ├── session?.provider.destroy()
    ├── session?.leaveRoom()
    └── editor?.dispose()
```

---

### 4. `useEditor.svelte.ts` — Lifecycle Hook

**Function:** `useEditor({ runtime, status })`
**Lives in:** `src/lib/hooks/`

Svelte 5 hook. Holds reactive state (`$state`) and provides a stable API that the controller calls imperatively. Does not render anything. All dependencies injected.

**Owns:** `editorRuntimeError`, `editorReady`, `initializingEditor` — all `$state`.

#### `initializeEditor(element)`:

```
if (!element || initializingEditor) return   ← guard: no double-init
initializingEditor = true
runtime.destroy()                            ← always tear down before re-init (retry safety)
await runtime.initialize(element)
syncStatus()                                 ← initial status read from Monaco
editorReady = true
```

On error: `editorRuntimeError` is set → `Editor.svelte` renders `<ErrorPanel>` with
a retry button that calls `initializeEditor(element)` again.

#### `syncAfterActivePathChange()`:

```
if (!editorReady || editorRuntimeError) return
runtime.syncActiveEditorModel()
syncStatus()
```

Called by `Editor.svelte`'s `$effect` on every `activeTabPath` change.

---

### 5. `createEditorActions.svelte.ts` — Action Surface Service

**Function:** `createEditorActions(ctx: EditorActionContext)`

Pure functions over injected context. All side-effects delegate to services.

**`EditorActionContext` shape:**

```ts
{
    ide: IDEContext,
    editorStore: EditorStore,
    services: {
        autoSaver:  ReturnType<typeof createEditorAutoSaver>,
        fileWriter: ReturnType<typeof createEditorFileWriter>,
        runtime:    ReturnType<typeof createEditor>,
        lifecycle:  ReturnType<typeof useEditor>
    },
    getPanels: () => IDEPanels | undefined
}
```

**Actions returned:**

| Action                        | Delegates to                                                   |
| ----------------------------- | -------------------------------------------------------------- |
| `initializeEditor(element)`   | `lifecycle.initializeEditor(element)`                          |
| `syncAfterActivePathChange()` | `lifecycle.syncAfterActivePathChange()`                        |
| `shutdown()`                  | drain `autoSaver` → drain `fileWriter` → `lifecycle.destroy()` |
| `openFile(path)`              | `editorStore.openFile(path)`                                   |
| `closeTab(path)`              | `editorStore.closeTab(path)`                                   |
| `togglePanel(key)`            | `panels[key] = !panels[key]`                                   |

---

### 6. `editor.store.svelte.ts` — Editor State Store

**Exports:** `createEditorStore()` factory + `editorStore` singleton + `EditorStore` type.

Owns tab list, active tab path, and editor status (cursor, language, EOL, encoding).

**Tab management:**

```
openFile(path)
    ├── if not in tabs: push { path, label: basename(path) }
    └── activeTabPath = path

closeTab(path)
    ├── remove from openTabs
    └── if was active: activate tabs[idx] ?? tabs[idx-1] ?? null
```

**`updateStatus` guard:** field-by-field equality check before mutating — prevents spurious reactive updates from Monaco firing identical cursor positions.

---

## Full Data Flow Diagram

```
Convex DB ─────────────────────────────────────────────────────────────┐
Liveblocks room ────────────────────────────────────────────────────┐  │
WebContainer FS ─────────────────────────────────────────────────┐  │  │
                                                                  │  │  │
ide-context.ts (Svelte context)                                   │  │  │
    getWebcontainer() ────────────────────────────────────────────┤  │  │
    getProject() → Project { nodes[], room, isOwner }             │  │  │
         │                                                        │  │  │
         ▼                                                        ▼  ▼  ▼
   Editor.svelte
         │
         │  createEditorController({ ide, store: editorStore, ... })
         │◄──────────────────────────────────────────────────────────────┐
         │                      EditorController                         │
         │                           │                                   │
         │              ┌────────────┼───────────┐                       │
         │              ▼            ▼           ▼                       │
         │        autoSaver     fileWriter   createEditor                │
         │              │            │           │                       │
         │              │            │    ┌──────┴──────┐                │
         │              │            │    │             │                │
         │              │            │  online       offline             │
         │              │            │    │             │                │
         │              │            │  Yjs+         Monaco              │
         │              │            │  Liveblocks   models only         │
         │              │            │    │                              │
         │           onPersist callback ◄──┘                             │
         │              │      │                                         │
         │              ▼      ▼                                         │
         │           Convex  WC fs.writeFile                             │
         │                                                               │
         │  useEditor({ runtime, status })                               │
         │      editorRuntimeError ──► <ErrorPanel>                      │
         │      initializingEditor ──► retry button disabled             │
         │      initializeEditor() ◄── onMount                           │
         │      syncAfterActivePathChange() ◄── $effect(activeTabPath)   │
         │                                                               │
         ▼                                                               │
   Template bindings ──────────────────────────────────────────────────┘
         │
         ├──► <Tabs>               tabs, onSelect→openFile, onClose→closeTab
         ├──► <EditorSaveStatus>   autoSaver.status, saveStatusVariant
         ├──► <EditorBreadcrumbs>  activeTabPath
         ├──► <EditorEmptyState>   quickActions   (when showEmptyState)
         ├──► <ErrorPanel>         editorRuntimeError, retry  (when error)
         └──► <div.editor-container> bind:this={element}
```
