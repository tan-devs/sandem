**[← Home](./README.md) | [← Previous](./03_Architecture_Details.md)** | [Next: Code Examples →](./05_Code_Examples.md)

---

# Implementation Guide (2026-03-25)

## Steps to implement current code structure

1. App shell and repo routes:
   - `routes/+layout.svelte`
   - `routes/(app)/+layout.svelte`
   - `routes/(app)/[repo]/+layout.svelte`
2. Auth / projects load:
   - `routes/(app)/[repo]/+layout.server.ts` (currentUser, ensureLiveblocksRoomsForOwner)
   - `src/convex/filesystem.ts` (ensureUserIdentity + seedStarterProjectForOwner on auth user create)
3. Repo controller:
   - `createRepoController` in `src/lib/controllers/RepoController.svelte.ts`
4. File tree in explorer:
   - previously `createFileTreeController`, now use project+file operations in `src/lib/utils/ide/fileTreeOps.ts`
5. Runtime manager:
   - `src/lib/services/runtime/createRepoRuntimeManager.svelte.ts`

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
