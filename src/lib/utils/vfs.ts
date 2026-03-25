import type { FileSystemTree } from '@webcontainer/api';

export function buildFileSystemTree(
	nodes: Array<{ path: string; type: 'file' | 'folder'; content?: string }>
): FileSystemTree {
	const tree: FileSystemTree = {};

	for (const node of nodes) {
		const parts = node.path.replace(/^\//, '').split('/').filter(Boolean);
		let cursor: any = tree;

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
				cursor = cursor[part].directory;
			}
		}
	}

	return tree;
}
