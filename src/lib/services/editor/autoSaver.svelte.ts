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
 * The autoSaver only needs the project's _id to call `upsertFile`.
 * Pass the full ProjectSummary so callers don't have to unwrap it.
 */
export function createAutoSaver(getProject: () => ProjectDoc | undefined) {
	// Gracefully degrade when there is no ConvexProvider in the tree
	// (e.g. the /shop demo route). In that case every call is a no-op and
	// the status stays 'Saved' so the Editor UI looks clean.
	let convexClient: ReturnType<typeof useConvexClient> | null = null;
	try {
		convexClient = useConvexClient();
	} catch {
		// No provider — demo / offline mode
	}

	let saveStatus = $state<AutoSaveStatus>('Saved');
	let saveTimeout: ReturnType<typeof setTimeout> | undefined;

	// path -> latest content to save. Last-write-wins within a debounce window.
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

		// No-op in demo/guest mode (no persisted project)
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
			// Fire all upserts in parallel — filesystem.upsertFile handles
			// insert-or-update and parent folder creation server-side.
			await Promise.all(
				Array.from(snapshot.entries()).map(([path, content]) =>
					convexClient!.mutation(api.filesystem.upsertFile, { projectId, path, content })
				)
			);

			saveStatus = 'Saved';
		} catch (err) {
			console.error('[AutoSaver] Save failed', err);
			// Re-queue failed saves — don't overwrite if a newer save came in during the flight
			for (const [path, content] of snapshot) {
				if (!pendingSaves.has(path)) {
					pendingSaves.set(path, content);
				}
			}
			saveStatus = 'Save failed';
		}
	}

	/** Call only on local user input (not remote Yjs syncs). */
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

	/** Force an immediate save — useful on tab switch or beforeunload. */
	async function forceSave(path: string, content: string) {
		queuePendingSave(path, content);
		clearTimeout(saveTimeout);
		await flushPendingSaves();
	}

	function cleanup() {
		clearTimeout(saveTimeout);
	}

	/**
	 * Flushes queued autosave mutations and stops the timer.
	 * Intended for deterministic teardown paths.
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
		drainAndCleanup,
		cleanup
	};
}
