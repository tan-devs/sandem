type NodeShape = { path: string; type: 'file' | 'folder'; content?: string };

/**
 * Convert a flat node list into the nested object tree for WebContainer mount().
 */
export function buildWebContainerTree(nodes: NodeShape[]): Record<string, unknown> {
	const root: Record<string, unknown> = {};

	for (const node of [...nodes].sort((a, b) => a.path.localeCompare(b.path))) {
		const segments = node.path.replace(/^\//, '').split('/').filter(Boolean);
		if (segments.length === 0) continue;

		let cursor = root;
		for (let i = 0; i < segments.length - 1; i++) {
			const seg = segments[i];
			if (!cursor[seg]) cursor[seg] = { directory: {} };
			cursor = (cursor[seg] as { directory: Record<string, unknown> }).directory;
		}

		const leaf = segments[segments.length - 1];
		if (node.type === 'folder') {
			cursor[leaf] = cursor[leaf] ?? { directory: {} };
		} else {
			cursor[leaf] = { file: { contents: node.content ?? '' } };
		}
	}

	return root;
}
