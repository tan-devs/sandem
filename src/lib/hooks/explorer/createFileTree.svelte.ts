// src/lib/hooks/explorer/createFileTree.svelte.ts
import type { WebContainer } from '@webcontainer/api';
import type { FileNode } from '../../../types/editor.js';

export type { FileNode } from '../../../types/editor.js';

async function readDirRecursive(wc: WebContainer, dirPath: string, depth = 0): Promise<FileNode[]> {
	// Skip common noise directories
	const IGNORE = new Set(['.git', 'node_modules', '.svelte-kit', 'dist', '.cache']);

	const entries = await wc.fs.readdir(dirPath, { withFileTypes: true });
	const relevantEntries = entries.filter((entry) => !IGNORE.has(entry.name));

	const nodes = await Promise.all(
		relevantEntries.map(async (entry) => {
			const fullPath = dirPath === '.' ? entry.name : `${dirPath}/${entry.name}`;

			if (entry.isDirectory()) {
				const children = await readDirRecursive(wc, fullPath, depth + 1);
				return { name: entry.name, path: fullPath, type: 'directory', children, depth } as FileNode;
			}

			return { name: entry.name, path: fullPath, type: 'file', depth } as FileNode;
		})
	);

	// Directories first, then files — both sorted alphabetically
	return nodes.sort((a, b) => {
		if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
		return a.name.localeCompare(b.name);
	});
}

function createSignature(nodes: FileNode[]): string {
	const out: string[] = [];

	function walk(list: FileNode[]) {
		for (const node of list) {
			out.push(`${node.type}:${node.path}`);
			if (node.children) walk(node.children);
		}
	}

	walk(nodes);
	return out.join('|');
}

export function createFileTree(getWebcontainer: () => WebContainer) {
	let tree = $state<FileNode[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let refreshTimer = $state<ReturnType<typeof setInterval> | null>(null);
	let lastSignature = $state('');

	// Track which directories are open in the UI
	let expanded = $state<Record<string, true>>({ '.': true });

	async function refresh(options?: { silent?: boolean }) {
		if (!options?.silent) loading = true;
		error = null;
		try {
			const nextTree = await readDirRecursive(getWebcontainer(), '.');
			const nextSignature = createSignature(nextTree);

			if (nextSignature !== lastSignature) {
				tree = nextTree;
				lastSignature = nextSignature;
			}
		} catch (err) {
			error = String(err);
		} finally {
			if (!options?.silent) loading = false;
		}
	}

	function toggleDir(path: string) {
		if (expanded[path]) {
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			const { [path]: _removed, ...rest } = expanded;
			expanded = rest;
		} else {
			expanded = { ...expanded, [path]: true };
		}
	}

	function isExpanded(path: string) {
		return !!expanded[path];
	}

	function startAutoRefresh(intervalMs = 1000) {
		if (refreshTimer) return;
		refreshTimer = setInterval(() => {
			refresh({ silent: true });
		}, intervalMs);
	}

	function stopAutoRefresh() {
		if (!refreshTimer) return;
		clearInterval(refreshTimer);
		refreshTimer = null;
	}

	return {
		get tree() {
			return tree;
		},
		get loading() {
			return loading;
		},
		get error() {
			return error;
		},
		refresh,
		toggleDir,
		isExpanded,
		startAutoRefresh,
		stopAutoRefresh
	};
}
