**[← Home](./README.md) | [← Previous](./02_System_Architecture.md)** | [Next: Implementation Guide →](./04_Implementation_Guide.md)

---

# Architecture Details (2026-03-25)

## Key source files

- `src/routes/(app)/[repo]/+layout.svelte` (repo shell orchestration)
- `src/routes/(app)/[repo]/+layout.server.ts` (authenticated/guest repo load path)
- `src/lib/controllers/repo/RepoLayoutController.svelte.ts` (setupRepoLayout + syncRepoProjects)
- `src/lib/controllers/repo/RepoProjectsController.svelte.ts` (`createRepoController` implementation)
- `src/lib/services/runtime/createRuntimeManager.svelte.ts` (WebContainer runtime lifecycle)
- `src/lib/utils/projects.ts` (project folder slug name, URL helpers)
- `src/lib/controllers/LiveblocksSyncController.svelte.ts` (editor collaboration sync)

## Data models

See `src/convex/projects.ts` and `src/convex/schema.ts` for Convex types

## Lifecycle

1. `src/routes/(app)/[repo]/+layout.server.ts` does auth + first visit starter project
2. client side `+layout.svelte` sets up `createRepoController` + `createLiveblocksEditorSync`
3. `repo.mount()` starts WebContainer + file mount
4. `onMount` cleanup stops runtime and destroys editor sync

---

[← Previous](./02_System_Architecture.md) | [Next: Implementation Guide →](./04_Implementation_Guide.md) | [Home](./README.md)
