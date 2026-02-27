# ��� Comprehensive Bug Report - Active Issues (Refreshed)

**Generated**: Fresh analysis of current workspace files  
**Scope**: Routes, server endpoints, utilities, components, hooks, and Convex backend

---

## ��� Table of Contents

1. [Projects Routes (`/projects` and `/projects/[project]`)](#projects-routes)
2. [Server Endpoints (`/api`)](#server-endpoints)
3. [Root Layout (`_layout.svelte`)](#root-layout)
4. [Utility Files & Configurations](#utility-files--configurations)
5. [Convex Backend (Database & Mutations)](#convex-backend)
6. [IDE Components & Hooks](#ide-components--hooks)
7. [Summary & Priority Guide](#summary--priority-guide)

---

## Projects Routes

> **Note:** The dynamic segment folder under `routes/projects` is named `[project]`. Some comments still reference `slug`, which is misleading.

### `/projects` Route - Project List Page

This page is currently functioning correctly:

- New project creation populates `setIDEContext` with proper getters.
- Delete handler uses correct guard (`if (!USER.data?._id || deleting)`).
- Unused imports have been removed.

**Status**: ✅ No active issues remain in this file.

---

### `/projects/[project]` Route - Project Editor Page

#### ��� MEDIUM: Dynamic parameter naming confusion

Several comments (including in `+layout.server.ts`) still refer to
`params.slug` even though the segment is `[project]`. This causes
developers to copy code incorrectly.

**Status**: OPEN

---

#### ��� MINOR: Stray `<aside>` placeholder in layout

`src/routes/projects/[project]/+layout.svelte` contains an irrelevant
`<aside>aside</aside>` at the bottom. It should be removed to clean up
markup.

**Status**: OPEN

---

#### ��� MINOR: Editor page passes unused props / odd naming

`src/routes/projects/[project]/+page.svelte` defines and forwards `ID`
and `DATA` constants to components even though those components ignore
props and read from context. The uppercase naming is non‑idiomatic and
triggers Svelte warnings.

**Status**: OPEN

---

## Server Endpoints

### `/api/liveblocks-auth` Route

#### ��� MEDIUM: Missing User ID validation

Though the code checks `if (!user)` it does not ensure `user._id` is a
nonempty string before calling `liveblocks.prepareSession`. A null/undefined
ID will crash the library.

**Status**: OPEN

---

#### ��� MEDIUM: Questionable read‑only fallback when project not found

When `openCollab` returns `null` the handler currently grants
`session.allow(room, ['room:read']);`. It’s unclear if read‑only access
should be permitted at all; most callers expect a 403 instead.

**Status**: OPEN

---

## Root Layout

### `+layout.svelte` - Root Application Layout

#### ��� HIGH: No authentication state or actions

The layout still renders a hardcoded avatar and inert sign‑in/out
buttons. It does not call `let { data } = $props();` or use `useAuth()`.
Users cannot see their details or sign out.

**Status**: OPEN

---

#### ��� MEDIUM: Hardcoded test/navigation links

Dev/test pages remain in the `links` array (`/dev`, `/test/*`). These
should be conditionally included only in development.

**Status**: OPEN

---

## Development & Test Routes

### Global Debug Logging

The only remaining console log is in `src/routes/dev/+layout.server.ts`:
`console.log('authState', authState);`.

**Status**: OPEN

---

## Utility Files & Configurations

### `liveblocks.config.ts` - Liveblocks Client Setup

#### ��� LOW: Improve error logging

The auth helper still throws a generic message when the fetch fails.
Capturing status/text would aid troubleshooting.

**Status**: OPEN

---

### `auth-client.ts` - Better Auth Client Setup

#### ��� HIGH: Hardcoded baseURL

Still uses `'http://localhost:5173'`. A dynamic configuration is required
for non‑local environments.

**Status**: OPEN

---

### Miscellaneous

- **Unused helper**: `getOrCreateUserWorkspace` in `convex/projects.ts` has
  no callers. Evaluate if it’s necessary.

---

## IDE Components & Hooks

All IDE components (`Editor`, `Terminal`, `Preview`) and associated
hooks are operating correctly. No active issues found.

---

## Convex Backend

Database schema and functions are sound; no backend issues detected.

---

## Summary & Priority Guide

### ��� CRITICAL Issues

None remain. The crucial route objects and context interactions have
been fixed as of the latest code.

### ��� HIGH Issues

1. **Root layout lacks auth integration** – user cannot sign in/out.
2. **Hardcoded localhost in auth-client.ts** – breaks production.
3. **Test links in navigation** – should be dev‑only.

### ��� MEDIUM Issues

1. **Dynamic parameter naming confusion** in project route comments.
2. **Stray `<aside>` in project layout**.
3. **Unused props/odd naming in project page**.
4. **Liveblocks auth missing ID validation**.
5. **Questionable read-only fallback** in liveblocks-auth.

### ��� LOW Issues

1. **Improve logging in liveblocks.config.ts**.
2. **Console.log in `/dev/+layout.server.ts`**.
3. **Potentially unused `getOrCreateUserWorkspace`**.

---

## Files to Create/Modify Checklist

**Modify**:

- [ ] `src/routes/projects/[project]/+layout.svelte` – remove `<aside>`
      and clean comments.
- [ ] `src/routes/projects/[project]/+page.svelte` – drop `ID`/`DATA`
      constants/props.
- [ ] `src/routes/+layout.svelte` – wire up auth state/actions; prune nav.
- [ ] `src_routes/dev/+layout.server.ts` – remove debug log (or guard it).
- [ ] `src/routes/api/liveblocks-auth/+server.ts` – validate `user._id`.
      Decide on policy for missing project.
- [ ] `src/lib/context/auth-client.ts` – compute `baseURL` dynamically.
- [ ] `src/lib/liveblocks.config.ts` – enrich error messages.

**Optional**:

- [ ] Remove or document `getOrCreateUserWorkspace` in Convex.

---

> _This report reflects the current code base after reading all relevant
> source files; earlier defects have been fixed. Continue iterating on
> the remaining issues to reach a deployable state._
