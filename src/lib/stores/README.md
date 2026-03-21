# Stores organization

> Last updated: 2026-03-20

Stores are grouped by state domain:

- `activity/` → activity tab and tool selection state
- `editor/` → editor tabs + cursor/status metadata
- `panel/` → pane visibility/layout state

## Import style

- `import { activity } from '$lib/stores/activity/activityStore.svelte.js'`
- `import { editorStore } from '$lib/stores/editor/editorStore.svelte.js'`
- `import { createPanelsState } from '$lib/stores/panel/panelStore.svelte.js'`

Optional barrel:

- `import { editorStore } from '$lib/stores/index.js'`
