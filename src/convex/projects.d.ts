import type { GenericId } from 'convex/values';

// ---------------------------------------------------------------------------
// Shared return shapes
// ---------------------------------------------------------------------------

type ProjectDoc = {
	_id: GenericId<'projects'>;
	_creationTime: number;
	ownerId: GenericId<'users'>;
	name: string;
	isPublic: boolean;
	room: string;
	entry?: string | undefined;
	createdAt: number;
	updatedAt: number;
};

type NodeDoc = {
	_id: GenericId<'nodes'>;
	_creationTime: number;
	projectId: GenericId<'projects'>;
	path: string;
	name: string;
	type: 'file' | 'folder';
	content?: string | undefined;
	parentId?: GenericId<'nodes'> | undefined;
	createdAt: number;
	updatedAt: number;
};

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export declare const createProject: import('convex/server').RegisteredMutation<
	'public',
	{
		ownerId: GenericId<'users'>;
		name: string;
		isPublic?: boolean | undefined;
		room?: string | undefined;
		entry?: string | undefined;
	},
	Promise<GenericId<'projects'>>
>;

export declare const updateProject: import('convex/server').RegisteredMutation<
	'public',
	{
		id: GenericId<'projects'>;
		name?: string | undefined;
		entry?: string | undefined;
		room?: string | undefined;
		isPublic?: boolean | undefined;
	},
	Promise<void>
>;

export declare const deleteProject: import('convex/server').RegisteredMutation<
	'public',
	{ id: GenericId<'projects'> },
	Promise<void>
>;

export declare const ensureStarterProjectForOwner: import('convex/server').RegisteredMutation<
	'public',
	{ ownerId: GenericId<'users'> },
	Promise<string | null>
>;

export declare const ensureLiveblocksRoomsForOwner: import('convex/server').RegisteredMutation<
	'public',
	{ ownerId: GenericId<'users'> },
	Promise<number>
>;

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export declare const getAllProjects: import('convex/server').RegisteredQuery<
	'public',
	{ ownerId: GenericId<'users'> },
	Promise<ProjectDoc[]>
>;

export declare const getProject: import('convex/server').RegisteredQuery<
	'public',
	{ id: GenericId<'projects'> },
	Promise<ProjectDoc & { isOwner: boolean }>
>;

/**
 * Primary IDE loader. Resolves by username + project name and enforces
 * read permission before returning any file data.
 */
export declare const getProjectFiles: import('convex/server').RegisteredQuery<
	'public',
	{ username: string; projectName: string },
	Promise<{
		project: ProjectDoc;
		nodes: NodeDoc[];
		isOwner: boolean;
	}>
>;

export declare const openCollab: import('convex/server').RegisteredQuery<
	'public',
	{ room: string },
	Promise<ProjectDoc | null>
>;