import type { Cookies } from '@sveltejs/kit';
import { api } from '$convex/_generated/api.js';
import type { RepoLayoutData } from '$types/routes.js';
import type { Doc, Id } from '$convex/_generated/dataModel.js';
import type { ConvexHttpClient } from 'convex/browser';

export type ConvexLikeClient = Pick<ConvexHttpClient, 'query' | 'mutation'>;

type ProjectDoc = Doc<'projects'>;

export function ensureGuestIdCookie(cookies: Cookies): string {
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
	return guestId;
}

export async function loadRepoLayoutAuthenticated(
	client: ConvexLikeClient,
	currentUser: NonNullable<RepoLayoutData['currentUser']>
): Promise<{
	userIdentity: Awaited<ReturnType<ConvexLikeClient['mutation']>>;
	projects: ProjectDoc[];
	workspaceTree: RepoLayoutData['workspaceTree'];
}> {
	const userIdentity = await client.mutation(api.identity.ensureUserIdentity, {});

	// _id is Id<'users'> from the Convex-generated type — no cast needed beyond
	// the explicit annotation. Previously written as `as unknown as any`.
	const ownerId = currentUser._id as Id<'users'>;

	await client.mutation(api.projects.ensureStarterProjectForOwner, { ownerId });
	await client.mutation(api.projects.ensureLiveblocksRoomsForOwner, { ownerId });

	const workspaceTree =
		((await client.query(api.filesystem.getWorkspaceTree, {
			ownerId
		})) as RepoLayoutData['workspaceTree'] | null | undefined) ??
		({} as RepoLayoutData['workspaceTree']);

	const projects =
		((await client.query(api.projects.getAllProjects, {
			ownerId
		})) as ProjectDoc[] | null | undefined) ?? [];

	return { userIdentity, projects, workspaceTree };
}

export async function loadRepoLayoutGuest(
	client: ConvexLikeClient,
	guestId: string
): Promise<{
	userIdentity: Awaited<ReturnType<ConvexLikeClient['mutation']>>;
	projects: ProjectDoc[];
}> {
	const userIdentity = await client.mutation(api.identity.ensureUserIdentity, { guestId });
	return { userIdentity, projects: [] };
}
