# Terminal — Architecture & Data Flow Report

## File Hierarchy

```
Terminal.svelte                                   ← wiring root + DOM owner
├── createTerminal()                              ← composition root (createTerminal.svelte.ts)
│   ├── createTerminalPanel()                     ← panel tab state + xterm options
│   ├── createTerminalSessions()                  ← session list, persistence, ordering
│   └── createTerminalWorkspace()                 ← runtime orchestration, shell lifecycle
│       ├── createShellProcess()                  ← WebContainer jsh process wrapper
│       └── theme MutationObserver                ← CSS variable → xterm theme sync
└── useTerminal()                                 ← mount/destroy lifecycle hook
```

---

## Layer-by-Layer Breakdown

### 1. `Terminal.svelte` — Wiring Root

**What it does:** the only file that touches the IDE context and the stores directly. It creates the terminal composition, calls the lifecycle hook, and passes granular props down to the three presentation components. No logic lives here — every method is delegated.

**Injections received:**

- `requireIDEContext()` — pulls `IDEContext.getWebcontainer` from Svelte context (set by the layout above)
- `collaborationPermissionsStore` — re-exported from `createTerminal.svelte.ts` to keep this file decoupled from `$lib/stores`
- `getPanelsContext()` — pulls `IDEPanels` from Svelte context for maximize/close layout mutations

**`onMount` sequence:**

```
1. useTerminal(terminal).mount()
    ├── sessions.restoreFromStorage()     ← restore persisted session list
    ├── workspace.syncRuntimes()          ← create shell runtimes for all sessions
    └── collaborationPermissionsStore.subscribe()
            └── terminal.applyPermissions(canWrite, roomId)
```

**`$effect` — runtime sync:**

```
$effect(() => {
    workspace.syncRuntimes();   ← runs on every session list change
})
```

Declared at component init so it lives in the correct Svelte 5 reactive context. The `$effect` in `useTerminal` is also registered here — both reconcile runtimes, but the effect in `useTerminal` is the authoritative one; the `onMount` call is for the initial load before the first reactive tick.

**`onDestroy` sequence:**

```
1. unsubscribePermissions()   ← stop the store subscription
2. workspace.destroy()        ← kill all shell processes + disconnect theme observer
```

**Template bindings:**

| Component               | Data source                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------ |
| `<TerminalPanelHeader>` | `panel.tabItems`, `panel.activeTab`, workspace action callbacks                            |
| `<TerminalToolbar>`     | `panel.activeTab`, `workspace.sessionViews`, `sessions.activeSessionId`, session callbacks |
| `<TerminalViewport>`    | `workspace.sessionViews`, `workspace.placeholderText`, `canExecute`, `panel.xtermOptions`  |

---

### 2. `createTerminal.svelte.ts` — Composition Root (Service)

**What it does:** the single factory that wires all three sub-controllers together, owns the `canExecute`/`roomId` reactive permission state, and returns the composed object that `Terminal.svelte` and `useTerminal` destructure from.

No logic of its own — it is purely a composition layer. This keeps `Terminal.svelte` free of constructor calls and lets `useTerminal` operate against a single typed object.

**Receives:** `ide: IDEContext`

**Creates:**

```
panel     = createTerminalPanel()
sessions  = createTerminalSessions()
workspace = createTerminalWorkspace({ panel, sessions, createShell, ... })
```

The `createShell` factory is wired inline:

```ts
createShell: ({ canExecute, onAudit }) =>
	createShellProcess(ide.getWebcontainer, { canExecute, onAudit });
```

**Permission state — why it lives here:**  
`canExecute` and `roomId` are `$state` rather than being passed as static values because the Liveblocks permission subscription fires asynchronously after mount. `applyPermissions` is the single update surface — `useTerminal` calls it from the store subscription so `workspace` always reads the current values via closures.

**Re-exports:** `collaborationPermissionsStore` — so `Terminal.svelte` can import it from one place without coupling to `$lib/stores` directly.

---

### 3. `createTerminalPanel.svelte.ts` — Panel Tab State (Service)

**What it does:** owns which panel tab is active (`PROBLEMS`, `OUTPUT`, `DEBUG CONSOLE`, `TERMINAL`, `PORTS`) and the static xterm initialisation options. Also exports pure helpers used by `createTerminalWorkspace`.

**`$state`:** `activeTab`  
**`$derived`:** `tabItems` — the full tab bar config array, recomputed when `activeTab` changes

**Exported helpers (not the primary function — used by workspace):**

| Export                | Type     | Used by                                               |
| --------------------- | -------- | ----------------------------------------------------- |
| `TERMINAL_PANEL_TABS` | const    | type narrowing across files                           |
| `isTerminalPanelTab`  | function | `createTerminalWorkspace` — guards `switchTab` input  |
| `getTabPlaceholder`   | function | `createTerminalWorkspace` — derives `placeholderText` |

**Why xterm options live here:** they are static and belong to the panel configuration layer, not to any individual shell session. Keeping them here prevents `createTerminalWorkspace` from needing to know about xterm internals.

---

### 4. `createTerminalSessions.svelte.ts` — Session List (Service)

**What it does:** owns the ordered list of terminal session metadata, the active session ID, and localStorage persistence. Pure data — no shell processes, no xterm, no WebContainer.

**`$state`:** `sessions`, `activeSessionId`, `nextOrder`

**Persistence:** reads/writes `sandem.terminal.sessions.v1` in localStorage via `persist()` (called after every mutation) and `restoreFromStorage()` (called once on mount by `useTerminal`).

**Session lifecycle rules:**

```
addSession()    → push new meta, activate it, persist, return id
closeSession()  → if last session: replace with fresh one (never empty)
                  else: remove, activate sessions[0] if was active, persist
renameSession() → trim label, no-op on empty string, persist
reorderSession()→ swap adjacent indices (left/right), persist
```

**Why "never empty" matters:** `createTerminalWorkspace` always reads `sessions.activeSessionId` to find the active runtime. If the session list became empty, that lookup would return `undefined` and every shell action would silently no-op.

---

### 5. `createTerminalWorkspace.svelte.ts` — Runtime Orchestration (Service)

**What it does:** the most complex layer. It reconciles the session metadata list with live shell process runtimes, manages the xterm → shell attachment lifecycle, syncs CSS theme variables into xterm, and exposes every action the UI needs.

**`$state`:** `runtimes: SessionRuntime[]`

**`$derived`:**

| Derived           | Source                                    | Consumer                              |
| ----------------- | ----------------------------------------- | ------------------------------------- |
| `sessionViews`    | `runtimes` mapped to flat `SessionView`   | `TerminalViewport`, `TerminalToolbar` |
| `placeholderText` | `panel.activeTab` via `getTabPlaceholder` | `TerminalViewport`                    |

#### Runtime reconciliation — `syncRuntimes()`

Called reactively (via `$effect` in `useTerminal`) whenever the session list changes:

```
for each session in sessions.sessions:
    if runtime exists → update label
    else              → buildRuntime(meta) → push to runtimes

for each runtime not in sessions:
    shell.kill() → remove from runtimes
```

This is the bridge between the pure-data sessions layer and the live WebContainer processes.

#### Shell attachment sequence — `onTerminalMount(sessionId)`

Called by the xterm widget's `onLoad` callback once the DOM terminal instance exists:

```
findRuntime(sessionId)
    ├── applyThemeToTerminal(runtime.terminal)  ← sync CSS vars → xterm.options.theme
    ├── startThemeWatcher()                     ← MutationObserver on data-theme/data-mode
    └── runtime.shell.attach(runtime.terminal)  ← spawn jsh + pipe stdin/stdout
```

#### Theme sync

A `MutationObserver` watches `document.documentElement` for `data-theme`, `data-mode`, `style`, `class` attribute changes. On any change it reads `--bg`, `--text`, `--border`, `--fonts-mono` CSS variables and writes them into every live xterm instance's `options.theme`. This keeps all terminals in sync with the global theme switcher without any explicit prop passing.

#### Shell action surface

| Method                | What it does                                                     |
| --------------------- | ---------------------------------------------------------------- |
| `ensureShellReady`    | no-op if shell already attached; attaches if not                 |
| `clearActiveTerminal` | calls `shell.clearScreen()` on the active runtime                |
| `restartActiveShell`  | `shell.restart()` — kills and re-spawns the jsh process          |
| `killActiveShell`     | `shell.kill()` — terminates without restart                      |
| `sendInput`           | routes raw data to `shell.sendInput(data)` for the given session |

#### Layout actions

`toggleMaximize` and `closePanel` mutate `layout.upPane`/`layout.downPane` directly — the same `IDEPanels` object read by the pane splitters in the layout shell.

---

### 6. `useTerminal.svelte.ts` — Lifecycle Hook

**What it does:** owns the `Terminal.svelte` mount/destroy sequence. Registers the reactive `$effect` for runtime sync (must be in component init context), restores persisted sessions, subscribes to permissions, and tears down on destroy.

**Receives:** `terminal: TerminalComposition`

**Why a separate hook:** same reason as `useEditor` in the editor layer. The component's `onMount`/`onDestroy` callbacks are cleaner when the sequencing logic is extracted. It also makes the lifecycle testable in isolation.

```
useTerminal(terminal).mount()
    │
    ├── $effect(() => workspace.syncRuntimes())   ← registered in component reactive context
    ├── sessions.restoreFromStorage()
    ├── workspace.syncRuntimes()                  ← initial sync before first reactive tick
    ├── collaborationPermissionsStore.subscribe(applyPermissions)
    └── returns destroy()
            ├── unsubscribePermissions()
            └── workspace.destroy()
```

---

## Full Data Flow Diagram

```
WebContainer FS ──────────────────────────────────────────────────────────┐
Liveblocks permissions ────────────────────────────────────────────────┐  │
localStorage ──────────────────────────────────────────────────────┐   │  │
                                                                   │   │  │
ide-context.ts (Svelte context)                                    │   │  │
    getWebcontainer() ─────────────────────────────────────────────┼───┼──┤
         │                                                         │   │  │
         ▼                                                         │   │  │
   Terminal.svelte                                                 │   │  │
         │                                                         │   │  │
         │  createTerminal(ide)                                     │   │  │
         │    ├── createTerminalPanel()                             │   │  │
         │    ├── createTerminalSessions() ◄──────────────────────┘   │  │
         │    └── createTerminalWorkspace()                            │  │
         │             └── createShellProcess(getWebcontainer) ◄───────┼──┘
         │                                                             │
         │  useTerminal(terminal).mount()                              │
         │    ├── $effect → workspace.syncRuntimes()                   │
         │    ├── sessions.restoreFromStorage()                        │
         │    └── permissionsStore.subscribe ◄──────────────────────┘
         │             └── terminal.applyPermissions(canWrite, roomId)
         │
         ├──► <TerminalPanelHeader>
         │        panel.tabItems, panel.activeTab
         │        onTabSelect  → workspace.switchTab(id)
         │        onClear      → workspace.clearActiveTerminal()
         │        onRestart    → workspace.restartActiveShell()
         │        onKill       → workspace.killActiveShell()
         │        onMaximize   → workspace.toggleMaximize()
         │        onClose      → workspace.closePanel()
         │
         ├──► <TerminalToolbar>
         │        workspace.sessionViews, sessions.activeSessionId
         │        onSelect     → workspace.selectSession(id)
         │        onClose      → workspace.closeSession(id)
         │        onCreate     → workspace.newSession()
         │        onRename     → workspace.renameSession(id, label)
         │        onMove       → workspace.reorderSession(id, dir)
         │        onEnsureShell→ workspace.ensureShellReady(id)
         │
         └──► <TerminalViewport>
                  workspace.sessionViews, workspace.placeholderText
                  panel.xtermOptions, canExecute
                  onLoad  → workspace.onTerminalMount(sessionId)
                  onData  → workspace.sendInput(sessionId, data)
                  onRetry → workspace.ensureShellReady(sessionId)
```

---

## Naming Convention Refactor Map (Terminal files)

Convention:

- `/services`: `createNameSurname.svelte.ts` — **default export function must match filename**
- `/hooks`: `useName.svelte.ts` — **default export function must match filename**

The file names are all already correct. The only violations are the **function names** inside the service files, which append `Controller` — a stale qualifier from before the convention was established.

| Current file                        | Status       | Current function name               | Required function name        | Other exports (OK — services may have multiple)                                            |
| ----------------------------------- | ------------ | ----------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------ |
| `createTerminal.svelte.ts`          | ✅ file name | `createTerminal` ✓                  | `createTerminal` ✓            | `collaborationPermissionsStore` (re-export)                                                |
| `createTerminalPanel.svelte.ts`     | ⚠️ function  | `createTerminalPanelController`     | **`createTerminalPanel`**     | `TERMINAL_PANEL_TABS`, `isTerminalPanelTab`, `getTabPlaceholder`, `TerminalPanelTab` types |
| `createTerminalSessions.svelte.ts`  | ⚠️ function  | `createTerminalSessionsController`  | **`createTerminalSessions`**  | `TerminalSessionMeta` type                                                                 |
| `createTerminalWorkspace.svelte.ts` | ⚠️ function  | `createTerminalWorkspaceController` | **`createTerminalWorkspace`** | `SessionView`, `TerminalWorkspaceOptions` types                                            |
| `useTerminal.svelte.ts`             | ✅ both      | `useTerminal` ✓                     | `useTerminal` ✓               | `TerminalComposition` (imported from service)                                              |

### Cascading renames required

Renaming the three service functions means every call site must update:

| Rename                                                          | Call sites to update                                                         |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `createTerminalPanelController` → `createTerminalPanel`         | `createTerminal.svelte.ts`, `createTerminalWorkspace.svelte.ts` import types |
| `createTerminalSessionsController` → `createTerminalSessions`   | `createTerminal.svelte.ts`, `createTerminalWorkspace.svelte.ts` import types |
| `createTerminalWorkspaceController` → `createTerminalWorkspace` | `createTerminal.svelte.ts`, `useTerminal.svelte.ts`                          |

The `ReturnType<typeof createTerminalPanelController>` pattern used in `TerminalWorkspaceOptions` will also need updating to `ReturnType<typeof createTerminalPanel>` etc.
