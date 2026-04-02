# Auth System

> **Philosophy: Two-Table Identity.**
> Better Auth owns sessions/JWTs via a Convex component. Your app owns identity
> via a separate `users` table. The bridge is `tokenIdentifier`. Guests are
> first-class — they get a `users` row keyed on a stable cookie.

---

## Layer Map

```
convex/
  convex.config.ts                     ← registers the Better Auth Convex component
  config/auth.config.ts                ← Convex JWT provider config (getAuthConfigProvider())
  functions/
    auth.ts                            ← authComponent + createAuth + getCurrentUser
    users.ts                           ← ensureUserIdentity mutation
    http.ts                            ← registers Better Auth HTTP routes

src/lib/sveltekit/
  index.ts                             ← getToken, getAuthState, createConvexHttpClient, createSvelteKitHandler

src/lib/context/auth/
  auth-context.ts                      ← authClient singleton (Better Auth browser client)

src/routes/
  (app)/+layout.server.ts              ← SSR: getAuthState + getCurrentUser → AppLayoutData
  (app)/+layout.svelte                 ← createSvelteAuthClient (auth available to all (app) children)
  auth/
    +layout.server.ts                  ← SSR: getAuthState + getCurrentUser → AuthLayoutData
    +layout.svelte                     ← createSvelteAuthClient for the auth route subtree
    +page.svelte                       ← sign-in / sign-up / GitHub OAuth UI
  api/auth/[...path]/+server.ts        ← SvelteKit proxy → Convex HTTP (GET + POST, 10s timeout)
```

---

## Runtime Call Tree

```
Browser hits /auth (unauthenticated)
└── auth/+layout.server.ts
      ├── getAuthState(createAuth, cookies)      ← cookie presence check only
      └── client.query(api.auth.getCurrentUser)  ← null for unauthenticated

└── auth/+layout.svelte
      └── createSvelteAuthClient({ authClient, getServerState: () => data.authState })
            ← seeds client auth from SSR hint
            ← useAuth() available to +page.svelte

└── auth/+page.svelte
      ├── useAuth()                              ← isLoading, isAuthenticated
      ├── useQuery(getCurrentUser, skip if not authenticated, initialData: data.currentUser)
      └── renders: sign-in form | sign-up form | session card (if already authed)

Email sign-in
└── authClient.signIn.email({ email, password })
      └── POST /api/auth/sign-in/email
            └── api/auth/[...path]/+server.ts → proxy → Convex HTTP → Better Auth
                  ├── writes session to component-internal tables
                  └── sets JWT cookie → page re-renders as authenticated

GitHub OAuth
└── authClient.signIn.social({ provider: 'github' })
      └── redirects to GitHub → callback to /api/auth/callback/github
            └── proxy → Convex HTTP → Better Auth sets JWT cookie

Email sign-up
└── authClient.signUp.email({ name, email, password })
      └── POST /api/auth/sign-up/email → same proxy path as sign-in

Sign-out
└── authClient.signOut()
      └── clears JWT cookie → page re-renders as unauthenticated

Page load (SSR) — any (app) route
└── (app)/+layout.server.ts
      ├── getAuthState(createAuth, cookies)      ← cookie presence check only
      └── client.query(api.auth.getCurrentUser)  ← users table via tokenIdentifier

Client mount — (app) routes
└── (app)/+layout.svelte
      └── createSvelteAuthClient({ authClient, getServerState: () => data.authState })
            ← seeds client session from SSR hint, no round-trip
            ← useAuth() available in all (home) and [repo] children

[repo] load
└── loadWorkspace → ensureUserIdentity({ guestId? })
      ├── Authenticated: upsert users row by tokenIdentifier
      └── Guest: upsert users row by guestId cookie
```

---

## Auth Route (`src/routes/auth/`)

The auth route is a standalone subtree outside of `(app)`. It has its own
server load and layout so `createSvelteAuthClient` is initialised with the
correct SSR hint even when the user hasn't passed through the `(app)` shell.

### `auth/+layout.server.ts`

Returns `AuthLayoutData`. Mirrors `(app)/+layout.server.ts` but without
project loading — auth needs identity only.

```ts
type AuthLayoutData = {
	authState: { isAuthenticated: boolean };
	currentUser: UserDoc | null;
};
```

### `auth/+layout.svelte`

Calls `createSvelteAuthClient` with the `authClient` singleton imported from
`$lib/context/auth/auth-context.ts`. Seeds the client session from the SSR
hint to avoid a loading flash on the auth page itself.

```ts
createSvelteAuthClient({ authClient, getServerState: () => data.authState });
```

### `auth/+page.svelte`

Three render states:

| State           | Condition                      | Shows                                    |
| --------------- | ------------------------------ | ---------------------------------------- |
| Loading         | `auth.isLoading`               | Blinking "initialising\_"                |
| Authenticated   | `auth.isAuthenticated && user` | Session card + sign-out + "redirecting…" |
| Unauthenticated | default                        | Sign-in / sign-up tabs + GitHub button   |

Form state is local `$state` — `showSignIn`, `name`, `email`, `password`,
`submitting`, `errorMsg`. Errors from Better Auth are surfaced via the
`onError` callback on `signIn.email` / `signUp.email` and rendered inline.

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
| `getToken`               | Reads JWT cookie (handles `__Secure-` prefix in production)        |
| `getAuthState`           | Cookie presence check only — no Convex round-trip                  |
| `createConvexHttpClient` | `ConvexHttpClient` with optional token — used in server loads      |
| `createSvelteKitHandler` | `{ GET, POST }` proxy to `PUBLIC_CONVEX_SITE_URL` with 10s timeout |

### `src/lib/context/auth/auth-context.ts`

| Export       | Purpose                                                                     |
| ------------ | --------------------------------------------------------------------------- |
| `authClient` | Better Auth browser client singleton — imported by layouts and +page.svelte |

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

## Behaviours

**Post sign-in redirect:** after successful email sign-in or sign-up, `goto()`
navigates to `/${sandem.activeProjectId}` from localStorage, falling back to `/`
if no previous project exists.

**GitHub OAuth redirect:** `sessionStorage` flag `sandem.auth:redirect_after_signin`
is set before `signIn.social()` triggers the full-page redirect to GitHub. On
return, a `$effect` watching `isAuthenticated && user` reads the flag, removes it,
and calls `goto()`. Authenticated users who navigate directly to `/auth` do NOT
get redirected because the flag was never set.

**Already-authenticated state:** shows a session card with "Go to projects" and
"Sign out" buttons. No auto-redirect — intentional, allows account switching.

---

## Design Decisions

**Why two user tables?** Better Auth needs its own tables for sessions, OAuth,
and JWKS. Your app needs a stable Convex `_id` as a foreign key and guest
support — neither of which Better Auth provides.

**Why does `ensureUserIdentity` run on every load?** The JWT is validated
lazily — a valid JWT can exist before the `users` row does. The upsert is
cheap (index lookup + conditional patch) and guarantees the row exists before
any mutation runs.

**Why does `getAuthState` not validate the JWT?** It's an SSR hint only —
avoids a Convex round-trip to prevent a loading flash. Real validation happens
when Convex verifies the JWT on WebSocket connect. Expired cookies self-correct
on hydration.

**Why does the auth route have its own layout server load?** `(app)/+layout.server.ts`
is only reached through the `(app)` route group. The `/auth` route sits outside
that group, so it needs its own load to resolve `authState` and seed
`createSvelteAuthClient` correctly. Without it, the auth page would flash as
unauthenticated even when a valid JWT cookie exists.

**Why is `authClient` a singleton imported from context rather than constructed
inline?** Better Auth's browser client holds session state internally. A single
module-level instance ensures the session is shared across the auth layout and
any other component that calls `useAuth()` — re-constructing it per component
would create isolated instances that don't share session state.

**Why is `createSvelteAuthClient` in `(app)/+layout.svelte` not root?** The
root layout has no server load and no `authState`. `(app)/+layout.server.ts`
is where `authState` is resolved, so `(app)/+layout.svelte` is the earliest
point it can be passed to `createSvelteAuthClient`. All `(home)` and `[repo]`
children inherit it via `useAuth()`.
