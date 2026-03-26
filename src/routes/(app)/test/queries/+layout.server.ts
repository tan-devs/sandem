import { api } from '$convex/_generated/api.js';
import { createConvexHttpClient } from '$lib/sveltekit/index.js';
import { createAuth } from '$convex/functions/auth.js';
import { getAuthState } from '$lib/sveltekit/index.js';
import type { LayoutServerLoad } from './$types.js';

export const load = (async ({ locals, cookies }) => {
	const client = createConvexHttpClient({ token: locals.token });
	const authState = await getAuthState(createAuth, cookies);

	try {
		const currentUser = await client.query(api.auth.getCurrentUser, {});
		return { authState, currentUser };
	} catch {
		return { authState, currentUser: null };
	}
}) satisfies LayoutServerLoad;
