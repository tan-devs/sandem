Now I can see all the issues clearly. The root cause of "WebContainer is not initialized" is that `getExternalWebcontainer` is being passed in `+layout.svelte` but `WorkspaceControllerOptions` doesn't accept it, so it never gets threaded through to `createWorkspaceRuntime`. Several other mismatches exist too. Here are all the fixes:

---

**`createWorkspace.svelte.ts` — add missing options and thread them through**

```ts
import type { PaneAPI } from 'paneforge';
import type { WebContainer } from '@webcontainer/api';

export interface WorkspaceControllerOptions {
  getData: () => RepoLayoutData;                              // ← replaces getInitialProjects + getWorkspaceTree
  getProjectsData: () => RepoLayoutData['projects'] | undefined;
  getProjectsError: () => unknown;
  isGuest: () => boolean;
  ownerId: () => string | null;                              // ← was string, now nullable
  convexClient: ConvexOperations;
  getSidebar: () => PaneAPI | undefined;                     // ← new
  getExternalWebcontainer: () => Promise<WebContainer>;      // ← new
}
```

Then inside `createWorkspaceController`, derive the fields and thread them through:

```ts
export function createWorkspaceController(options: WorkspaceControllerOptions) {
  const store = createWorkspaceStore();

  const runtime = createWorkspaceRuntime({
    store,
    isDemo: () => false,
    isGuest: options.isGuest,
    ownerId: () => options.ownerId() ?? '',
    getWorkspaceTree: () => options.getData().workspaceTree ?? {},
    convexClient: options.convexClient,
    getExternalWebcontainer: options.getExternalWebcontainer  // ← threaded through
  });

  const hook = useWorkspace({
    store,
    runtime,
    getProjectsData: options.getProjectsData,
    getProjectsError: options.getProjectsError,
    getInitialProjects: () => options.getData().projects,     // ← derived from getData
    isGuest: options.isGuest
  });

  // rest unchanged...
}
```

---

**`+layout.svelte` — fix the controller call to match the updated interface**

```ts
const ctrl = createWorkspaceController({
  getData: () => data,                                         // ✅ already correct
  isGuest: () => isGuest,
  ownerId: () => ownerId,                                      // ✅ now accepts null
  convexClient,
  getSidebar: () => sidebar,
  getProjectsData: () => projectsResponse.data,
  getProjectsError: () => projectsResponse.error,
  getExternalWebcontainer: () => wcSingleton.waitForWebcontainer()  // ✅ now accepted
});
```

No changes needed to `+layout.svelte` itself — it was already passing the right shape. The interface just wasn't accepting it.

---

**`ExplorerFilesSection.svelte` — typo in import**

```ts
// ❌ ExploerContextMenu (missing 'r')
import ExplorerContextMenu from './ExploerContextMenu.svelte';

// ✅
import ExplorerContextMenu from './ExplorerContextMenu.svelte';
```

That's the red error text in the sidebar — it's a broken import, not a runtime issue.

---

The chain once fixed: `+layout.svelte` → `WorkspaceControllerOptions` → `createWorkspaceRuntime` → `createRuntimeManager` → `startRuntime` awaits `waitForWebcontainer()` instead of throwing. The sandbox should boot cleanly after these three files are updated.