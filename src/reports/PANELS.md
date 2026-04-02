# Panels System

> **Philosophy: Self-contained, layered, DI throughout.**
>
> `PanelsController` is fully self-contained — it owns its store, service, and hook.
> No other part of the workspace reaches into the panels layer directly.
> Consumers read and write panel state exclusively through `IDEPanelsAdapter`,
> which routes all writes through the service so persistence always fires.

---

## Layer Map

```
stores/panels/
  panel.store.svelte.ts                  ← createPanelsStore() — leftPane, downPane, rightPane ($state only)

services/panels/
  createPanelsService.svelte.ts          ← set/toggle/persist/hydrate/reset logic (no $state, no DOM)

hooks/
  usePanels.svelte.ts                    ← $effect: PanelsStore.leftPane → PaneAPI expand/collapse

controllers/panels/
  PanelsController.svelte.ts             ← assembly root; owns store + service + hook
                                           exposes IDEPanelsAdapter + full setter/toggle surface

routes/(app)/[repo]/
  +layout.svelte                         ← instantiates PanelsController via WorkspaceController
                                           passes ctrl.panels to ActivityBar + Statusbar directly

+page.svelte                             ← reads panels via ide.getPanels() (IDE context)
WorkspacePaneLayout.svelte               ← receives panels prop; drives PaneGroup expand/collapse
```

---

## File Map

| File                            | Exported function/type                                           | Layer      |
| ------------------------------- | ---------------------------------------------------------------- | ---------- |
| `panel.store.svelte.ts`         | `createPanelsStore`, `PanelsStore`                               | store      |
| `createPanelsService.svelte.ts` | `createPanelsService`, `PanelsService`                           | service    |
| `usePanels.svelte.ts`           | `usePanels`                                                      | hook       |
| `PanelsController.svelte.ts`    | `createPanelsController`, `IDEPanelsAdapter`, `PanelsController` | controller |

---

## Runtime Call Tree

```
WorkspaceController
└── createPanelsController({ getSidebar })
      ├── 1. createPanelsStore()
      │         leftPane = $state(true)
      │         downPane = $state(true)
      │         rightPane = $state(false)
      │
      ├── 2. createPanelsService({ store })
      │         hydrate / setLeft / setDown / setRight
      │         toggleLeft / toggleDown / toggleRight / resetAll
      │         + localStorage read/write on every mutation
      │
      ├── 3. service.hydrate()
      │         reads localStorage → store.setLeft/setDown/setRight
      │         (called once at construction, before any $effect runs)
      │
      ├── 4. usePanels({ store, service, getSidebar })
      │         $effect: store.leftPane → sidebar?.expand() | collapse()
      │         returns service surface (setLeft … resetAll)
      │
      └── 5. assembles IDEPanelsAdapter
                get leftPane / downPane / rightPane  ← reads store
                set leftPane / downPane / rightPane  ← writes via service
                setLeft / setDown / setRight         ← explicit method form (same as setter)
                resetAll                             ← opens all panes + persists
```

---

## Layer-by-Layer

### `panel.store.svelte.ts` — Reactive State

**Exports:** `createPanelsStore()`, `PanelsStore`

Owns the three booleans and nothing else. No IO, no DOM, no Svelte context.
`$state` lives here and nowhere else in the panels system.

| State       | Default | Meaning                                           |
| ----------- | ------- | ------------------------------------------------- |
| `leftPane`  | `true`  | Sidebar (explorer / activity) visible             |
| `downPane`  | `true`  | Terminal panel visible                            |
| `rightPane` | `false` | Secondary panel visible (preview / right sidebar) |

Setters: `setLeft(v)`, `setDown(v)`, `setRight(v)`, `resetAll()`.

> `resetAll()` is defined on the store for use by the ErrorPanel recovery button —
> it opens all three panes without going through the service (no persistence).
> In practice, call `service.resetAll()` or `IDEPanelsAdapter.resetAll()` so
> localStorage is updated too.

---

### `createPanelsService.svelte.ts` — Logic + Persistence

**Exports:** `createPanelsService(deps)`, `PanelsService`

Pure logic over the store. No `$state`, no DOM, no PaneAPI. Every setter writes
through to the store and then persists to localStorage.

**Persistence key contract:**

| Key                     | Values               |
| ----------------------- | -------------------- |
| `workspace:panel:left`  | `"true"` / `"false"` |
| `workspace:panel:down`  | `"true"` / `"false"` |
| `workspace:panel:right` | `"true"` / `"false"` |

**API surface:**

| Method          | Effect                                                             |
| --------------- | ------------------------------------------------------------------ |
| `hydrate()`     | Reads localStorage → store (called once on boot)                   |
| `setLeft(v)`    | `store.setLeft(v)` + persist                                       |
| `setDown(v)`    | `store.setDown(v)` + persist                                       |
| `setRight(v)`   | `store.setRight(v)` + persist                                      |
| `toggleLeft()`  | `setLeft(!store.leftPane)`                                         |
| `toggleDown()`  | `setDown(!store.downPane)`                                         |
| `toggleRight()` | `setRight(!store.rightPane)`                                       |
| `resetAll()`    | `setLeft(true)` + `setDown(true)` + `setRight(true)` + persist all |

localStorage reads/writes are wrapped in `try/catch` — sandboxed environments
(WebContainer, some browsers) may block storage access silently.

---

### `usePanels.svelte.ts` — DOM Sync Hook

**Exports:** `usePanels(deps)`

The only place `PaneAPI` is touched in the entire panels system.

Must be called at the top level of a Svelte component script (or a hook called
from there) so the `$effect` registers in the correct reactive context.
`WorkspaceController` calls it at construction time for exactly this reason.

**`$effect` registered:**

```
store.leftPane changes
  → sidebar = getSidebar()
  → if (!sidebar) return
  → sidebar.expand() | sidebar.collapse()
```

Currently only `leftPane` is synced to `PaneAPI` — `downPane` and `rightPane` are
driven by `WorkspacePaneLayout.svelte`'s own `$effect` blocks which read
`panels.downPane` / `panels.rightPane` directly.

Returns the full service surface so `PanelsController` only needs to hold
one reference (`hook`) instead of both `hook` and `service`.

---

### `PanelsController.svelte.ts` — Assembly Root

**Exports:** `createPanelsController(options)`, `IDEPanelsAdapter`, `PanelsController`

The only file that instantiates all three inner pieces. Instantiated once inside
`WorkspaceController` — never instantiated in components.

#### `IDEPanelsAdapter`

The public contract for all consumers outside the panels layer.

```ts
interface IDEPanelsAdapter {
	leftPane: boolean; // readable + assignable
	downPane: boolean; // readable + assignable
	rightPane: boolean; // readable + assignable
	setLeft(open: boolean): void;
	setDown(open: boolean): void;
	setRight(open: boolean): void;
	resetAll(): void;
}
```

Getters read from the store reactively. Setters (both assignment form and method
form) route through the service, guaranteeing persistence on every write.
Direct assignment to store properties from outside `PanelsController` is not
supported and has no persistence path.

#### Public API returned by `createPanelsController`

| Property / Method | Type / Signature    | Notes                                                     |
| ----------------- | ------------------- | --------------------------------------------------------- |
| `panels`          | `IDEPanelsAdapter`  | Pass to `ActivityBar`, `Statusbar`, `WorkspacePaneLayout` |
| `leftPane`        | `boolean` (getter)  | Reactive read from store                                  |
| `downPane`        | `boolean` (getter)  | Reactive read from store                                  |
| `rightPane`       | `boolean` (getter)  | Reactive read from store                                  |
| `setLeft(v)`      | `(boolean) => void` | Set + persist                                             |
| `setDown(v)`      | `(boolean) => void` | Set + persist                                             |
| `setRight(v)`     | `(boolean) => void` | Set + persist                                             |
| `toggleLeft()`    | `() => void`        | Flip + persist                                            |
| `toggleDown()`    | `() => void`        | Flip + persist                                            |
| `toggleRight()`   | `() => void`        | Flip + persist                                            |
| `resetAll()`      | `() => void`        | Open all + persist (ErrorPanel recovery)                  |

---

## Consumer Tiers

There are two tiers of consumers, split by the SvelteKit routing boundary.

### Tier 1 — Layout-level (receive `panels` as a prop)

`+layout.svelte` passes `ctrl.panels` directly as a prop. These components
never call `requireIDEContext()` for panels.

```
+layout.svelte
  ├── <ActivityBar getPanels={() => ctrl.panels} />
  └── <Statusbar panels={ctrl.panels} />
```

### Tier 2 — Page-level (read via IDE context)

Components rendered behind `{@render children()}` cannot receive props across
the SvelteKit routing boundary. They access panels through `requireIDEContext()`,
which is the established DI path for the entire workspace layer.

```
+page.svelte
  └── <WorkspacePaneLayout panels={ide.getPanels!()} />

WorkspacePaneLayout.svelte
  └── reads panels.leftPane / downPane / rightPane
      drives PaneGroup expand/collapse via $effect

Editor.svelte, Terminal.svelte
  └── read ide.getPanels() for Ctrl+` / Cmd+\ shortcuts
      write via panels.setDown(v) / panels.setLeft(v)
```

`IDEContext.getPanels` is typed as `(() => IDEPanelsAdapter) | undefined` — it is
optional on `IDEContext` because not every context consumer (e.g. isolated test
routes) provides it. Call sites in `/repo` can safely use `!` or guard with `?.`.

---

## Write Path (end-to-end)

Every panel write — regardless of origin — follows the same path:

```
caller
  │  panels.setDown(true)         ← IDEPanelsAdapter method
  │  panels.downPane = true       ← IDEPanelsAdapter setter (equivalent)
  │  ctrl.toggleDown()            ← WorkspaceController surface
  │  Ctrl+` shortcut              ← editor/terminal keyboard handler
  ▼
PanelsService.setDown(true)
  ├── store.setDown(true)         ← $state mutation → reactive
  └── localStorage.setItem(...)   ← persist

usePanels $effect (leftPane only)
  └── sidebar.expand() | collapse()

WorkspacePaneLayout $effect (downPane / rightPane)
  └── downpane.expand() | collapse()
      rightpane.expand() | collapse()
```

---

## Data Flow Diagram

```
localStorage ────────────────────────────────────► service.hydrate() (boot)
                                                          │
                                                          ▼
                                                    PanelsStore ($state)
                                                          │
                              ┌───────────────────────────┤
                              │                           │
                     IDEPanelsAdapter              usePanels $effect
                    (getters read store)                  │
                              │                           ▼
             ┌────────────────┼──────────┐        PaneAPI (sidebar)
             │                │          │          expand/collapse
             ▼                ▼          ▼
      ActivityBar         Statusbar  WorkspacePaneLayout
      (reads leftPane)    (reads     ($effects → PaneAPI
                          all three)  for down + right)

Write path (any consumer):
  panels.setX(v) / panels.X = v
      │
      ▼
  PanelsService.setX(v)
      ├── PanelsStore.setX(v)   ← triggers $effect + reactivity
      └── localStorage.setItem  ← persistence
```

---

## Key Design Decisions

### Why is `PanelsController` self-contained?

It owns its store, service, and hook so the panels system has exactly one
assembly point and zero circular dependencies. `WorkspaceController` holds
`PanelsController` as a peer, not a parent. Panels state does not flow through
`WorkspaceStore`.

### Why does `IDEPanelsAdapter` expose both setters and methods?

The assignment form (`panels.leftPane = v`) is ergonomic for toggle patterns
(`panels.leftPane = !panels.leftPane`). The method form (`panels.setLeft(v)`)
is necessary for `togglePanel(key)` in `createEditorActions`, where the panel
key is a variable — assignment to a computed property key is not type-safe on
an interface with methods. Both forms write through the same service path.

### Why does `usePanels` only sync `leftPane` to PaneAPI?

`downPane` and `rightPane` control panes inside `WorkspacePaneLayout`, which is
rendered on the page level and binds its own `PaneAPI` references. The sidebar
`PaneAPI` reference lives in `+layout.svelte` and is only accessible to the
layout layer. Splitting sync responsibility by pane avoids threading multiple
`PaneAPI` references into the panels hook.

### Why does `service.hydrate()` run at construction time, not in `onMount`?

`$state` mutations during construction are safe in Svelte 5 — the store values
are set before any component renders, so there is no flash of wrong state.
Deferring to `onMount` would cause a visible pane flash on page load as
collapsed panes open after the initial render.

### Why is `getPanels` optional on `IDEContext`?

Not every IDE context consumer (standalone preview routes, test harnesses)
provides a panels controller. Making it optional avoids a hard runtime failure
in those contexts. Callers that know they are inside the full workspace can
safely assert non-null with `ide.getPanels!()`.
