import { api } from '$convex/_generated/api.js';
import { createAuth } from '$convex/functions/auth.js';
import { createConvexHttpClient, getAuthState } from '$lib/sveltekit';
import { loadWorkspace } from '$lib/controllers/workspace/LoaderController.svelte.js';
import type { RequestEvent } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types.js';
import type { RepoLayoutData } from '$types/routes.js';

// Render this route fully on the client — it relies on browser-only WebContainer APIs.
// The server load still runs to bootstrap auth state and project data before hydration,
// preventing a flash of unauthenticated/empty state.
export const ssr = false;

export const load = (async ({ locals, cookies }: Pick<RequestEvent, 'locals' | 'cookies'>) => {
	const client = createConvexHttpClient({ token: locals.token });
	const authState = await getAuthState(createAuth, cookies);
	const currentUser = await client.query(api.auth.getCurrentUser, {}).catch(() => null);

	return loadWorkspace(client, authState, currentUser, cookies);
}) satisfies LayoutServerLoad<RepoLayoutData>;
