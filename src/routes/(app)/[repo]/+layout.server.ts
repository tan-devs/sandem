import { api } from '$convex/_generated/api.js';
import { createAuth } from '$convex/functions/auth.js';
import { createConvexHttpClient, getAuthState } from '$lib/sveltekit/index.js';
import type { RequestEvent } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types.js';
import type { RepoLayoutData } from '$types/routes.js';
import type { Document as ProjectDocument } from '$types/projects.js';

// Render this route fully on the client — it relies on browser-only sandbox APIs.
export const ssr = false;

export const load = (async ({ locals, cookies }: Pick<RequestEvent, 'locals' | 'cookies'>) => {
	const client = createConvexHttpClient({ token: locals.token });
	const authState = await getAuthState(createAuth, cookies);

	try {
		// Returns the full Convex user document (with _id as v.id('users')) or null.
		const currentUser = await client.query(api.auth.getCurrentUser, {});

		let projects = [] as ProjectDocument[];
		let userIdentity: Awaited<
			ReturnType<typeof client.mutation<typeof api.filesystem.ensureUserIdentity>>
		> | null = null;

		if (currentUser) {
			// ----------------------------------------------------------------
			// Authenticated user
			// ----------------------------------------------------------------

			// Upsert the user row and get back { convexUserId, isGuest: false }.
			// Identity is resolved server-side via ctx.auth — no guestId needed.
			userIdentity = await client.mutation(api.filesystem.ensureUserIdentity, {});

			// Seed starter project for new users (idempotent).
			await client.mutation(api.projects.ensureStarterProjectForOwner, {
				ownerId: currentUser._id
			});

			// Backfill any projects that are missing a Liveblocks room slug.
			await client.mutation(api.projects.ensureLiveblocksRoomsForOwner, {
				ownerId: currentUser._id
			});

			const workspaceTree =
				(await client.query(api.filesystem.getWorkspaceTree, {
					ownerId: currentUser._id
				})) ?? {};

			projects =
				(await client.query(api.projects.getAllProjects, {
					ownerId: currentUser._id
				})) ?? [];

			return {
				authState,
				currentUser,
				isGuest: false,
				userIdentity,
				projects,
				workspaceTree
			};
		} else {
			// ----------------------------------------------------------------
			// Guest user
			// ----------------------------------------------------------------

			// Ensure a stable guest ID lives in a 30-day cookie.
			let guestId = cookies.get('guestId');
			if (!guestId) {
				guestId = `guest-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
				cookies.set('guestId', guestId, {
					path: '/',
					maxAge: 60 * 60 * 24 * 30,
					httpOnly: true,
					sameSite: 'lax'
				});
			}

			// Upsert the guest identity row so filesystem operations have a
			// stable ownerId. Returns { convexUserId, isGuest: true }.
			userIdentity = await client.mutation(api.filesystem.ensureUserIdentity, { guestId });

			// Guests can't own projects — leave projects as [].
		}

		return {
			authState,
			currentUser,
			isGuest: !currentUser,
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
