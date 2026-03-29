import * as Y from 'yjs';
import type { Project } from '$lib/context';
import type { EditorRuntimeDependencies } from '$types/hooks.js';

export type PersistPayload = {
	activePath: string;
	projectFileName: string;
	content: string;
};

export type PersistMetrics = {
	payloads: PersistPayload[];
	changedFiles: number;
	totalFiles: number;
};

/**
 * Snapshots the current Yjs text content for every project file into
 * `lastPersistedByFile`. Call this once after the initial collaborative sync
 * so that the first diff starts from the correct baseline rather than empty.
 *
 * Pure in effect: only mutates the map you pass in.
 */
export function seedPersistSignatures(
	ydoc: Y.Doc,
	project: Project,
	lastPersistedByFile: Map<string, string>
) {
	lastPersistedByFile.clear();
	const projectFiles = project.nodes ?? [];
	for (const file of projectFiles) {
		lastPersistedByFile.set(file.name, ydoc.getText(file.name).toString());
	}
}

/**
 * Compares the current Yjs text content for each project file against the last
 * persisted snapshot. Returns only the files that have changed, along with
 * their resolved web paths and updated content.
 *
 * Pure: reads ydoc and lastPersistedByFile, writes back to lastPersistedByFile
 * for changed entries, returns payloads — no timers, no async, no side effects
 * beyond the map mutation.
 */
export function diffYDocFiles(
	ydoc: Y.Doc,
	project: Project,
	lastPersistedByFile: Map<string, string>,
	toWebPath: EditorRuntimeDependencies['toWebPath']
): PersistMetrics {
	const projectFiles = project.nodes ?? [];
	const payloads: PersistPayload[] = [];

	for (const file of projectFiles) {
		const content = ydoc.getText(file.name).toString();
		const previous = lastPersistedByFile.get(file.name);
		if (previous === content) continue;

		lastPersistedByFile.set(file.name, content);
		payloads.push({
			activePath: toWebPath(file.name),
			projectFileName: file.name,
			content
		});
	}

	return {
		payloads,
		changedFiles: payloads.length,
		totalFiles: projectFiles.length
	};
}
