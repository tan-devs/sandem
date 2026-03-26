**[← Home](./README.md) | [← Previous](./04_Implementation_Guide.md)** | [Next: Diagrams & Flows →](./06_Diagrams_and_Flows.md)

---

# Code Examples (2026-03-25)

## createRepoController usage

```ts
import { createRepoController } from '$lib/controllers';

const repo = createRepoController({
	getInitialProjects: () => data.projects,
	isDemo: () => isDemo,
	isGuest: () => isGuest,
	ownerId: () => ownerId,
	convexClient: convexOps
});
```

## projectFolderName helper

```ts
import { projectFolderName } from '$lib/utils/ide/projects.js';
const folder = projectFolderName(project._id, project.name);
```

## liveblocks sync

```ts
import { createLiveblocksEditorSync } from '$lib/controllers';
const editorSync = createLiveblocksEditorSync({
	getWebcontainer: () => repo.getWebcontainer(),
	persistFile: (path, content) =>
		convexClient.mutation(api.filesystem.upsertFile, { path, content }),
	getWorkspaceRoot: () => {
		const p = repo.activeProject;
		return p ? projectFolderName(p._id, p.name) : '';
	}
});
```

---

[← Previous](./04_Implementation_Guide.md) | [Next: Diagrams & Flows →](./06_Diagrams_and_Flows.md) | [Home](./README.md)
