# UI components organization

> Last updated: 2026-03-20

UI components are grouped by role:

- `primitives/` → generic building blocks (`Button`, `Card`, `Tabs`, `Form`, ...)
- `inputs/` → input/select style controls (`SearchBar`, `DropDown`)
- `editor/` → editor-specific display helpers (`EditorBreadcrumb`, `EditorSaveStatus`, `EmptyEditorState`, `FileTree`)
- `navigation/` → app/header/menu navigation pieces
- `workspace/` → workspace controls and layout helpers (`RepoPaneLayout`, `PanelControls`, `WindowControls`, `CommandPalette`, `PaneResizer`)
- `layout/` → page section/layout wrappers (`PageSection`)
- `theme/` → theme controls (`ModeToggle`, `ThemeSwitcher`)

## Import style

Prefer feature folders:

- `import Button from '$lib/components/ui/primitives/Button.svelte'`
- `import SearchBar from '$lib/components/ui/inputs/SearchBar.svelte'`
- `import AppHeader from '$lib/components/ui/navigation/AppHeader.svelte'`
