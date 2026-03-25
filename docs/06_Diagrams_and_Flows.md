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
2. Each project name -> folder path via projectFolderName
3. `createRepoRuntimeManager` mounts folder under WebContainer
4. Editor opens files by path from repo and file-tree

---

[← Previous](./05_Code_Examples.md) | [Next: Progress Tracker →](./07_Progress_Tracker.md) | [Home](./README.md)
