# UPDATES: ide-context import usage (2026-03-28)

The following files currently import from `$lib/context/ide/ide-context.js` (or re-export it):

- `src/lib/services/editor/createActionHandlers.svelte.ts`
- `src/lib/controllers/EditorController.svelte.ts`
- `src/lib/context/ide/ide-context.ts`
- `src/lib/context/ide/index.ts`

> NOTE: `src/lib/context/ide/ide-context.ts` was updated; all listed files should be checked and updated as needed to match the new `IDEContext` contract.
