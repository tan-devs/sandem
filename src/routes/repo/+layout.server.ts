import { api } from '$convex/_generated/api.js';
import { createAuth } from '$convex/auth.js';
import { createConvexHttpClient, getAuthState } from '$lib/sveltekit/index.js';
import type { LayoutServerLoad } from './$types.js';

// Render this route fully on the client because it relies on browser-only sandbox APIs.
export const ssr = false;

export const load = (async ({ locals, cookies }) => {
	// Create a Convex HTTP client bound to the current request token.
	const client = createConvexHttpClient({ token: locals.token });
	// Resolve auth state so client auth UI can hydrate consistently.
	const authState = await getAuthState(createAuth, cookies);

	try {
		// Fetch signed-in user; guests get an empty project list.
		const currentUser = await client.query(api.auth.getCurrentUser, {});
		if (!currentUser) return { authState, currentUser: null, projects: [] };

		// Ensure every authenticated user has at least one starter project.
		await client.mutation(api.projects.ensureStarterProjectForOwner, {
			owner: currentUser._id
		});

		// Backfill missing/empty room ids so every project can join Liveblocks by default.
		await client.mutation(api.projects.ensureLiveblocksRoomsForOwner, {
			owner: currentUser._id
		});

		// Load all projects for the current owner.
		const projects = await client.query(api.projects.getAllProjects, {
			owner: currentUser._id
		});

		return { authState, currentUser, projects: projects ?? [] };
	} catch {
		// Fail closed to guest-like state on backend/network errors.
		return { authState, currentUser: null, projects: [] };
	}
}) satisfies LayoutServerLoad;
