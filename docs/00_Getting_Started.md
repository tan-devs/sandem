**[← Home](./README.md)** | [Next: Architecture Overview →](./01_Architecture_Overview.md)

---

# Getting Started (2026-03-25)

This guide is aligned to the current codebase (routes, controllers, services, and strategy patterns).

## Quick Setup

1. `pnpm install`
2. `cp .env.example .env.local`
3. Fill `.env.local` keys: `PUBLIC_CONVEX_URL`, `CONVEX_DEPLOYMENT`, `PUBLIC_CONVEX_SITE_URL`, `SITE_URL`, `PUBLIC_LIVEBLOCKS_KEY`, `LIVEBLOCKS_SECRET_KEY`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`
4. `pnpm run dev`
5. Access: `http://localhost:5173`

## Routes Layout

- `src/routes/+layout.svelte`: global CSS + Convex client setup
- `src/routes/(app)/+layout.svelte`: app shell + app header, scroll container
- `src/routes/(app)/[repo]/+layout.svelte`: IDE workspace shell (repo controller, runtime, auth)

## Core flow for `/repo` route

- `+layout.server.ts` loads auth state and projects; ensures starter project for first-time user
- `createRepoController` is instantiated with `getInitialProjects`, `ownerId`, and `convexClient`
- `createLiveblocksEditorSync` wires Monaco edits to Convex upsert and WebContainer writes
- `repo.mount()` starts runtime and mounts project folders

## Useful scripts

- `pnpm run dev`
- `pnpm run build`
- `pnpm run check`
- `pnpm run lint`
- `pnpm run format`
- `pnpm run test`
- `pnpm run test:e2e`
