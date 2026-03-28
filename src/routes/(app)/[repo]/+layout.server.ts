import { api } from '$convex/_generated/api.js';
import { createAuth } from '$convex/functions/auth.js';
import { createConvexHttpClient, getAuthState } from '$lib/sveltekit/index.js';
import {
	ensureGuestIdCookie,
	loadRepoLayoutAuthenticated,
	loadRepoLayoutGuest
} from '$lib/controllers/repo/RepoLoaderController.svelte.js';
import type { RequestEvent, Cookies } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types.js';
import type { RepoLayoutData } from '$types/routes.js';

// Render this route fully on the client — it relies on browser-only sandbox APIs.
export const ssr = false;

export const load = (async ({ locals, cookies }: Pick<RequestEvent, 'locals' | 'cookies'>) => {
	const client = createConvexHttpClient({ token: locals.token });
	const authState = await getAuthState(createAuth, cookies);

	try {
		const currentUser = await client.query(api.auth.getCurrentUser, {});

		if (currentUser) {
			const { userIdentity, projects, workspaceTree } = await loadRepoLayoutAuthenticated(
				client,
				currentUser
			);

			return {
				authState,
				currentUser,
				isGuest: false,
				userIdentity,
				projects,
				workspaceTree
			};
		}

		const guestId = ensureGuestIdCookie(cookies as Cookies);
		const { userIdentity, projects } = await loadRepoLayoutGuest(client, guestId);

		return {
			authState,
			currentUser,
			isGuest: true,
			userIdentity,
			projects
		};
	} catch {
		// Fail closed: treat any backend/network error as a guest-like state.
		return {
			authState,
			currentUser: null,
			isGuest: true,
			userIdentity: null,
			projects: []
		};
	}
}) satisfies LayoutServerLoad<RepoLayoutData>;
