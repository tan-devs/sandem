import type { InitialAuthState } from '$lib/sveltekit/index.js';
import type { PROJECT_DOC } from '$types/projects.js';

export type RouteUser = {
	_id?: string;
	email?: string | null;
	name?: string | null;
} & Record<string, unknown>;

export type AuthStateOnlyLayoutData = {
	authState: InitialAuthState;
};

export type AuthLayoutData = {
	authState: InitialAuthState;
	currentUser: RouteUser | null;
};

export type RepoLayoutData = {
	authState: InitialAuthState;
	currentUser: RouteUser | null;
	projects: PROJECT_DOC[];
	workspaceTree?: Record<string, unknown>;
};
