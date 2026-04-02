# Auth System

> **Philosophy: Two-Table Identity.**
> Better Auth owns sessions/JWTs via a Convex component. Your app owns identity
> via a separate `users` table. The bridge is `tokenIdentifier`. Guests are
> first-class — they get a `users` row keyed on a stable cookie.

---

## Layer Map

```
convex/
  convex.config.ts               ← registers the Better Auth Convex component
  config/auth.config.ts          ← Convex JWT provider config
  functions/
    auth.ts                      ← authComponent + createAuth + getCurrentUser
    users.ts                     ← ensureUserIdentity mutation
    http.ts                      ← registers Better Auth HTTP routes

src/lib/sveltekit/
  index.ts                       ← getToken, getAuthState, createConvexHttpClient, createSvelteKitHandler

src/routes/
  (app)/+layout.server.ts        ← SSR: getAuthState + getCurrentUser → AppLayoutData
  (app)/+layout.svelte           ← createSvelteAuthClient (auth available to all children)
  api/auth/[...path]/+server.ts  ← SvelteKit proxy → Convex HTTP
```

---

## Runtime Call Tree

```
Browser sign-in
└── POST /api/auth/sign-in/email
      └── +server.ts → proxy → Convex HTTP → Better Auth
            ├── writes to component-internal tables
            └── sets JWT cookie

Page load (SSR) — any (app) route
└── (app)/+layout.server.ts
      ├── getAuthState(createAuth, cookies)     ← cookie presence check only
      └── client.query(api.auth.getCurrentUser) ← users table via tokenIdentifier

Client mount
└── (app)/+layout.svelte
      └── createSvelteAuthClient({ getServerState: () => data.authState })
            ← seeds client session from SSR hint, no round-trip
            ← useAuth() is now available in all (home) and [repo] children

[repo] load
└── loadWorkspace → ensureUserIdentity({ guestId? })
      ├── Authenticated: upsert users row by tokenIdentifier
      └── Guest: upsert users row by guestId cookie
```

---

## Key Exports

### `convex/functions/auth.ts`

| Export           | Purpose                                                                                      |
| ---------------- | -------------------------------------------------------------------------------------------- |
| `authComponent`  | Component client — database adapter + HTTP route registration                                |
| `createAuth`     | Factory per HTTP request; constructs Better Auth with email, GitHub, convex()                |
| `getCurrentUser` | Query — resolves session → `users` table row via `tokenIdentifier`. Returns null for guests. |

### `src/lib/sveltekit/index.ts`

| Export                   | Purpose                                                            |
| ------------------------ | ------------------------------------------------------------------ |
| `getToken`               | Reads JWT cookie (handles `__Secure-` prefix)                      |
| `getAuthState`           | Cookie presence check only — no Convex round-trip                  |
| `createConvexHttpClient` | `ConvexHttpClient` with optional token — used in server loads      |
| `createSvelteKitHandler` | `{ GET, POST }` proxy to `PUBLIC_CONVEX_SITE_URL` with 10s timeout |

---

## Data Flow

```
Better Auth component tables          Your app schema (users table)
──────────────────────────            ─────────────────────────────
user, session, account, jwks...         _id           ← ownerId FK on projects
          │                             tokenIdentifier
          │ JWT → tokenIdentifier        username, name, email
          ▼                              isGuest, createdAt, lastSeen
  ctx.auth.getUserIdentity()
          │
          ▼ by_tokenIdentifier index
     users table
          ├── getCurrentUser      → frontend identity
          ├── ensureUserIdentity  → upsert on page load
          └── assertProjectAccess → ownership guards
```

---

## Design Decisions

**Why two user tables?** Better Auth needs its own tables for sessions, OAuth, and JWKS. Your app needs a stable Convex `_id` as a foreign key and guest support — neither of which Better Auth provides.

**Why does `ensureUserIdentity` run on every load?** The JWT is validated lazily — a valid JWT can exist before the `users` row does. The upsert is cheap (index lookup + conditional patch) and guarantees the row exists before any mutation runs.

**Why does `getAuthState` not validate the JWT?** It's an SSR hint only — avoids a Convex round-trip to prevent a loading flash. Real validation happens when Convex verifies the JWT on WebSocket connect. Expired cookies self-correct on hydration.

**Why is `createSvelteAuthClient` in `(app)/+layout.svelte` not root?** The root layout has no server load and no `authState`. `(app)/+layout.server.ts` is where `authState` is resolved, so `(app)/+layout.svelte` is the earliest point it can be passed to `createSvelteAuthClient`. All `(home)` and `[repo]` children inherit it via `useAuth()`.
