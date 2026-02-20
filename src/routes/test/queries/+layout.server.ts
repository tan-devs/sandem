// Load hook for the queries test pages. This runs on the server and
// extracts authentication state from the cookies so that the page can
// render without a flash of unauthenticated content.
import { createAuth } from '$convex/auth.js';
import { getAuthState } from '$lib/sveltekit/index.js';
import type { LayoutServerLoad } from './$types.js';

export const load = (async ({ cookies }) => {
	const authState = await getAuthState(createAuth, cookies);
	return { authState };
}) satisfies LayoutServerLoad;
