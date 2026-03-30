# Terminal System

> **Philosophy: Data Injection (DI) + Pure Functions (PF)**
>
> Every layer receives its dependencies. No layer reaches into a sibling or
> parent. Pure functions (or pseudo-pure closures) do not hold state —
> `$state` lives exclusively in stores. Shell processes, xterm instances, and
> theme application are side-effects that belong in services, not components.
> Components receive data through props and emit events upward through
> callbacks; they never import stores directly.

---

## Layer Map

```
stores/terminal/            ← reactive $state only, zero IO
  terminal.panel.store
  terminal.session.store
  terminal.store            ← composes the two above + permissions

services/terminal/          ← runtime orchestration, shell lifecycle
  createTerminalShell       ← jsh process, xterm attachment, git shim
  createTerminalWorkspace   ← reconciles store ↔ shell runtimes; orchestrates everything

utils/terminal/
  terminal-theme            ← pure util: reads CSS vars, writes to terminal.options

hooks/
  useTerminal               ← $effects + mount/cleanup; bridges store and workspace

controllers/
  TerminalController        ← assembly root; flat API consumed by Terminal.svelte

components/
  Terminal.svelte           ← wiring root; props-only, no logic
  TerminalPanelHeader       ← tab bar + header action buttons
  TerminalToolbar           ← session tabs, rename, reorder, new session
  TerminalViewport          ← selects active session, delegates to TerminalSessionPane
  TerminalSessionPane       ← owns xterm widget; forwards terminal instance to workspace
```

---

## Files — Descriptions & Responsibilities

### Stores (`stores/terminal/`)

#### `terminal.panel.store.svelte.ts` → `createTerminalPanelStore()`

Owns the active panel tab (`PROBLEMS | OUTPUT | DEBUG CONSOLE | TERMINAL | PORTS`)
and the static xterm init options. Derives `tabItems[]` from the active tab so
components never compute display state themselves.

Exports: `TerminalPanelTab`, `TerminalPanelTabItem`, `isTerminalPanelTab()`,
`getTabPlaceholder()`.

**No IO. No shell knowledge. Pure $state.**

#### `terminal.session.store.svelte.ts` → `createTerminalSessionStore()`

Owns the ordered session metadata list (`TerminalSessionMeta[]`), the active
session ID, and the `nextOrder` counter. Starts **empty** (`sessions = []`,
`nextOrder = 1`) to prevent SSR hydration mismatches. `useTerminal.mount()`
is responsible for populating it on the client.

Provides `hydrate()` as an injection point — the hook calls it with parsed
localStorage data, keeping IO entirely outside the store.

Exports: `TerminalSessionMeta`.

**No IO. No localStorage. No shell knowledge. Pure $state.**

#### `terminal.store.svelte.ts` → `createTerminalStore()`

Composition root for the two sub-stores. Adds `canExecute` and `roomId` for
collaboration permissions. Exposes `applyPermissions()` called by the hook's
`collaborationPermissionsStore` subscriber.

Exports: `TerminalStore` type. Instantiates and exports `terminalStore`
singleton consumed by `Terminal.svelte` and `TerminalController`.

---

### Services (`services/terminal/`)

#### `createTerminalShell.svelte.ts` → `createTerminalShell(getWebcontainer, options)`

Manages a single `jsh` WebContainer process. Responsibilities:

- Spawns the shell process via `webcontainer.spawn('jsh', ...)`.
- Loads and fits the `FitAddon`; registers a `window.resize` listener.
- Writes a git command shim on first attach (maps `git` → `isogit`/`npx`).
- Enforces execute permissions via `options.canExecute()` — blocks writes and
  calls `options.onAudit()` for every command, allowed or not.
- Exposes `attach`, `sendInput`, `clearScreen`, `restart`, `kill`.

Uses `$state(ready)` to expose shell readiness reactively so `SessionView`
(derived in the workspace) can surface it to components without polling.

#### `createTerminalWorkspace.svelte.ts` → `createTerminalWorkspace(opts)`

The orchestration layer. Owns `runtimes[]` (`$state<SessionRuntime[]>`) —
the live shell+terminal pairs that back each session.

Key responsibilities:

- **`syncRuntimes(sessionList)`** — reconciles `runtimes[]` against the
  session metadata list. Adds new runtimes for new sessions, updates labels
  for existing ones, kills and removes stale ones. Wraps everything in
  `untrack()` to prevent re-entrancy with the `$effect` in `useTerminal`.
- **`onTerminalMount(sessionId, terminal)`** — called by `TerminalSessionPane`
  via `Xterm`'s `onLoad` callback. Writes the terminal instance directly into
  `runtimes[idx]` (NOT through a derived `SessionView` — derived state is
  read-only in Svelte 5). Then applies theme and attaches the shell.
- **`ensureShellReady(sessionId)`** — idempotent; re-attaches a shell if the
  terminal exists but the process died.
- **Session & tab actions** — thin delegators to `opts.store.sessions.*` and
  `opts.store.panel.*`, plus `ensureShellReady` calls where needed.
- **`sessionViews`** — `$derived` projection of `runtimes[]` into
  `SessionView[]` (the shape consumed by components). Contains no live
  `Terminal` references — those live on `runtimes[]` directly.
- **`destroy()`** — kills all shell processes on unmount.

---

### Utils (`utils/terminal`)

#### `terminal-theme.ts` → `applyTerminalTheme(terminal)`

Pure utility function. Reads `--bg`, `--text`, `--border`, `--fonts-mono` from
`getComputedStyle(document.documentElement)` and writes them to
`terminal.options`. Takes the terminal instance as a parameter — no closures,
no state.

Called by `createTerminalWorkspace` in two places:

1. `onTerminalMount` — applies theme once on first attachment.
2. `refreshThemes` — re-applies to all live terminals when the
   `MutationObserver` in `useTerminal.mount()` fires on a theme change.

> **Note:** This file is `.ts`, not `.svelte.ts` — it uses no Svelte runes.
> Function name is `applyTerminalTheme`, not `createTerminalTheme`, to reflect
> that it is a pure side-effectful utility, not a factory.

---

### Hook (`hooks/`)

#### `useTerminal.svelte.ts` → `useTerminal({ store, workspace })`

Svelte 5 hook. Must be called during component initialization so its `$effect`
registrations run in the correct reactive context.

**Effect 1 — Runtime sync:**

```ts
$effect(() => {
	const sessions = store.sessions.sessions; // tracked
	workspace.syncRuntimes(sessions);
});
```

Re-runs whenever the sessions array changes. `syncRuntimes` uses `untrack`
internally so writing to `runtimes[]` inside it does not cause a cycle.

**Effect 2 — Auto-persistence:**

```ts
$effect(() => {
	const dataToSave = { next, sessions, active };
	if (sessions.length > 0) localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
});
```

Runs whenever `nextOrder`, `sessions`, or `activeSessionId` changes. Persistence
lives here — not in the store — so the store remains pure.

**`mount()` — one-time client setup:**

1. Reads `localStorage` and calls `store.sessions.hydrate(parsed)`, or calls
   `store.sessions.addSession()` if no valid save exists.
2. Creates a `MutationObserver` on `document.documentElement` to watch theme
   attribute changes; calls `workspace.refreshThemes()` on change.
3. Subscribes to `collaborationPermissionsStore`; calls
   `store.applyPermissions(canWrite, roomId)` on every emission.
4. Returns a `cleanup()` function that unsubscribes, disconnects the observer,
   and calls `workspace.destroy()`.

---

### Controller (`controllers/`)

#### `TerminalController.svelte.ts` → `createTerminalController({ ide, store, getPanels })`

Assembly root. Instantiates `createTerminalWorkspace` and `useTerminal` in the
correct order, then returns a single flat API object for `Terminal.svelte` to
consume.

**Nothing else should instantiate these services.** The controller is the only
composition point.

Returned API surface (all delegated, no logic):

| Category         | Properties / Methods                                                                                        |
| ---------------- | ----------------------------------------------------------------------------------------------------------- |
| Lifecycle        | `mount`                                                                                                     |
| Panel state      | `activeTab`, `tabItems`, `xtermOptions`                                                                     |
| Session state    | `activeSessionId`                                                                                           |
| Permissions      | `canExecute`                                                                                                |
| Workspace state  | `sessionViews`, `placeholderText`                                                                           |
| Panel actions    | `switchTab`, `clearActiveTerminal`, `restartActiveShell`, `killActiveShell`, `toggleMaximize`, `closePanel` |
| Session actions  | `selectSession`, `closeSession`, `newSession`, `renameSession`, `reorderSession`                            |
| Viewport actions | `onTerminalMount`, `sendInput`, `ensureShellReady`                                                          |

---

### Components (`components/terminal/`)

All components are **props-in / callbacks-out**. None import stores, context,
or services directly.

#### `Terminal.svelte`

Wiring root. Calls `createTerminalController(...)` at the top of its script,
calls `ctrl.mount()` in `onMount`, and fans all props/callbacks out to the
three child components. Contains zero logic beyond this distribution.

#### `TerminalPanelHeader.svelte`

Renders the tab bar (via `<Tabs>`) and the five header action buttons
(Clear, Restart, Kill, Maximize, Close). Restart and Kill are disabled when
`activeTab !== 'TERMINAL'`.

#### `TerminalToolbar.svelte`

Renders per-session tab buttons and the four toolbar icon buttons
(Move Left, Move Right, Rename, New Terminal). Manages its own local rename
UI state (`renamingId`, `renameValue`) — this is ephemeral presentation state
that belongs in the component, not the store.

Session tab click calls **only `onSelectSession`**. `workspace.selectSession`
already calls `ensureShellReady` internally — there is no `onEnsureShell`
prop on this component.

#### `TerminalViewport.svelte`

Derives `activeSession` from `sessions` + `activeSessionId`. Renders
`TerminalSessionPane` when `activeTab === 'TERMINAL'` and `activeSession`
exists; otherwise renders a placeholder text string.

#### `TerminalSessionPane.svelte`

Owns the `Xterm` widget. Holds a local `terminal = $state<Terminal>()` bound
via `bind:terminal` on the `<Xterm>` component. On `onLoad`, passes this
instance directly to `onLoad(sessionId, terminal!)` — the workspace's
`onTerminalMount` — so the runtime can register it on `runtimes[idx]`.

> **Why not bind:terminal through SessionView?**
> `SessionView` is a `$derived` value. In Svelte 5, derived state is
> read-only — writing to a derived object via `bind:` is a silent no-op.
> The terminal instance must be routed directly: component → onLoad callback
> → `runtimes[idx].terminal`.

Renders an `ErrorPanel` with a Retry button when `terminalError` is set.
Renders a read-only notice when `!canExecute`. Renders the xterm widget and
a status bar otherwise.

---

## Initialization Call Order

```
Terminal.svelte (script evaluation)
  └─ createTerminalController({ ide, store, getPanels })
       ├─ createTerminalWorkspace({ store, createShell, recordAudit, getLayout })
       │    └─ $state runtimes = []
       │    └─ $derived sessionViews, placeholderText
       └─ useTerminal({ store, workspace })
            ├─ $effect #1: store.sessions.sessions → workspace.syncRuntimes()
            └─ $effect #2: sessions/active/nextOrder → localStorage.setItem()

Terminal.svelte (onMount)
  └─ ctrl.mount()
       ├─ localStorage.getItem(STORAGE_KEY)
       │    ├─ [found]  store.sessions.hydrate(parsed)
       │    └─ [absent] store.sessions.addSession()
       │         └─ $effect #1 fires → workspace.syncRuntimes([newSession])
       │              └─ buildRuntime(meta) → createTerminalShell(...)
       ├─ new MutationObserver → workspace.refreshThemes()
       └─ collaborationPermissionsStore.subscribe → store.applyPermissions()

TerminalSessionPane (xterm onLoad fires, after DOM ready)
  └─ ctrl.onTerminalMount(sessionId, terminal)
       ├─ runtimes[idx] = { ...runtimes[idx], terminal }
       ├─ applyTerminalTheme(terminal)
       └─ shell.attach(terminal)
            ├─ XtermAddon.FitAddon → fit()
            ├─ window.addEventListener('resize', fitAddon.fit)
            ├─ webcontainer.spawn('jsh', { terminal: { cols, rows } })
            ├─ setupGitCommandShim()
            └─ shellProcess.output.pipeTo(new WritableStream → terminal.write)
```

---

## Deleted Files

The following files were removed during the cleanup pass. Do not re-add them.

| File                               | Reason                                                                                                                                                                                          |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createTerminalPanel.svelte.ts`    | Fully superseded by `terminal.panel.store.svelte.ts`. Every function was a direct duplicate.                                                                                                    |
| `createTerminalSessions.svelte.ts` | Superseded by `terminal.session.store.svelte.ts` (pure state) + `useTerminal.svelte.ts` (persistence). The old file violated DI by calling `localStorage` from inside session mutation methods. |
| `createTerminal.svelte.ts`         | Pure thin wrapper over `createTerminalController` with zero callers. `Terminal.svelte` already imports the controller directly.                                                                 |

---

## Key Design Decisions

### Why does `TerminalSessionPane` hold local `terminal` state?

The xterm `bind:terminal` binding needs a writable `$state` target. If this
were a prop or derived value, Svelte 5 would silently ignore writes to it.
Keeping it local and forwarding via `onLoad(sessionId, terminal!)` is the
only correct pattern.

### Why does `syncRuntimes` use `untrack`?

`syncRuntimes` is called from inside `$effect #1` which already tracks
`store.sessions.sessions`. If `syncRuntimes` wrote to `runtimes[]` without
`untrack`, and `sessionViews` (derived from `runtimes[]`) were somehow
re-read inside the effect, Svelte could enter a reactive cycle. `untrack`
makes the write unconditional and non-reactive from the effect's perspective.

### Why is persistence in the hook, not the store?

The store is pure `$state`. IO is a side-effect. Putting `localStorage.setItem`
inside session mutation methods (as the deleted `createTerminalSessions.svelte.ts`
did) means the store cannot be unit-tested without mocking `window`. The hook's
`$effect` watches the same state and persists it externally — the store stays
portable and testable.

### Why does `useTerminal` import `collaborationPermissionsStore` directly?

It is the only cross-cutting import in the hook. It is equivalent to
`Editor.svelte` subscribing to the same store for `canWrite`. The permission
signal is an external broadcast that the terminal must respond to; it cannot
be injected as a prop without threading it through four unrelated layers.
This is the explicitly accepted exception to the no-singleton-imports rule.

### Why does `selectSession` not need `ensureShellReady` called separately?

`workspace.selectSession(id)` calls `ensureShellReady(id)` internally.
`TerminalToolbar` previously also called `onEnsureShell(id)` in the same click
handler — this was a double-call bug that caused a second `shell.attach()`
attempt. The fix is to remove `onEnsureShell` from the toolbar entirely.
`ensureShellReady` is still exposed on the controller for `TerminalViewport`'s
Retry button, which is a valid standalone trigger.
