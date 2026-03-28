# Update Report: Editor / Terminal / Explorer import patterns (2026-03-28)

## Summary

- Checked 3 components:
  - `src/lib/components/editor/Editor.svelte`
  - `src/lib/components/terminal/Terminal.svelte`
  - `src/lib/components/sidebar/explorer/Explorer.svelte`
- Goal: identify imports using old architecture patterns and log any outdated functions.
- Result: no deprecated import patterns found; current imports align with the new architecture.

## Editor.svelte

Imports and current source mapping (verified by examining each module):

- `requireIDEContext` from `$lib/context/ide` - resolved to `src/lib/context/ide/ide-context.ts`; returns IDE context or throws if missing. Verified correct.
- `createEditorPaneController` from `$lib/controllers` - re-exported from `src/lib/controllers/editor/index.ts`, implemented in `src/lib/controllers/editor/createEditorPaneController.svelte.ts`. Verified correct.
- `Tabs` from `$lib/components/ui/primitives/Tabs.svelte` - UI primitive component. Verified correct.
- `editorStore` from `$lib/stores` - defined in `src/lib/stores/editorStore.svelte.ts`. Verified correct.
- `activity` from `$lib/stores` - defined in `src/lib/stores/activityStore.svelte.ts`. Verified correct.
- `getPanelsContext` from `$lib/stores` - from `src/lib/stores/panelStore.svelte.ts`. Verified correct.
- `collaborationPermissionsStore` from `$lib/stores` - defined in `src/lib/stores/collaborationStore.svelte.ts`. Verified correct.
- `EmptyEditorState`, `EditorBreadcrumb`, `EditorSaveStatus`, `ErrorPanel` UI components are present in the expected locations and have matching interfaces.

No outdated function imports found.

## Terminal.svelte

Imports and current source mapping (verified):

- `createTerminalWorkspaceController`, `createTerminalPanelController`, `createTerminalSessionsController` from `$lib/controllers`:
  - re-exported from `src/lib/controllers/workspace/index.ts`
  - implemented in `src/lib/controllers/workspace/createTerminalWorkspaceController.svelte.ts`, `createTerminalPanelController.svelte.ts`, and `createTerminalSessionsController.svelte.ts`; controller pattern confirmed.
- `requireIDEContext` from `$lib/context/ide`:
  - as in Editor, `src/lib/context/ide/ide-context.ts`.
- `createShellProcess` from `$lib/services`:
  - implemented in `src/lib/services/runtime/createShellProcess.svelte.ts`.
- `appendTerminalAudit`, `collaborationPermissionsStore` from `$lib/stores`:
  - `appendTerminalAudit` comes from `src/lib/stores/collaborationStore.svelte.ts`;
  - `collaborationPermissionsStore` also in `src/lib/stores/collaborationStore.svelte.ts`.
- `getPanelsContext` from `$lib/stores`:
  - from `src/lib/stores/panelStore.svelte.ts`.
- `TerminalPanelHeader`, `TerminalToolbar`, `TerminalViewport` UI components:
  - exist in `src/lib/components/terminal/` and use the same controller API.

No outdated function imports found.

## Explorer.svelte

Imports and current source mapping (verified):

- `createFileTree` from `$lib/controllers`:
  - re-exported from `src/lib/controllers/index.ts` → `src/lib/controllers/FileTreeController.svelte.ts`.
- `projectFilesSync` from `$lib/services`:
  - implemented in `src/lib/services/explorer/ProjectService.svelte.ts`.
- `createExplorerStateController` from `$lib/controllers/explorer`:
  - implemented in `src/lib/controllers/explorer/createExplorerStateController.svelte.ts`.
- `handleCreateFile`, `handleCreateFolder`, `handleRenameNode`, `handleDeleteNode`, `handleRefreshTree`, `handleExpandAll`, `handleCollapseAll`, `handleRefreshAndExpandAll` from `$lib/controllers/explorer/createExplorerActionHandlers.svelte`:
  - pure action handlers implemented in `src/lib/controllers/explorer/createExplorerActionHandlers.svelte.ts`.
- `findNodeByPath` from `$lib/utils/file-tree.js`:
  - from `src/lib/utils/file-tree.ts`.
- `filterNodesByQuery`, `getPathsToExpand` from `$lib/utils/ide/explorerTreeOps.js`:
  - implemented in `src/lib/utils/ide/explorerTreeOps.ts`.
- `projectFolderName` from `$lib/utils/projects.js`:
  - implemented in `src/lib/utils/projects.ts`.

No outdated function imports found.

## Action item

## Action item

- Maintain this doc when subsequent refactors introduce outdated patterns.
- If old imports are found in the future, add explicit `function` + `file` entries under each component section.
