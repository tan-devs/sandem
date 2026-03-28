**[← Home](./README.md) | [← Previous](./00_Getting_Started.md)** | [Next: System Architecture →](./02_System_Architecture.md)

---

# Architecture Overview (2026-03-25)

## Three-layer shell (SvelteKit)

1. Root layout (`src/routes/+layout.svelte`)
2. App shell (`src/routes/(app)/+layout.svelte`)
3. Repo workspace (`src/routes/(app)/[repo]/+layout.svelte`)

## Core controllers

- `createRepoController` (source of truth for projects/workspace)
- `createRuntimeManager` (WebContainer lifecycle, mount orchestration, and status; from `src/lib/services/runtime/createRuntimeManager.svelte.ts`)
- `createRepoProjectManager` (project CRUD and active project state; now part of `src/lib/controllers/repo/RepoProjectsController.svelte.ts`)

## Sync and persistence

- At auth user creation: `seedStarterProjectForOwner` / `ensureStarterProjectForOwner`
- `useQuery(api.projects.getAllProjects)` live subscription
- Liveblocks → WebContainer writes via `createLiveblocksEditorSync`
- Optional Convex mutations drive persistence

## Current data model (convex)

- Projects: `_id, ownerId, name, isPublic, room, entry, createdAt, updatedAt`
- Nodes table: `projectId, path, name, type, content, parentId, createdAt, updatedAt`

---

[← Previous](./00_Getting_Started.md) | [Next: System Architecture →](./02_System_Architecture.md) | [Home](./README.md)
