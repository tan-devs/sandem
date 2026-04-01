import { api } from '$convex/_generated/api.js';
import type { Id } from '$convex/_generated/dataModel.js';

import type { Cookies } from '@sveltejs/kit';
import type { RepoLayoutData } from '$types/routes.js';
import type { ConvexHttpClient } from 'convex/browser';

type AuthState = RepoLayoutData['authState'];
type CurrentUser = RepoLayoutData['currentUser'];
type ConvexClient = Pick<ConvexHttpClient, 'query' | 'mutation'>;

const GUEST_COOKIE = 'sandem.guestId';

export function ensureGuestIdCookie(cookies: Cookies): string {
	const existing = cookies.get(GUEST_COOKIE);
	if (existing) return existing;

	const id = crypto.randomUUID();
	cookies.set(GUEST_COOKIE, id, {
		path: '/',
		maxAge: 60 * 60 * 24 * 365,
		httpOnly: true,
		sameSite: 'lax'
	});
	return id;
}

export async function loadWorkspaceAuthenticated(
	client: ConvexClient,
	currentUser: NonNullable<CurrentUser>
): Promise<{
	userIdentity: RepoLayoutData['userIdentity'];
	projects: RepoLayoutData['projects'];
	workspaceTree: RepoLayoutData['workspaceTree'];
}> {
	// ensureUserIdentity upserts the row and seeds the starter project on first login
	const userIdentity = await client.mutation(api.users.ensureUserIdentity, {});

	const [projects, workspaceTree] = await Promise.all([
		client.query(api.projects.getAllProjects, { ownerId: currentUser._id as Id<'users'> }),
		client.query(api.filesystem.getWorkspaceTree, { ownerId: currentUser._id as Id<'users'> })
	]);

	return { userIdentity, projects, workspaceTree };
}

export async function loadWorkspaceGuest(
	client: ConvexClient,
	guestId: string
): Promise<{
	userIdentity: RepoLayoutData['userIdentity'];
	projects: RepoLayoutData['projects'];
}> {
	// ensureUserIdentity handles the guest path when called without a JWT —
	// it falls through to the guestId branch in users.ts
	const userIdentity = await client.mutation(api.users.ensureUserIdentity, { guestId });

	// Guests have no owned projects
	return { userIdentity, projects: [] };
}

export async function loadWorkspace(
	client: ConvexClient,
	authState: AuthState,
	currentUser: CurrentUser,
	cookies: Cookies
): Promise<RepoLayoutData> {
	try {
		if (currentUser) {
			const { userIdentity, projects, workspaceTree } = await loadWorkspaceAuthenticated(
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

		const guestId = ensureGuestIdCookie(cookies);
		const { userIdentity, projects } = await loadWorkspaceGuest(client, guestId);

		return {
			authState,
			currentUser: null,
			isGuest: true,
			userIdentity,
			projects
		};
	} catch (err) {
		console.error('[WorkspaceLoaderController] backend error, falling back to guest state', err);
		return {
			authState,
			currentUser: null,
			isGuest: true,
			userIdentity: null,
			projects: []
		};
	}
}
