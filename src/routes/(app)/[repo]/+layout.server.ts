import { api } from '$convex/_generated/api.js';
import { createConvexHttpClient } from '$lib/sveltekit';
import { buildWorkspaceTree } from '$lib/utils/vfs';
import type { LayoutServerLoad } from './$types.js';
import type { RepoLayoutData } from '$types/routes.js';

export const ssr = false;

export const load = (async ({ locals, parent }) => {
	// Inherit authState, currentUser, and projects from (app)/+layout.server.ts.
	// This avoids a second getCurrentUser call and a second getAllProjects fetch
	// that the parent already performed for the home page.
	const { authState, currentUser, projects } = await parent();

	const isGuest = !currentUser;

	if (isGuest) {
		return {
			authState,
			currentUser,
			isGuest,
			userIdentity: null,
			projects: [],
			workspaceTree: undefined
		} satisfies RepoLayoutData;
	}

	// Only fetch what the repo layout uniquely needs:
	//   • getAllProjectsWithNodes  — required to build the workspace file tree
	//   • getUserIdentity          — used by the IDE context
	const client = createConvexHttpClient({ token: locals.token });

	const [projectsWithNodes, userIdentity] = await Promise.all([
		client
			.query(api.projects.getAllProjectsWithNodes, { ownerId: currentUser._id })
			.catch(() => []),
		client.query(api.auth.getUserIdentity, {}).catch(() => null)
	]);

	const workspaceTree = buildWorkspaceTree(projectsWithNodes);

	return {
		authState,
		currentUser,
		isGuest,
		userIdentity,
		// Use the parent's already-fetched projects list (same shape, no nodes/isOwner).
		// getAllProjectsWithNodes data is only needed for workspaceTree above.
		projects,
		workspaceTree
	} satisfies RepoLayoutData;
}) satisfies LayoutServerLoad<RepoLayoutData>;
