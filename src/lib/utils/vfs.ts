import type { FileSystemTree, DirectoryNode, FileNode, SymlinkNode } from '@webcontainer/api';

function isDirectoryNode(node: DirectoryNode | FileNode | SymlinkNode): node is DirectoryNode {
	return 'directory' in node;
}

export function buildFileSystemTree(
	nodes: Array<{ path: string; type: 'file' | 'folder'; content?: string }>
): FileSystemTree {
	const tree: FileSystemTree = {};

	for (const node of nodes) {
		const parts = node.path.replace(/^\//, '').split('/').filter(Boolean);
		let cursor: FileSystemTree = tree;

		for (let i = 0; i < parts.length; i++) {
			const part = parts[i];
			const isLeaf = i === parts.length - 1;

			if (isLeaf) {
				if (node.type === 'file') {
					cursor[part] = { file: { contents: node.content ?? '' } };
				} else {
					cursor[part] = cursor[part] ?? { directory: {} };
				}
			} else {
				cursor[part] = cursor[part] ?? { directory: {} };
				const nextNode = cursor[part];
				if (isDirectoryNode(nextNode)) {
					cursor = nextNode.directory;
				} else {
					// Existing file node was found in path; coerce to directory to continue tree creation
					cursor[part] = { directory: {} };
					cursor = cursor[part].directory;
				}
			}
		}
	}

	return tree;
}

export function mergeFileSystemTrees(
	base: FileSystemTree,
	overlay: FileSystemTree
): FileSystemTree {
	for (const key of Object.keys(overlay)) {
		if (!base[key]) {
			base[key] = overlay[key];
			continue;
		}

		const baseNode = base[key];
		const overlayNode = overlay[key];

		if (isDirectoryNode(baseNode) && isDirectoryNode(overlayNode)) {
			mergeFileSystemTrees(baseNode.directory, overlayNode.directory);
		} else if (isDirectoryNode(overlayNode)) {
			base[key] = { directory: overlayNode.directory };
		} else if (!isDirectoryNode(overlayNode)) {
			base[key] = overlayNode;
		}
	}

	return base;
}

export function buildWorkspaceTree(
	projects: Array<{
		_id: string;
		title?: string;
		name?: string;
		files?: Array<{ name: string; contents: string }>;
	}>,
	rootFiles: Array<{ name: string; contents: string }> = []
): FileSystemTree {
	const tree: FileSystemTree = {
		'package.json': {
			file: {
				contents: JSON.stringify(
					{
						name: 'sandem-workspace',
						private: true,
						version: '0.0.0',
						workspaces: ['*']
					},
					null,
					2
				)
			}
		}
	};

	for (const file of rootFiles) {
		const parts = file.name
			.replace(/^[\\/]+/, '')
			.split('/')
			.filter(Boolean);
		let cursor: FileSystemTree = tree;

		for (let i = 0; i < parts.length; i++) {
			const part = parts[i];
			const isLeaf = i === parts.length - 1;
			if (isLeaf) {
				cursor[part] = { file: { contents: file.contents ?? '' } };
			} else {
				if (!cursor[part]) cursor[part] = { directory: {} };
				cursor = (cursor[part] as { directory: FileSystemTree }).directory;
			}
		}
	}

	for (const project of projects) {
		const folderName = project.title
			? project.title.replace(/\s+/g, '-')
			: (project.name ?? project._id);
		if (!tree[folderName]) {
			tree[folderName] = { directory: {} };
		}

		const projectFiles = project.files ?? [];
		const projectTree = buildFileSystemTree(
			projectFiles.map((file) => ({ path: file.name, type: 'file', content: file.contents }))
		);

		mergeFileSystemTrees(
			(tree[folderName] as { directory: FileSystemTree }).directory,
			projectTree
		);
	}

	return tree;
}
