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
	isGuest: boolean;
	userIdentity: unknown | null; // tighten once UserIdentity type is available
	projects: PROJECT_DOC[];
	workspaceTree?: Record<string, unknown>; // authenticated path only
};

export type AppLayoutData = {
	authState: { isAuthenticated: boolean };
	currentUser: UserDoc | null;
	projects: ProjectDoc[];
};
