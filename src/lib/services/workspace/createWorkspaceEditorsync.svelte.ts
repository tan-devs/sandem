/**
 * createWorkspaceEditorSync.svelte.ts
 *
 * Single source-of-truth bridge for the collaborative IDE editor.
 *
 *   Liveblocks Yjs doc  ──(every change)──►  WebContainer fs.writeFile  (75 ms debounce)
 *                                        └──►  Convex upsertFile         (3 s debounce)
 *
 * Wired in WorkspaceController via:
 *   getWebcontainer  — () => runtime.getWebcontainer()
 *   getWorkspaceRoot — () => projectFolderName(runtime.activeProject._id, ...)
 *   persistFile      — convexClient.mutation(api.filesystem.upsertFile, ...)
 *
 * Usage per opened editor tab:
 *
 *   editorSync.watch(path, ydoc)   // on file open  — binds Monaco model to ydoc first
 *   await editorSync.flush(path)   // on file close — drains pending debounces
 *   editorSync.unwatch(path)       // on file close
 *   await editorSync.flushAll()    // on CMD+S
 *   editorSync.destroy()           // on layout unmount (returned from onMount cleanup)
 */

import * as Y from 'yjs';
import type { WebContainer } from '@webcontainer/api';

// ─── Public surface ───────────────────────────────────────────────────────────

export interface WorkspaceEditorSyncOptions {
	/** Returns the live WebContainer instance, or null while booting. */
	getWebcontainer: () => WebContainer | null;

	/**
	 * Persists file content to Convex (debounced 3 s).
	 * Wire to: convexClient.mutation(api.filesystem.upsertFile, { projectId, path, content })
	 */
	persistFile: (path: string, content: string) => Promise<void>;

	/**
	 * Returns the workspace-relative root prefix for the active project,
	 * e.g. "my-project-abc123". Used to resolve absolute WebContainer paths.
	 * Return '' if paths are already absolute.
	 */
	getWorkspaceRoot: () => string;

	/** ms — debounce before flushing to WebContainer. Default: 75 */
	wcDebounceMs?: number;

	/** ms — debounce before flushing to Convex. Default: 3000 */
	convexDebounceMs?: number;

	onError?: (target: 'webcontainer' | 'convex', path: string, err: unknown) => void;
}

export interface WorkspaceEditorSync {
	watch(filePath: string, ydoc: Y.Doc): void;
	unwatch(filePath: string): void;
	flush(filePath: string): Promise<void>;
	flushAll(): Promise<void>;
	destroy(): void;
}

// ─── Implementation ───────────────────────────────────────────────────────────

interface WatchState {
	ydoc: Y.Doc;
	cleanup: () => void;
	wcTimer: ReturnType<typeof setTimeout> | null;
	convexTimer: ReturnType<typeof setTimeout> | null;
	lastWc: string | null;
	lastConvex: string | null;
}

export function createWorkspaceEditorSync(opts: WorkspaceEditorSyncOptions): WorkspaceEditorSync {
	const { getWebcontainer, persistFile, getWorkspaceRoot, onError } = opts;
	const wcMs = opts.wcDebounceMs ?? 75;
	const convexMs = opts.convexDebounceMs ?? 3000;

	const watched = new Map<string, WatchState>();

	// ── Helpers ───────────────────────────────────────────────────────────────

	function getText(ydoc: Y.Doc): string {
		return ydoc.getText('content').toString();
	}

	function absPath(filePath: string): string {
		const root = getWorkspaceRoot().replace(/\/$/, '');
		if (!root || filePath.startsWith('/')) return filePath;
		return `${root}/${filePath.replace(/^\//, '')}`;
	}

	async function writeWC(filePath: string, content: string): Promise<void> {
		const wc = getWebcontainer();
		if (!wc) return;
		const path = absPath(filePath);
		const dir = path.substring(0, path.lastIndexOf('/'));
		try {
			if (dir) await wc.fs.mkdir(dir, { recursive: true });
			await wc.fs.writeFile(path, content, { encoding: 'utf-8' });
		} catch (err) {
			onError?.('webcontainer', filePath, err);
		}
	}

	async function writeConvex(filePath: string, content: string): Promise<void> {
		try {
			await persistFile(filePath, content);
		} catch (err) {
			onError?.('convex', filePath, err);
		}
	}

	// ── Core change handler ───────────────────────────────────────────────────

	function onYjsUpdate(filePath: string): void {
		const s = watched.get(filePath);
		if (!s) return;

		const content = getText(s.ydoc);

		if (s.wcTimer !== null) clearTimeout(s.wcTimer);
		s.wcTimer = setTimeout(() => {
			s.wcTimer = null;
			if (content === s.lastWc) return;
			s.lastWc = content;
			void writeWC(filePath, content);
		}, wcMs);

		if (s.convexTimer !== null) clearTimeout(s.convexTimer);
		s.convexTimer = setTimeout(() => {
			s.convexTimer = null;
			if (content === s.lastConvex) return;
			s.lastConvex = content;
			void writeConvex(filePath, content);
		}, convexMs);
	}

	// ── Public API ────────────────────────────────────────────────────────────

	function watch(filePath: string, ydoc: Y.Doc): void {
		unwatch(filePath); // safe no-op if not currently watched
		const handler = () => onYjsUpdate(filePath);
		ydoc.on('update', handler);
		watched.set(filePath, {
			ydoc,
			cleanup: () => ydoc.off('update', handler),
			wcTimer: null,
			convexTimer: null,
			lastWc: null,
			lastConvex: null
		});
		// Immediately sync initial content to WebContainer on open.
		void writeWC(filePath, getText(ydoc));
	}

	function unwatch(filePath: string): void {
		const s = watched.get(filePath);
		if (!s) return;
		s.cleanup();
		if (s.wcTimer !== null) clearTimeout(s.wcTimer);
		if (s.convexTimer !== null) clearTimeout(s.convexTimer);
		watched.delete(filePath);
	}

	async function flush(filePath: string): Promise<void> {
		const s = watched.get(filePath);
		if (!s) return;
		if (s.wcTimer !== null) {
			clearTimeout(s.wcTimer);
			s.wcTimer = null;
		}
		if (s.convexTimer !== null) {
			clearTimeout(s.convexTimer);
			s.convexTimer = null;
		}
		const content = getText(s.ydoc);
		s.lastWc = content;
		s.lastConvex = content;
		await Promise.all([writeWC(filePath, content), writeConvex(filePath, content)]);
	}

	async function flushAll(): Promise<void> {
		await Promise.all([...watched.keys()].map(flush));
	}

	function destroy(): void {
		for (const path of [...watched.keys()]) unwatch(path);
	}

	return { watch, unwatch, flush, flushAll, destroy };
}
