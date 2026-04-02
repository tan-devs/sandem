Now I have the full picture. There are mismatches in three files. Here's each one:

---

**1. `+layout.svelte` — wrong options passed to `createWorkspaceController`**

The layout is passing `getData`, `getSidebar`, and `getExternalWebcontainer` which don't exist in the interface. It's also missing `getInitialProjects`, `getWorkspaceTree`, and `isDemo`:

```ts
// ❌ current
const ctrl = createWorkspaceController({
    getData: () => data,
    isGuest: () => isGuest,
    ownerId: () => ownerId,
    convexClient,
    getSidebar: () => sidebar,
    getProjectsData: () => projectsResponse.data,
    getProjectsError: () => projectsResponse.error,
    getExternalWebcontainer: () => wcSingleton.waitForWebcontainer()
});

// ✅ fix
const ctrl = createWorkspaceController({
    getInitialProjects: () => data.projects,
    getWorkspaceTree: () => data.workspaceTree ?? {},
    isDemo: () => false,
    isGuest: () => isGuest,
    ownerId: () => ownerId ?? '',
    convexClient,
    getProjectsData: () => projectsResponse.data,
    getProjectsError: () => projectsResponse.error
});
```

`getSidebar` and `getExternalWebcontainer` belong in `WorkspaceController.svelte.ts` (the assembly root) not in the service options — per WORKSPACE.md "Panels are NOT composed in createWorkspace". Can you share `WorkspaceController.svelte.ts`? That's where those two need to be wired.

---

**2. `createWorkspace.svelte.ts` — `ownerId` type mismatch**

The interface says `ownerId: () => string` but the layout passes `Id<'users'> | null`. Fix the interface to match reality:

```ts
// ❌ before
ownerId: () => string;

// ✅ after
ownerId: () => string | null;
```

---

**3. `ExplorerFilesSection.svelte` — typo causing a broken import**

```ts
// ❌ line 8 — missing 'r'
import ExplorerContextMenu from './ExploerContextMenu.svelte';

// ✅
import ExplorerContextMenu from './ExplorerContextMenu.svelte';
```

This is why the explorer sidebar is showing the red "WebContainer is not initialized." error instead of the file tree — the component fails to import entirely.