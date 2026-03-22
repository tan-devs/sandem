import type { WebContainer } from '@webcontainer/api';
import type { FileNode } from '$types/editor.js';
import {
	readDirRecursive,
	createSignature,
	pruneExpandedState as pruneExpandedStatePure
} from '$lib/utils/editor/fileTreeOps.js';

export type { FileNode } from '$types/editor.js';

type CreateFileTreeOptions = {
	getWorkspaceRootFolders?: () => string[];
};

function toErrorMessage(error: unknown): string {
	if (error instanceof Error) return error.message;
	return String(error);
}

export function createFileTree(
	getWebcontainer: () => WebContainer,
	options: CreateFileTreeOptions = {}
) {
	let tree = $state<FileNode[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let refreshTimer = $state<ReturnType<typeof setInterval> | null>(null);
	let lastSignature = $state('');
	let refreshInFlight: Promise<void> | null = null;
	let refreshInFlightSilent = false;

	let expanded = $state<Record<string, true>>({});

	function getWorkspaceRootFolders(): ReadonlySet<string> {
		const folders = options.getWorkspaceRootFolders?.() ?? [];
		return new Set(folders.map((folder) => folder.trim()).filter(Boolean));
	}

	function isReady() {
		try {
			const wc = getWebcontainer();
			return !!wc;
		} catch {
			return false;
		}
	}

	async function refresh(options?: { silent?: boolean }) {
		const isSilent = !!options?.silent;

		if (refreshInFlight) {
			if (!isSilent && refreshInFlightSilent) {
				await refreshInFlight;
			} else {
				return refreshInFlight;
			}
		}

		const run = (async () => {
			if (!isSilent) loading = true;
			if (!isSilent) {
				error = null;
			}

			try {
				const wc = getWebcontainer();

				// Check if WebContainer is ready
				if (!wc) {
					throw new Error('WebContainer not initialized');
				}

				const rootFolders = getWorkspaceRootFolders();
				const nextTree = await readDirRecursive(wc, '.', rootFolders);
				const nextSignature = createSignature(nextTree);

				if (nextSignature !== lastSignature) {
					tree = nextTree;
					lastSignature = nextSignature;
					expanded = pruneExpandedStatePure(expanded, nextTree);
					if (!isSilent) console.log('[FileTree] Loaded', nextTree.length, 'root nodes');
				}

				// Clear stale errors after any successful refresh, including silent polling.
				error = null;
			} catch (err) {
				const message = toErrorMessage(err);
				const isNotReady =
					message.includes('WebContainer not ready') ||
					message.includes('WebContainer not initialized');

				// For "not ready" errors, don't display them - just silently retry
				// This prevents the UI from showing transient WebContainer initialization errors
				if (!isNotReady) {
					error = message;
				}
				console.warn('[FileTree.refresh]', { isSilent, message, isNotReady });
			} finally {
				refreshInFlight = null;
				refreshInFlightSilent = false;
				if (!isSilent) loading = false;
			}
		})();

		refreshInFlightSilent = isSilent;
		refreshInFlight = run;
		return run;
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
		console.log('[FileTree] Starting auto-refresh with interval', intervalMs);
		refreshTimer = setInterval(() => {
			void refresh({ silent: true });
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
		isReady,
		refresh,
		toggleDir,
		isExpanded,
		startAutoRefresh,
		stopAutoRefresh
	};
}
