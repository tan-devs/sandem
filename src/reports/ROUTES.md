# Routes & Data Flow

> **Philosophy: load early, render instantly.**
> Auth and projects are resolved server-side before hydration. WebContainer
> boots at app-layout level while the user is still on the home page.
> By the time they navigate to `/[repo]` the sandbox is warm and data is ready.

---

## Route Tree

```
src/routes/
  +layout.svelte                         ← root: Convex client setup only
  (app)/
    +layout.server.ts                    ← SSR: auth + currentUser + projects → AppLayoutData
    +layout.svelte                       ← app shell: auth client init + WC pre-boot + project preload
    (home)/                              ← landing / dashboard routes
    [repo]/
      +layout.server.ts                  ← SSR: auth + loadWorkspace() → RepoLayoutData
      +layout.svelte                     ← IDE shell: consumes sandbox context
      +page.svelte                       ← pane composition: no server load, no data prop
  api/
    auth/[...path]/+server.ts            ← Better Auth proxy → Convex HTTP
```

---

## Boot Sequence

```
1. User hits any (app) route
   └── (app)/+layout.server.ts runs
         └── authState + currentUser + projects → AppLayoutData

   └── (app)/+layout.svelte mounts
         ├── createSvelteAuthClient()        ← seeds client auth from SSR hint
         ├── setSandboxContext(...)          ← wc + preloadedProjects + isGuest
         └── onMount → wcSingleton.boot()   ← fires & forgets, fully silent

2. User is on (home) page
   └── wcSingleton booting in background
       getAllProjects running via useQuery   ← projects preloading silently

3. User navigates to /[repo]
   ├── +layout.server.ts runs (SSR)
   │     └── loadWorkspace() → RepoLayoutData
   │
   └── +layout.svelte mounts (client)
         ├── requireSandboxContext()
         ├── useAuth()                       ← client already initialized by (app) parent
         ├── useQuery(getCurrentUser,  initialData: data.currentUser)
         ├── useQuery(getAllProjects,   initialData: sandbox.getPreloadedProjects())
         └── createWorkspaceController({ getExternalWebcontainer: wc.getWebcontainer })
```

---

## Layer-by-Layer

### `routes/+layout.svelte` (root)

Minimal. Sets up the Convex client only. No auth, no project loading.

```ts
setupConvex(PUBLIC_CONVEX_URL);
```

---

### `routes/(app)/+layout.server.ts`

Runs on every `(app)` route. Returns `AppLayoutData`.

```ts
authState    ← getAuthState(createAuth, cookies)   // cookie check only
currentUser  ← client.query(api.auth.getCurrentUser)
projects     ← client.query(api.projects.getAllProjects)
```

---

### `routes/(app)/+layout.svelte`

The auth + pre-boot layer. Transparent — renders no UI.

```
createSvelteAuthClient({ authClient, getServerState: () => data.authState })
  ← must live here so useAuth() works in all (home) and [repo] children

useQuery(getAllProjects, initialData: data.projects)
  ← silent preload while user is on home page

setSandboxContext({ wc: wcSingleton, getPreloadedProjects, isGuest })

onMount → wcSingleton.boot()   ← idempotent, fire-and-forget
```

---

### `routes/(app)/[repo]/+layout.server.ts`

`ssr = false` — server load still runs to seed `initialData` and prevent auth flash.

```
loadWorkspace(client, authState, currentUser, cookies)
  ├── Authenticated → ensureUserIdentity + getAllProjects + getWorkspaceTree
  └── Guest         → ensureUserIdentity({ guestId })
  → returns RepoLayoutData
```

---

### `routes/(app)/[repo]/+layout.svelte`

IDE shell. Auth client already initialized by `(app)` parent.

```
requireSandboxContext()          ← wc already booting, projects preloaded
useAuth()                        ← client initialized upstream, no re-init
useQuery(getCurrentUser,  initialData: data.currentUser)
useQuery(getAllProjects,   initialData: sandbox.getPreloadedProjects() ?? data.projects)
createWorkspaceController({ getExternalWebcontainer: wc.getWebcontainer })
onMount → ctrl.mount()
```

---

### `routes/(app)/[repo]/+page.svelte`

No server load. No data prop.

```ts
const ide = requireIDEContext();
// passes ide.getPanels!() to WorkspacePaneLayout
```

---

## Key Types

```ts
type AppLayoutData = {
	authState: { isAuthenticated: boolean };
	currentUser: UserDoc | null;
	projects: ProjectDoc[];
};

type RepoLayoutData = {
	authState: { isAuthenticated: boolean };
	currentUser: UserDoc | null;
	isGuest: boolean;
	userIdentity: UserIdentity | null;
	projects: ProjectDoc[];
	workspaceTree?: FileSystemTree;
};
```

---

## Context Registry

| Context            | Set in                 | Read in                          | Purpose                           |
| ------------------ | ---------------------- | -------------------------------- | --------------------------------- |
| `AuthContext`      | `(app)/+layout.svelte` | everywhere                       | Better Auth client state          |
| `SandboxContext`   | `(app)/+layout.svelte` | `[repo]/+layout.svelte`          | WC singleton + preloaded projects |
| `IDEContext`       | `WorkspaceController`  | `+page.svelte`, Editor, Terminal | Runtime, panels, editor sync      |
| `WorkspaceContext` | `WorkspaceController`  | Explorer sidebar                 | Project CRUD surface              |

---

## WC Singleton Phases

```
idle → booting → ready
              ↘ failed   (bootPromise cleared, retry allowed)
```

`boot()` is idempotent. `getWebcontainer()` throws if phase !== `ready`.
