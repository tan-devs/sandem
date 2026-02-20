// Development-only layout load that fetches the current user and
// authentication state. This lets the /dev page show live info for
// debugging without exposing it in production.
import { api } from '$convex/_generated/api.js';
import { createAuth } from '$convex/auth.js';
import { createConvexHttpClient, getAuthState } from '$lib/sveltekit/index.js';
import type { LayoutServerLoad } from './$types.js';

export const load = (async ({ locals, cookies }) => {
	const client = createConvexHttpClient({ token: locals.token });

	const authState = await getAuthState(createAuth, cookies);

	console.log('authState', authState);
	try {
		const currentUser = await client.query(api.auth.getCurrentUser, {});

		return { currentUser, authState };
	} catch {
		return { currentUser: null, authState };
	}
}) satisfies LayoutServerLoad;
