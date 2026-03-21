# Hooks organization

> Last updated: 2026-03-20

Hooks are grouped by feature area with small barrel exports:

- `activity/` → activity panel behavior (`explorer`, `search`, `git`, `debug` controls)
- `editor/` → editor runtime and persistence (`autosave`, `status`, `shortcuts`, `writer`)
- `explorer/` → file tree and file-sync behavior
- `runtime/` → WebContainer runtime hooks (`preview`, `shell`, project mounting)

## Import style

Prefer grouped imports:

- `import { createEditorRuntime } from '$lib/hooks/editor/index.js'`
- `import { createExplorerActivity } from '$lib/hooks/explorer/index.js'`
- `import { createGitActivity } from '$lib/hooks/activity/index.js'`
- `import { createShellProcess } from '$lib/hooks/runtime/index.js'`

Or import from the root barrel when appropriate:

- `import { createPreview } from '$lib/hooks/index.js'`

## Notes

- Existing `create*.svelte.ts` hook files remain the source of truth.
- Barrels are thin re-exports only, to keep refactors low-risk and imports consistent.
