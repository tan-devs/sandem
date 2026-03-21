# Maintenance note (2026-03-21)

- Script verification pass completed and docs updated.

# Utils organization

> Last updated: 2026-03-20

Utilities are grouped by scope:

- `project/` → project/file-system/template helpers (`filesystem`, `template`)
- `editor/` → editor/runtime language helpers (`language`)

## Import style

- `import { projectFilesToTree } from '$lib/utils/project/filesystem.js'`
- `import { VITE_REACT_TEMPLATE } from '$lib/utils/project/template.js'`
- `import { getLanguage } from '$lib/utils/editor/language.js'`

Optional barrel:

- `import { getLanguage } from '$lib/utils/index.js'`
