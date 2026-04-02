import { api } from '$convex/_generated/api.js';
import { createAuth } from '$convex/functions/auth.js';
import { createConvexHttpClient, getAuthState } from '$lib/sveltekit';
import type { RequestEvent } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types.js';
import type { AppLayoutData } from '$types/routes.js';

export const load = (async ({ locals, cookies }: Pick<RequestEvent, 'locals' | 'cookies'>) => {
	const client = createConvexHttpClient({ token: locals.token });
	const authState = await getAuthState(createAuth, cookies);
	const currentUser = await client.query(api.auth.getCurrentUser, {}).catch(() => null);
	const projects = currentUser
		? await client.query(api.projects.getAllProjects, { ownerId: currentUser._id }).catch(() => [])
		: [];

	return {
		authState,
		currentUser,
		projects
	} satisfies AppLayoutData;
}) satisfies LayoutServerLoad<AppLayoutData>;
