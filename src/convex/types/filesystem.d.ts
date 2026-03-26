export interface FileNode {
	_id: import('convex/values').GenericId<'nodes'>;
	_creationTime: number;
	projectId: import('convex/values').GenericId<'projects'>;
	path: string;
	name: string;
	type: 'file' | 'folder';
	content?: string;
	parentId?: import('convex/values').GenericId<'nodes'>;
	createdAt: number;
	updatedAt: number;
}

export function folderNameFromProject(project: { name?: string; _id: string }): string;
export function normalizeNodePath(path: string): string;
export function getParentNodePath(path: string): string;
