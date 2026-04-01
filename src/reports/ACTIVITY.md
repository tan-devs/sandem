# Activity — Architecture & Data Flow

> One `$state` store, two pure services, composed via a hook and exposed through a controller. Components never touch the store directly.

---

## Layer Map

```
stores/activity/activity.store.svelte.ts      ← $state singleton (activeTab) + ACTIVITY_TABS + IDEPanels
services/activity/
  createActivityTabService.svelte.ts          ← selectTab / toggleSecondaryPanel (no state, no DOM)
  createActivityKeyboardService.svelte.ts     ← global keydown registration + teardown
hooks/useActivity.svelte.ts                   ← composes both services; only file that imports activityStore
controllers/ActivityBarController.svelte.ts   ← thin adapter: wraps hook, exposes mount()
components/sidebar/activities/
  ActivityBar.svelte                          ← creates controller, mounts keyboard in onMount
  ActivityPanel.svelte                        ← stateless layout shell (title + actions + body)
routes/(app)/[repo]/+layout.svelte            ← injection point: <ActivityBar getPanels={() => ctrl.panels} />
```

---

## Runtime Call Tree

```
+layout.svelte
└── <ActivityBar getPanels={() => ctrl.panels} />
      └── createActivityBarController({ getPanels: () => getPanels() })
            └── useActivity({ getPanels })
                  ├── createActivityTabService({ getActiveTab, setActiveTab, getPanels })
                  │     → selectTab(id) / toggleSecondaryPanel()
                  └── createActivityKeyboardService({ tabs: ACTIVITY_TABS, onSelect: selectTab })
                        → mount() → cleanup fn

ActivityBar onMount
└── ctrl.mount() → window.addEventListener('keydown', …) → selectTab → writes store + panels.leftPane
    component teardown → window.removeEventListener
```

---

## Store (`activity.store.svelte.ts`)

| Export          | Shape                                                  | Notes                                     |
| --------------- | ------------------------------------------------------ | ----------------------------------------- |
| `TabId`         | `'explorer' \| 'search' \| 'git' \| 'run'`             | All valid tab identifiers                 |
| `ActivityTab`   | `{ id, icon, label, shortcutLetter, shortcutNumber }`  | Drives rendering and shortcut maps        |
| `IDEPanels`     | `{ leftPane: boolean; rightPane: boolean \| unknown }` | Minimal panel shape — injected at runtime |
| `ACTIVITY_TABS` | `ActivityTab[]`                                        | Single source for tab order + shortcuts   |
| `activityStore` | `$state({ activeTab: TabId })`                         | Only mutable state in the system          |

---

## Services

### `createActivityTabService`

Deps: `getActiveTab`, `setActiveTab` (store accessors), `getPanels` (injected accessor).

- `selectTab(id)` — re-clicking the active tab toggles `leftPane`; otherwise sets active tab and opens `leftPane`.
- `toggleSecondaryPanel()` — guards `typeof rightPane === 'boolean'` then flips it.

### `createActivityKeyboardService`

Deps: `tabs` (ACTIVITY_TABS), `onSelect` (tabService.selectTab).

Shortcut maps are built from `ActivityTab.shortcutLetter/shortcutNumber` at construction — no hardcoded strings elsewhere.

| Shortcut               | Tab                           |
| ---------------------- | ----------------------------- |
| Ctrl/Cmd+Shift+E/F/G/D | explorer / search / git / run |
| Alt+1/2/3/4            | explorer / search / git / run |

Suppressed when focus is in `INPUT`, `TEXTAREA`, or `contentEditable`. `mount()` returns the cleanup function.

---

## Components

### `ActivityBar.svelte`

**Props:** `getPanels: () => IDEPanels | undefined`

**Critical:** pass as `{ getPanels: () => getPanels() }` to the controller — the extra closure prevents Svelte from capturing only the initial prop value (`svelte/state_referenced_locally`).

Never imports the store, services, or hook directly.

### `ActivityPanel.svelte`

Stateless shell. Props: `title`, `children` (snippet), `actionButtons?: ActionButton[]`, `actions?: Snippet`. `actions` takes precedence over `actionButtons` if both are provided.

---

## Key Design Decisions

**Panel state lives in the workspace, not the store.** `leftPane`/`rightPane` are shared with resize and persistence logic. Injecting `getPanels()` avoids circular deps and keeps activity decoupled from workspace internals.

**`activityStore` imported only in `useActivity`.** One import site means one place to update if the store shape changes.

**Services receive getter/setter functions, not the store object.** Makes services testable without Svelte and prevents accidental direct store access.
