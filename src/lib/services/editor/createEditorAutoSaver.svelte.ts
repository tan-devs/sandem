import { useConvexClient } from 'convex-svelte';
import { api } from '$convex/_generated/api.js';
import type { Doc, Id } from '$convex/_generated/dataModel.js';

type ProjectDoc = Doc<'projects'>;

export type AutoSaveStatus =
	| 'Saved'
	| 'Saving...'
	| 'Unsaved changes'
	| 'Session only'
	| 'Save failed';

/**
 * Debounced Convex persistence for editor content.
 *
 * Gracefully degrades to 'Session only' when there is no ConvexProvider
 * in the tree (demo / offline routes) — all calls become no-ops.
 *
 * Teardown: always call `drainAndCleanup()` before destroying the editor.
 * It flushes any pending saves before the runtime is torn down.
 */
export function createEditorAutoSaver(getProject: () => ProjectDoc | undefined) {
	let convexClient: ReturnType<typeof useConvexClient> | null = null;
	try {
		convexClient = useConvexClient();
	} catch {
		// No ConvexProvider — demo / offline mode.
	}

	let saveStatus = $state<AutoSaveStatus>('Saved');
	let saveTimeout: ReturnType<typeof setTimeout> | undefined;

	// path → latest content. Last-write-wins within a debounce window.
	const pendingSaves = new Map<string, string>();

	function queuePendingSave(path: string, content: string) {
		pendingSaves.set(path, content);
	}

	function queuePendingSaveBatch(changes: ReadonlyArray<{ path: string; content: string }>) {
		for (const { path, content } of changes) {
			queuePendingSave(path, content);
		}
	}

	async function flushPendingSaves() {
		const project = getProject();
		const projectId: Id<'projects'> | undefined = project?._id;

		if (!convexClient || !projectId) {
			pendingSaves.clear();
			saveStatus = 'Session only';
			return;
		}

		if (pendingSaves.size === 0) {
			saveStatus = 'Saved';
			return;
		}

		saveStatus = 'Saving...';
		const snapshot = new Map(pendingSaves);
		pendingSaves.clear();

		try {
			await Promise.all(
				Array.from(snapshot.entries()).map(([path, content]) =>
					convexClient!.mutation(api.filesystem.upsertFile, { projectId, path, content })
				)
			);
			saveStatus = 'Saved';
		} catch (err) {
			console.error('[AutoSaver] Save failed', err);
			// Re-queue failed saves without overwriting newer in-flight content.
			for (const [path, content] of snapshot) {
				if (!pendingSaves.has(path)) pendingSaves.set(path, content);
			}
			saveStatus = 'Save failed';
		}
	}

	/** Call only on local user input — not on remote Yjs syncs. */
	function triggerAutoSave(path: string, content: string) {
		triggerAutoSaveBatch([{ path, content }]);
	}

	/** Call when a sync cycle produces multiple touched files. */
	function triggerAutoSaveBatch(changes: ReadonlyArray<{ path: string; content: string }>) {
		if (changes.length === 0) return;

		if (!convexClient || !getProject()?._id) {
			saveStatus = 'Session only';
			return;
		}

		queuePendingSaveBatch(changes);
		saveStatus = 'Unsaved changes';
		clearTimeout(saveTimeout);
		saveTimeout = setTimeout(flushPendingSaves, 1500);
	}

	/** Force an immediate flush — useful on tab switch or beforeunload. */
	async function forceSave(path: string, content: string) {
		queuePendingSave(path, content);
		clearTimeout(saveTimeout);
		await flushPendingSaves();
	}

	/**
	 * Flush queued saves and stop the debounce timer.
	 * The single correct teardown call — use it in shutdown() before destroy().
	 */
	async function drainAndCleanup() {
		clearTimeout(saveTimeout);
		await flushPendingSaves();
	}

	return {
		get status() {
			return saveStatus;
		},
		triggerAutoSave,
		triggerAutoSaveBatch,
		forceSave,
		drainAndCleanup
	};
}
