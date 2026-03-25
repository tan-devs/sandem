**[← Home](./README.md) | [← Previous](./01_Architecture_Overview.md)** | [Next: Architecture Details →](./03_Architecture_Details.md)

---

# System Architecture (2026-03-25)

## High-level data flows

- UI (Explorer, editor, terminal) -> Repo controller actions (createProjectCard, selectProject, etc.)
- Repo controller -> Convex client (mutations/queries)
- Convex -> project list, active project selection
- WebContainer -> project file mount via `createRepoRuntimeManager`
- Liveblocks changes in editor -> WebContainer write -> Convex upsert

## Example flow: open a repo

1. `+layout.server.ts` loads currentUser & projects
2. `+layout.svelte` sets up `createRepoController`
3. `repo.syncProjects(data.projects)` hydrates local state
4. `repo.mount()` starts runtime and mounts files
5. UI components read from context via `setIDEContext`
6. `editorSync` begins listening to edits and dispatches db writes

## Example flow: project selection

- `repo.selectProject(projectId)` updates `activeProjectId`
- `createRepoRuntimeManager` reflects next mount path
- file tree and editor path calculations use `projectFolderName(project._id, project.title)`

---

[← Previous](./01_Architecture_Overview.md) | [Next: Architecture Details →](./03_Architecture_Details.md) | [Home](./README.md)
