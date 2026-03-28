**[← Home](./README.md) | [← Previous](./03_Architecture_Details.md)** | [Next: Code Examples →](./05_Code_Examples.md)

---

# Implementation Guide (2026-03-25)

## Steps to implement current code structure

1. App shell and repo routes:
   - `routes/+layout.svelte`
   - `routes/(app)/+layout.svelte`
   - `routes/(app)/[repo]/+layout.svelte`
2. Auth / projects load:
   - `routes/(app)/[repo]/+layout.server.ts` (currentUser, loadRepoLayoutAuthenticated/loadRepoLayoutGuest)
   - `src/lib/controllers/repo/RepoLoaderController.svelte.ts` (workspace project + identity resolution)
   - `src/convex/functions/projects.ts` and `src/convex/functions/filesystem.ts` (user/project CRUD + node persistence)
3. Repo controller:
   - `createRepoController` in `src/lib/controllers/repo/RepoProjectsController.svelte.ts`
4. File tree in explorer:
   - built from `src/lib/utils/file-tree.ts` and runtime FS reads, not a separate `createFileTreeController` abstraction
5. Runtime manager:
   - `src/lib/services/runtime/createRuntimeManager.svelte.ts`

## Cairo Monaco SSR fix

- `createCollaboration.svelte` now uses dynamic `await import('y-monaco')` so the `monaco-editor/esm` tree (including `.css` imports) does not run during SSR.
- `createRuntime.svelte` now guards on `typeof window === 'undefined'` and only boots collaborative models in browser.

## Practical wiring snippet

```svelte
// in routes/(app)/[repo]/+layout.svelte
import { createRepoController, createLiveblocksEditorSync } from '$lib/controllers';
import { setIDEContext } from '$lib/context';

const repo = createRepoController({
  getInitialProjects: () => data.projects,
  isDemo: () => isDemo,
  isGuest: () => isGuest,
  ownerId: () => ownerId,
  convexClient: convexOps
});

setIDEContext({
  getWebcontainer: repo.getWebcontainer,
  getProject: repo.getProjectForPath,
  getEntryPath: repo.getEntryPath,
  // ...
});
```

---

[← Previous](./03_Architecture_Details.md) | [Next: Code Examples →](./05_Code_Examples.md) | [Home](./README.md)
