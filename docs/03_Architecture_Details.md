**[← Home](./README.md) | [← Previous](./02_System_Architecture.md)** | [Next: Implementation Guide →](./04_Implementation_Guide.md)

---

# Architecture Details (2026-03-25)

## Key source files

- `src/lib/controllers/RepoController.svelte.ts`
- `src/lib/services/runtime/createRuntimeManager.svelte.ts`
- `src/lib/services/runtime/createRepoProjectManager.svelte.ts`
- `src/lib/utils/ide/projects.ts`
- `src/lib/controllers/LiveblocksSyncController.svelte.ts`

## Data models

See `src/convex/projects.ts` and `src/convex/schema.ts` for Convex types

## Lifecycle

1. `src/routes/(app)/[repo]/+layout.server.ts` does auth + first visit starter project
2. client side `+layout.svelte` sets up `createRepoController` + `createLiveblocksEditorSync`
3. `repo.mount()` starts WebContainer + file mount
4. `onMount` cleanup stops runtime and destroys editor sync

---

[← Previous](./02_System_Architecture.md) | [Next: Implementation Guide →](./04_Implementation_Guide.md) | [Home](./README.md)
