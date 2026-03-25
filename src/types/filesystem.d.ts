import type { Id } from '$convex/_generated/dataModel.js';

/**
 * Mirrors the `nodes` table row from schema.ts.
 * Used throughout the sidebar tree and IDE store.
 */
export interface FileNode {
	_id: Id<'nodes'>;
	_creationTime: number;
	projectId: Id<'projects'>;
	path: string; // "/src/utils.ts" — absolute from project root
	name: string; // "utils.ts"
	type: 'file' | 'folder';
	content?: string; // undefined for folders
	parentId?: Id<'nodes'>; // undefined → root child
	createdAt: number;
	updatedAt: number;
}

/**
 * The nested tree format WebContainers expects from `instance.mount()`.
 *
 * Built by filesystem.getWebContainerTree (Convex query) or
 * buildWebContainerTree (client-side util in src/lib/utils/vfs.ts).
 */
export type WebContainerFile = {
	file: { contents: string };
};

export type WebContainerDirectory = {
	directory: WebContainerTree;
};

export type WebContainerTree = {
	[name: string]: WebContainerFile | WebContainerDirectory;
};
