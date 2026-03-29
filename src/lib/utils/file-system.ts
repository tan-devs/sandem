import type { FileSystemTree } from '@webcontainer/api';
import type { NodeDoc } from '$lib/context/ide-context.js';

// ---------------------------------------------------------------------------
// Node-shaped local types (subset of NodeDoc used in path helpers)
// ---------------------------------------------------------------------------

type NodeLike = Pick<NodeDoc, 'path'>;
type NodeWithContent = Pick<NodeDoc, 'path' | 'content'>;

// ---------------------------------------------------------------------------
// WebContainer path helpers
// ---------------------------------------------------------------------------

/** Returns the first path segment — the WebContainer root folder name. */
export function getRootFolder(path: string): string {
	return path.split('/')[0] ?? '';
}

/**
 * Construct a fully-qualified WebContainer path from a root folder and a
 * project-relative node path.
 *
 * e.g. ("my-project", "/src/App.tsx") → "my-project/src/App.tsx"
 */
export function toWebContainerPath(rootFolder: string, nodePath: string): string {
	const normalized = nodePath.replace(/^\//, '');
	if (!rootFolder) return normalized;
	if (normalized.startsWith(`${rootFolder}/`)) return normalized;
	return `${rootFolder}/${normalized}`;
}

// ---------------------------------------------------------------------------
// Node path resolution
// ---------------------------------------------------------------------------

/**
 * Resolve a WebContainer path back to a canonical node path.
 *
 * Nodes use absolute project-relative paths (e.g. "/src/App.tsx").
 * WebContainer paths are rooted with the project folder name
 * (e.g. "my-project/src/App.tsx").
 *
 * This function strips the leading folder segment when the exact path isn't
 * found in the node list, so callers get back the key used in the `nodes` table.
 */
export function resolveNodePath(wcPath: string, nodes: ReadonlyArray<NodeLike>): string {
	// Exact match (already a node path).
	if (nodes.some((n) => n.path === wcPath)) return wcPath;

	// Strip leading slash and try again.
	const withoutLeadingSlash = wcPath.replace(/^\//, '');
	if (nodes.some((n) => n.path === `/${withoutLeadingSlash}`)) return `/${withoutLeadingSlash}`;

	// Strip first path segment (project folder prefix).
	const [, ...rest] = wcPath.split('/');
	const stripped = `/${rest.join('/')}`;
	if (stripped !== '/' && nodes.some((n) => n.path === stripped)) return stripped;

	// Fall back to the original path — let the caller decide.
	return wcPath;
}

// ---------------------------------------------------------------------------
// FileSystemTree builders
// ---------------------------------------------------------------------------

/**
 * Build a WebContainer `FileSystemTree` from a flat list of file nodes.
 * Folder nodes are implicit — they are created from the path segments of
 * file nodes, so you don't need to pass folder nodes explicitly.
 *
 * Node paths must be absolute project-relative (e.g. "/src/App.tsx").
 */
export function nodesToFileSystemTree(nodes: ReadonlyArray<NodeWithContent>): FileSystemTree {
	const tree: FileSystemTree = {};

	for (const node of nodes) {
		const parts = node.path.replace(/^\//, '').split('/').filter(Boolean);
		let cursor: FileSystemTree = tree;

		for (let i = 0; i < parts.length; i++) {
			const part = parts[i]!;
			const isLeaf = i === parts.length - 1;

			if (isLeaf) {
				cursor[part] = { file: { contents: node.content ?? '' } };
			} else {
				if (!cursor[part]) cursor[part] = { directory: {} };
				cursor = (cursor[part] as { directory: FileSystemTree }).directory;
			}
		}
	}

	return tree;
}
