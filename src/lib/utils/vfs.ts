import type { FileSystemTree, DirectoryNode, FileNode, SymlinkNode } from '@webcontainer/api';
import type { Project } from '$lib/context/webcontainer/ide-context.js';
import { slugifyProjectName } from '$lib/utils';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function isDirectoryNode(node: DirectoryNode | FileNode | SymlinkNode): node is DirectoryNode {
	return 'directory' in node;
}

// ---------------------------------------------------------------------------
// Tree builders
// ---------------------------------------------------------------------------

/**
 * Build a WebContainer `FileSystemTree` from a flat list of
 * `{ path, type, content }` records — the shape stored in the `nodes` table.
 *
 * Node paths are absolute project-relative (e.g. "/src/App.tsx").
 * Leading slashes are stripped before insertion.
 *
 * If a file node is encountered where a directory already exists (or vice
 * versa), the directory wins — file content is silently dropped to keep the
 * tree valid.
 */
export function buildFileSystemTree(
	nodes: Array<{ path: string; type: 'file' | 'folder'; content?: string }>
): FileSystemTree {
	const tree: FileSystemTree = {};

	for (const node of nodes) {
		const parts = node.path.replace(/^\//, '').split('/').filter(Boolean);
		let cursor: FileSystemTree = tree;

		for (let i = 0; i < parts.length; i++) {
			const part = parts[i]!;
			const isLeaf = i === parts.length - 1;

			if (isLeaf) {
				if (node.type === 'file') {
					cursor[part] = { file: { contents: node.content ?? '' } };
				} else {
					cursor[part] ??= { directory: {} };
				}
			} else {
				cursor[part] ??= { directory: {} };
				const next = cursor[part];
				if (isDirectoryNode(next)) {
					cursor = next.directory;
				} else {
					// A file node was found mid-path — coerce to directory.
					cursor[part] = { directory: {} };
					cursor = (cursor[part] as DirectoryNode).directory;
				}
			}
		}
	}

	return tree;
}

/**
 * Recursively merge `overlay` into `base`, mutating `base` in place.
 * Directories are merged deeply; files are overwritten by overlay.
 * Returns `base` for convenience.
 */
export function mergeFileSystemTrees(
	base: FileSystemTree,
	overlay: FileSystemTree
): FileSystemTree {
	for (const key of Object.keys(overlay)) {
		const baseNode = base[key];
		const overlayNode = overlay[key]!;

		if (!baseNode) {
			base[key] = overlayNode;
			continue;
		}

		if (isDirectoryNode(baseNode) && isDirectoryNode(overlayNode)) {
			mergeFileSystemTrees(baseNode.directory, overlayNode.directory);
		} else {
			// Overlay wins for type conflicts.
			base[key] = overlayNode;
		}
	}

	return base;
}

/**
 * Build the multi-project WebContainer workspace tree from a list of
 * `Project` records.
 *
 * Each project gets its own top-level directory named after its slugified
 * `name` (e.g. "my-web-app"). A root `package.json` with `workspaces: ["*"]`
 * is included automatically.
 *
 * Additional root files (e.g. a workspace-level `.npmrc`) can be passed via
 * `rootFiles`.
 */
export function buildWorkspaceTree(
	projects: Project[],
	rootFiles: Array<{ path: string; content: string }> = []
): FileSystemTree {
	const tree: FileSystemTree = {
		'package.json': {
			file: {
				contents: JSON.stringify(
					{ name: 'sandem-workspace', private: true, version: '0.0.0', workspaces: ['*'] },
					null,
					2
				)
			}
		}
	};

	// Root-level extra files (workspace config, dotfiles, etc.)
	for (const file of rootFiles) {
		const parts = file.path
			.replace(/^[/\\]+/, '')
			.split('/')
			.filter(Boolean);
		let cursor: FileSystemTree = tree;
		for (let i = 0; i < parts.length; i++) {
			const part = parts[i]!;
			const isLeaf = i === parts.length - 1;
			if (isLeaf) {
				cursor[part] = { file: { contents: file.content ?? '' } };
			} else {
				cursor[part] ??= { directory: {} };
				cursor = (cursor[part] as DirectoryNode).directory;
			}
		}
	}

	// One directory per project, named by slugified project name.
	for (const project of projects) {
		const folderName = slugifyProjectName(project.name);

		tree[folderName] ??= { directory: {} };

		const projectTree = buildFileSystemTree(
			project.nodes.map((n) => ({ path: n.path, type: n.type, content: n.content }))
		);

		mergeFileSystemTrees((tree[folderName] as DirectoryNode).directory, projectTree);
	}

	return tree;
}
