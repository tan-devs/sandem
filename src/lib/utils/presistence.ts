import * as Y from 'yjs';
import type { Project } from '$lib/context/ide-context.js';
import type { EditorRuntimeDependencies } from '$types/hooks.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PersistPayload = {
	/** Full WebContainer path, e.g. "my-project/src/App.tsx". */
	activePath: string;
	/** Absolute project-relative node path, e.g. "/src/App.tsx". Used as the Convex node key. */
	nodePath: string;
	content: string;
};

export type PersistMetrics = {
	payloads: PersistPayload[];
	changedFiles: number;
	totalFiles: number;
};

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Snapshots the current Yjs text content for every file node into
 * `lastPersistedByPath`. Call this once after the initial collaborative sync
 * so that the first diff starts from the correct baseline rather than empty.
 *
 * Yjs text entries are keyed by node path (e.g. "/src/App.tsx") — the same
 * key used when seeding the Yjs doc in `seedYDocFromNodes`.
 *
 * Pure in effect: only mutates the map you pass in.
 */
export function seedPersistSignatures(
	ydoc: Y.Doc,
	project: Project,
	lastPersistedByPath: Map<string, string>
) {
	lastPersistedByPath.clear();
	for (const node of project.nodes) {
		if (node.type !== 'file') continue;
		lastPersistedByPath.set(node.path, ydoc.getText(node.path).toString());
	}
}

/**
 * Compares the current Yjs text content for each file node against the last
 * persisted snapshot. Returns only the files that have changed, along with
 * their resolved WebContainer paths and updated content.
 *
 * Pure: reads ydoc and lastPersistedByPath, writes back to lastPersistedByPath
 * for changed entries, returns payloads — no timers, no async, no side effects
 * beyond the map mutation.
 */
export function diffYDocFiles(
	ydoc: Y.Doc,
	project: Project,
	lastPersistedByPath: Map<string, string>,
	toWebPath: EditorRuntimeDependencies['toWebPath']
): PersistMetrics {
	const fileNodes = project.nodes.filter((n) => n.type === 'file');
	const payloads: PersistPayload[] = [];

	for (const node of fileNodes) {
		const content = ydoc.getText(node.path).toString();
		const previous = lastPersistedByPath.get(node.path);
		if (previous === content) continue;

		lastPersistedByPath.set(node.path, content);
		payloads.push({
			activePath: toWebPath(node.path),
			nodePath: node.path,
			content
		});
	}

	return {
		payloads,
		changedFiles: payloads.length,
		totalFiles: fileNodes.length
	};
}
