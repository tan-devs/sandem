import { api } from '$convex/_generated/api.js';
import { createConvexHttpClient } from '$lib/sveltekit/index.js';
import type { PageServerLoad } from './$types.js';

export const load = (async ({ locals }) => {
	const client = createConvexHttpClient({ token: locals.token });

	// Fetch both public and protected data on server
	const publicData = await client.query(api.auth.getPublicData, {});

	let protectedData = null;
	// Attempt to load data that requires an authenticated session. The
	// Convex client will throw if the token is missing/invalid, so we catch
	// and treat that as "not authenticated".
	try {
		protectedData = await client.query(api.auth.getCurrentUser, {});
	} catch {
		// Not authenticated
	}

	return {
		publicData,
		protectedData
	};
}) satisfies PageServerLoad;
