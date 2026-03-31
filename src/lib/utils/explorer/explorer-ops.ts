/**
 * Explorer utility functions — pure or pseudo-pure (DI-injected).
 *
 * Two sections:
 *   1. Tree query utilities  — truly pure, no side effects
 *   2. Action handlers       — pseudo-pure: all deps injected via ExplorerActionContext
 *
 * Nothing in this file imports stores, context, or Svelte runes.
 * Relocated from:
 *   - src/lib/utils/ide/explorerTreeOps.ts  (tree query utils)
 *   - src/lib/services/explorer/createExplorer.svelte.ts  (action handlers)
 */

import type { WebContainer } from '@webcontainer/api';
import type { Doc } from '$convex/_generated/dataModel.js';
import type { FileNode } from '$types/editor.js';
import type { FileTreeService, ProjectSyncService } from '$lib/services/explorer/';
import { projectFolderName } from '$lib/utils/explorer/projects.js';

type ProjectDoc = Doc<'projects'>;

// ─── Action context ───────────────────────────────────────────────────────────

/**
 * All dependencies an action handler needs, assembled by the controller
 * via buildActionContext() at call time. No handler closes over external state.
 */
export type ExplorerActionContext = {
	fileTree: FileTreeService;
	projectSync: ProjectSyncService;
	editorOpenFile: (path: string) => void;
	getWebcontainer: () => WebContainer;
	getActiveProject: () => ProjectDoc | undefined;
	tree: FileNode[];
	selectedPath: string | null;
	onMessage: (msg: string) => void;
	onError: (msg: string) => void;
};

// ─── 1. Tree query utilities (pure) ──────────────────────────────────────────

/**
 * Recursively filter a FileNode tree to only nodes whose name (or any
 * descendant's name) contains `query` (case-insensitive).
 * Directories are included only when they have at least one matching descendant.
 */
export function filterNodesByQuery(nodes: FileNode[], query: string): FileNode[] {
	if (!query.trim()) return nodes;
	const q = query.toLowerCase();

	function filterNode(node: FileNode): FileNode | null {
		if (node.type === 'file') {
			return node.name.toLowerCase().includes(q) ? node : null;
		}
		// Directory: keep only if it has matching children.
		const filteredChildren = (node.children ?? []).flatMap((c) => {
			const r = filterNode(c);
			return r ? [r] : [];
		});
		return filteredChildren.length > 0 ? { ...node, children: filteredChildren } : null;
	}

	return nodes.flatMap((n) => {
		const r = filterNode(n);
		return r ? [r] : [];
	});
}

/**
 * Return the set of directory paths that must be expanded so every node in
 * `filteredTree` is visible. Used by the search-expansion $effect.
 */
export function getPathsToExpand(filteredTree: FileNode[]): Set<string> {
	const paths = new Set<string>();

	function collect(nodes: FileNode[]): void {
		for (const node of nodes) {
			if (node.type === 'directory') {
				paths.add(node.path);
				collect(node.children ?? []);
			}
		}
	}

	collect(filteredTree);
	return paths;
}

/** Walk the tree depth-first and return the node at `path`, or undefined. */
export function findNode(nodes: FileNode[], path: string): FileNode | undefined {
	for (const node of nodes) {
		if (node.path === path) return node;
		if (node.children) {
			const found = findNode(node.children, path);
			if (found) return found;
		}
	}
	return undefined;
}

/** Collect every directory path in the tree (depth-first). */
export function getAllDirectoryPaths(nodes: FileNode[]): string[] {
	const paths: string[] = [];
	for (const node of nodes) {
		if (node.type === 'directory') {
			paths.push(node.path);
			paths.push(...getAllDirectoryPaths(node.children ?? []));
		}
	}
	return paths;
}

/**
 * Strip leading slashes, collapse double-slashes, reject ".." segments.
 * Throws on empty or malformed input so callers get a clear error message.
 */
export function validateProjectRelativePath(path: string): string {
	const cleaned = path.trim().replace(/^\/+/, '').replace(/\/+/g, '/').replace(/\/+$/, '');
	if (!cleaned) throw new Error('Path cannot be empty.');
	if (cleaned.split('/').some((s) => s === '..'))
		throw new Error('Path cannot contain ".." segments.');
	return cleaned;
}

// ─── 2. Action handlers (pseudo-pure, DI via ExplorerActionContext) ───────────

function requireInput(value: string, label: string): string {
	const normalized = value.trim();
	if (!normalized) throw new Error(`${label} is required.`);
	return normalized;
}

/**
 * Resolve an arbitrary user-typed path to a project-rooted path.
 * If the first segment is already a known workspace root, return as-is.
 * Otherwise, prepend the active project's folder slug.
 */
export function normalizeToProjectPath(
	input: string,
	tree: FileNode[],
	activeProject?: ProjectDoc
): string {
	const value = validateProjectRelativePath(input);
	const firstSegment = value.split('/')[0] ?? '';

	const isKnownRoot = tree.some(
		(n) => n.depth === 0 && n.type === 'directory' && n.name === firstSegment
	);
	if (isKnownRoot) return value;

	if (activeProject) {
		const rootFolder = projectFolderName(activeProject);
		if (!value.startsWith(`${rootFolder}/`)) {
			return validateProjectRelativePath(`${rootFolder}/${value}`);
		}
	}

	return validateProjectRelativePath(value);
}

// ── File/folder CRUD ──────────────────────────────────────────────────────────

export async function handleCreateFile(
	ctx: ExplorerActionContext,
	requestedPath: string
): Promise<boolean> {
	if (!ctx.projectSync.canWrite()) {
		ctx.onError('You have viewer access. File changes are disabled.');
		return false;
	}
	try {
		const input = requireInput(requestedPath, 'File path');
		const fullPath = normalizeToProjectPath(input, ctx.tree, ctx.getActiveProject());
		const validatedPath = validateProjectRelativePath(fullPath);

		const segments = validatedPath.split('/');
		const fileName = segments.pop();
		if (!fileName) throw new Error('Invalid file name.');

		const directory = segments.join('/');
		if (directory) {
			await ctx.getWebcontainer().fs.mkdir(directory, { recursive: true });
		}

		await ctx.getWebcontainer().fs.writeFile(validatedPath, '', 'utf-8');
		await ctx.projectSync.createFile(validatedPath, '');
		ctx.editorOpenFile(validatedPath);
		await ctx.fileTree.refresh();
		ctx.onMessage(`Created ${validatedPath}`);
		return true;
	} catch (err) {
		ctx.onError(`Could not create file: ${String(err)}`);
		return false;
	}
}

export async function handleCreateFolder(
	ctx: ExplorerActionContext,
	requestedPath: string
): Promise<boolean> {
	if (!ctx.projectSync.canWrite()) {
		ctx.onError('You have viewer access. Folder changes are disabled.');
		return false;
	}
	try {
		const input = requireInput(requestedPath, 'Folder path');
		const fullPath = normalizeToProjectPath(input, ctx.tree, ctx.getActiveProject());
		const validatedPath = validateProjectRelativePath(fullPath);
		await ctx.getWebcontainer().fs.mkdir(validatedPath, { recursive: true });
		await ctx.projectSync.createDirectory(validatedPath);
		await ctx.fileTree.refresh();
		ctx.onMessage(`Created folder ${validatedPath}`);
		return true;
	} catch (err) {
		ctx.onError(`Could not create folder: ${String(err)}`);
		return false;
	}
}

export async function handleRenameNode(
	ctx: ExplorerActionContext,
	requestedPath: string
): Promise<boolean> {
	if (!ctx.selectedPath) {
		ctx.onError('Please select a file or folder first.');
		return false;
	}
	if (!ctx.projectSync.canWrite()) {
		ctx.onError('You have viewer access. Rename is disabled.');
		return false;
	}
	const node = findNode(ctx.tree, ctx.selectedPath);
	if (!node) return false;

	try {
		const input = requireInput(requestedPath, 'New path');
		const currentPath = validateProjectRelativePath(ctx.selectedPath);
		const fullNewPath = normalizeToProjectPath(input, ctx.tree, ctx.getActiveProject());
		const validatedNewPath = validateProjectRelativePath(fullNewPath);

		if (validatedNewPath === currentPath) {
			ctx.onError('New path must differ from the current path.');
			return false;
		}

		await ctx.projectSync.renamePath(currentPath, validatedNewPath);
		await ctx.fileTree.refresh();
		ctx.onMessage(`Renamed to ${validatedNewPath}`);
		return true;
	} catch (err) {
		ctx.onError(`Could not rename: ${String(err)}`);
		return false;
	}
}

export async function handleDeleteNode(ctx: ExplorerActionContext): Promise<boolean> {
	if (!ctx.selectedPath) {
		ctx.onError('Please select a file or folder first.');
		return false;
	}
	if (!ctx.projectSync.canWrite()) {
		ctx.onError('You have viewer access. Delete is disabled.');
		return false;
	}

	const node = findNode(ctx.tree, ctx.selectedPath);
	if (node?.type === 'directory' && node.depth === 0) {
		ctx.onError('Deleting a project root folder is not supported from the Explorer.');
		return false;
	}

	try {
		const targetPath = validateProjectRelativePath(ctx.selectedPath);
		await ctx.projectSync.deletePath(targetPath);
		await ctx.fileTree.refresh();
		ctx.onMessage(`Deleted ${targetPath}`);
		return true;
	} catch (err) {
		ctx.onError(`Could not delete: ${String(err)}`);
		return false;
	}
}

// ── Bulk tree actions ─────────────────────────────────────────────────────────

export async function handleRefreshTree(ctx: ExplorerActionContext): Promise<void> {
	await ctx.fileTree.refresh();
	ctx.onMessage('Explorer refreshed');
}

export function handleExpandAll(ctx: ExplorerActionContext): void {
	const allDirs = getAllDirectoryPaths(ctx.tree);
	let count = 0;
	for (const path of allDirs) {
		if (!ctx.fileTree.isExpanded(path)) {
			ctx.fileTree.toggleDir(path);
			count++;
		}
	}
	ctx.onMessage(count > 0 ? `Expanded ${count} folder(s)` : 'All folders already expanded');
}

export function handleCollapseAll(ctx: ExplorerActionContext): void {
	const allDirs = getAllDirectoryPaths(ctx.tree);
	let count = 0;
	for (const path of allDirs) {
		if (ctx.fileTree.isExpanded(path)) {
			ctx.fileTree.toggleDir(path);
			count++;
		}
	}
	ctx.onMessage(count > 0 ? `Collapsed ${count} folder(s)` : 'All folders already collapsed');
}

export async function handleRefreshAndExpandAll(ctx: ExplorerActionContext): Promise<void> {
	await ctx.fileTree.refresh();
	handleExpandAll(ctx);
	ctx.onMessage('Explorer synced');
}
