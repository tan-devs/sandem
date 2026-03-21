# Context organization

> Last updated: 2026-03-20

Context modules are grouped by domain:

- `auth/` → auth context/client bindings
- `ide/` → IDE runtime context

## Import style

- `import { authClient } from '$lib/context/auth/auth-client.js'`
- `import { setIDEContext, requireIDEContext } from '$lib/context/ide/ide-context.js'`

Optional barrel:

- `import { authClient } from '$lib/context/index.js'`
