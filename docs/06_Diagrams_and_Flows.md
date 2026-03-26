**[← Home](./README.md) | [← Previous](./05_Code_Examples.md)** | [Next: Progress Tracker →](./07_Progress_Tracker.md)

---

# Diagrams & Flows (2026-03-25)

## Repo startup flow

1. User enters /repo
2. `+layout.server.ts` loads projects and auth state
3. `/routes/(app)/[repo]/+layout.svelte` loads repo controller
4. `repo.mount()` starts WebContainer runtime
5. Viewer sees IDE when `ready`

## Filesystem mount flow

1. Convex projects from DB -> `repo.getWorkspaceProjects()`
2. Each project name (`project.name`) -> slugified folder via `projectFolderName(project._id, project.name)`
3. `createRuntimeManager` mounts folder under WebContainer
4. `createLiveblocksEditorSync` + Explorer controls path open/selection using `/project-folder/...` path semantics

---

[← Previous](./05_Code_Examples.md) | [Next: Progress Tracker →](./07_Progress_Tracker.md) | [Home](./README.md)
