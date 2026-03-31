# Auth — Architecture & Data Flow

> **Philosophy: Two-Table Identity**
>
> Better Auth owns the auth layer (sessions, JWTs, OAuth, JWKS rotation) through a Convex component with its own internal tables. Your app owns identity through a separate `users` table in `schema.ts`. The bridge between them is `tokenIdentifier` — a string issued in every JWT that both layers can key on. Guests are first-class: they get a `users` row too, keyed on a stable cookie they carry client-side.

---

## Layer Map

```
convex/
  convex.config.ts                ← registers the Better Auth Convex component

convex/config/
  auth.config.ts                  ← Convex JWT provider config (tells Convex how to verify JWTs)

convex/functions/
  auth.ts                         ← authComponent (component client) + createAuth factory + getCurrentUser
  users.ts                        ← ensureUserIdentity mutation (upsert for auth + guest paths)
  http.ts                         ← registers Better Auth HTTP routes onto Convex's httpRouter

src/lib/sveltekit/
  index.ts                        ← getToken, getAuthState, createConvexHttpClient, createSvelteKitHandler

src/routes/api/auth/[...path]/
  +server.ts                      ← SvelteKit proxy — forwards auth requests to Convex HTTP endpoint

src/routes/
  +layout.server.ts               ← SSR bootstrap: getAuthState (cookie check) + getCurrentUser (HTTP client)
```

---

## System Hierarchy (runtime call tree)

```
Browser
└── POST /api/auth/sign-in/email  (or /sign-up, /callback/github, etc.)
      └── +server.ts (createSvelteKitHandler)
            └── proxy → PUBLIC_CONVEX_SITE_URL/api/auth/...
                  └── Convex HTTP router (http.ts)
                        └── authComponent.registerRoutes(http, createAuth)
                              └── Better Auth handles the request
                                    ├── writes to component-internal tables (user, session, account, jwks...)
                                    └── sets JWT cookie in response

Page load (SSR)
└── +layout.server.ts
      ├── getAuthState(createAuth, cookies)   ← cookie presence check only, no Convex round-trip
      └── client.query(api.auth.getCurrentUser)
            └── ctx.auth.getUserIdentity() → tokenIdentifier
                  └── query users table by_tokenIdentifier

Client hydration
└── ensureUserIdentity({ guestId? })          ← called from layout on every page load
      ├── Authenticated path:
      │     ctx.auth.getUserIdentity() → tokenIdentifier
      │     upsert users row (insert on first seen, patch lastSeen on repeat)
      │     seedStarterProjectForOwner() on first insert
      │     return { convexUserId, isGuest: false }
      └── Guest path:
            guestId cookie → upsert users row
            return { convexUserId, isGuest: true }
```

---

## Layer-by-Layer

### `convex/convex.config.ts`

Registers the `@convex-dev/better-auth` Convex component. This is what provisions Better Auth's internal tables (`user`, `session`, `account`, `jwks`, `verification`, `rateLimit`, etc.) into your Convex deployment under the `betterAuth` component namespace. Must be present and pushed before any auth calls work. The `*` indicator on the Convex dashboard means the component is registered but unresolved — fix by running `npx convex dev`.

---

### `convex/config/auth.config.ts`

Tells Convex's built-in JWT middleware how to verify tokens issued by Better Auth. Uses `getAuthConfigProvider()` from `@convex-dev/better-auth/auth-config` which wires up a `customJwt` provider pointing at Better Auth's JWKS endpoint. This file must be resolvable from the functions root — it's what Convex reads when `ctx.auth.getUserIdentity()` is called inside any query or mutation.

---

### `convex/functions/auth.ts`

**Exports:** `authComponent`, `createAuth`, `getCurrentUser`

| Export           | Purpose                                                                                                                                         |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `authComponent`  | Component client — provides `adapter(ctx)` for Better Auth's database binding and `registerRoutes()` for HTTP wiring                            |
| `createAuth`     | Factory called per HTTP request; constructs the full Better Auth instance with email/password, GitHub OAuth, and the required `convex()` plugin |
| `getCurrentUser` | Query — resolves the current session to a row in **your** `users` table via `tokenIdentifier`. Returns `null` for guests/unauthenticated.       |

`getCurrentUser` deliberately queries your `users` table, not the Better Auth component's internal `user` table. This gives the rest of the app one consistent user shape that includes `isGuest`, `username`, and Convex `_id` — the same ID used as `ownerId` on projects.

---

### `convex/functions/users.ts`

**Exports:** `ensureUserIdentity`

The mutation that bootstraps your `users` table row. Called from `+layout.server.ts` / layout on every page load so the row always exists before any ownership guard runs.

**Authenticated path:**

1. `ctx.auth.getUserIdentity()` → `tokenIdentifier`
2. Query `users` by `by_tokenIdentifier` index
3. If found: `patch({ lastSeen: now })` → return `{ convexUserId, isGuest: false }`
4. If not found: `insert` new row with `name`, `email` mirrored from JWT → call `seedStarterProjectForOwner()` → return `{ convexUserId, isGuest: false }`

**Guest path:**

1. Use `args.guestId` cookie value (or mint a new UUID as fallback)
2. Same upsert pattern against the same `users` table
3. Return `{ convexUserId, isGuest: true }`

> **Critical:** Every write mutation in `projects.ts` and `nodes.ts` calls `ctx.auth.getUserIdentity()` then looks up your `users` table to enforce ownership. If `ensureUserIdentity` hasn't run yet, they throw `"Authenticated user not found"`. The layout load order guarantees this runs first.

---

### `convex/functions/http.ts`

Registers all Better Auth HTTP routes (sign-in, sign-up, OAuth callbacks, JWKS, token endpoints) onto Convex's `httpRouter`. One line: `authComponent.registerRoutes(http, createAuth)`. These routes live at `/api/auth/*` on your Convex site URL.

---

### `src/lib/sveltekit/index.ts`

**Exports:** `getToken`, `getAuthState`, `createConvexHttpClient`, `createSvelteKitHandler`

| Export                   | Purpose                                                                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getToken`               | Reads the JWT cookie set by Better Auth. Handles both `__Secure-` prefixed and plain cookie names, with warnings on mismatch.                                 |
| `getAuthState`           | Checks cookie presence only — no Convex round-trip. Returns `{ isAuthenticated: boolean }` for SSR hydration hint. Does not validate the JWT.                 |
| `createConvexHttpClient` | Constructs a `ConvexHttpClient` with optional token auth. Used in `+layout.server.ts` to query Convex from the server.                                        |
| `createSvelteKitHandler` | Returns `{ GET, POST }` handlers that proxy requests to `PUBLIC_CONVEX_SITE_URL`. Has a 10-second timeout and manual redirect handling. Used by `+server.ts`. |

---

### `src/routes/api/auth/[...path]/+server.ts`

The SvelteKit catch-all that proxies every Better Auth request to the Convex HTTP endpoint. No logic here — just `createSvelteKitHandler()`. All auth routes (`/api/auth/sign-in/email`, `/api/auth/callback/github`, `/api/auth/get-session`, etc.) pass through here on the way to Convex.

---

### `src/routes/+layout.server.ts`

**The SSR bootstrap.** Runs on every page load.

```
1. createConvexHttpClient({ token: locals.token })
2. getAuthState(createAuth, cookies)        → { isAuthenticated }  (cookie check, fast)
3. client.query(api.auth.getCurrentUser)    → your users table row (or null)
4. return { currentUser, authState }        → available in all layouts/pages as load data
```

If `getCurrentUser` throws (e.g. row doesn't exist yet on first visit), it catches and returns `null` rather than failing the page load.

---

## Data Flow

```
Better Auth component (Convex-internal)       Your app schema
─────────────────────────────────────         ──────────────────────────────
user, session, account, jwks,                 users table:
verification, rateLimit tables                  _id         ← used as ownerId FK
                    │                           tokenIdentifier  ← bridge field
                    │ JWT issued on sign-in      username, name, email
                    │ contains tokenIdentifier   isGuest
                    ▼                            createdAt, lastSeen
            ctx.auth.getUserIdentity()
                    │
                    │ .tokenIdentifier
                    ▼
            users table (by_tokenIdentifier index)
                    │
                    ├── getCurrentUser query → frontend "who am I"
                    ├── ensureUserIdentity mutation → upsert on page load
                    └── assertProjectAccess / assertProjectWriteAccess → ownership guards
```

---

## Two-Table Reference

|                               | Better Auth component tables              | Your `users` table                            |
| ----------------------------- | ----------------------------------------- | --------------------------------------------- |
| **Who writes it**             | Better Auth internals                     | `ensureUserIdentity` mutation                 |
| **Primary key**               | Better Auth string `id`                   | Convex `_id`                                  |
| **Used for**                  | Sessions, OAuth, JWKS, rate limits        | Project ownership, guest identity, `lastSeen` |
| **Queried from frontend via** | `authComponent.safeGetAuthUser()` (avoid) | `api.auth.getCurrentUser`                     |
| **Bridge field**              | Issues `tokenIdentifier` in JWT           | Stores `tokenIdentifier` as lookup key        |

Never expose the Better Auth component's `user` table directly to the frontend — it has no `isGuest`, no `_id` usable as `ownerId`, and its shape can change across Better Auth versions. `getCurrentUser` always returns from your table.

---

## Key Design Decisions

### Why two user tables?

Better Auth needs its own tables to manage sessions, OAuth state, JWKS rotation, and rate limiting. Your app needs a `users` table with a stable Convex `_id` to use as a foreign key on `projects`, and to support guests who have no Better Auth session at all. The two tables solve different problems and shouldn't be merged.

### Why does `ensureUserIdentity` run on every page load?

Because the Convex JWT is validated lazily — Better Auth can issue a valid JWT without your `users` row existing yet (e.g. on first sign-in). Running the upsert on every load is cheap (it's an index lookup + conditional patch) and guarantees the row exists before any mutation runs.

### Why does `getAuthState` not validate the JWT?

It's intentionally a hint only — it avoids a Convex round-trip during SSR just to prevent a loading flash. The real validation happens when the client connects and Convex verifies the JWT on the WebSocket. False positives (cookie present but expired) self-correct on hydration.

### Why is `createSvelteKitHandler` a proxy rather than calling Better Auth directly?

Better Auth runs inside Convex's serverless environment where it has access to the database adapter. It can't run in SvelteKit's server context because it needs `ctx` from Convex. The proxy pattern keeps the auth logic entirely in Convex where it belongs.
