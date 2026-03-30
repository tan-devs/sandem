/**
 * WebContainer filesystem reader with signature-based change detection
 * and adaptive auto-refresh.
 *
 * Philosophy: owns its own $state (tree, loading, error, expanded).
 * Callers drive it via refresh() / toggleDir() / start|stopAutoRefresh().
 * No component imports. No Convex. No Liveblocks.
 */

import type { WebContainer } from '@webcontainer/api';
import type { FileNode } from '$types/editor.js';
import {
	readDirRecursive,
	createSignature,
	pruneExpandedState as pruneExpandedStatePure
} from '$lib/utils/explorer';

export type FileTreeServiceOptions = {
	getWorkspaceRootFolders?: () => string[];
};

export type FileTreeService = ReturnType<typeof createFileTree>;

function toErrorMessage(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}

export function createFileTree(
	getWebcontainer: () => WebContainer,
	options: FileTreeServiceOptions = {}
) {
	let tree = $state<FileNode[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);

	let expanded = $state<Record<string, true>>({});

	// ── Internal refresh tracking (plain vars — not reactive) ─────────────────
	let lastSignature = '';
	let lastRootFoldersSignature = '';
	let refreshInFlight: Promise<void> | null = null;
	let refreshInFlightSilent = false;
	let lastRefreshChanged = false;

	// ── Auto-refresh (plain vars) ─────────────────────────────────────────────
	let autoRefreshRunning = false;
	let autoRefreshBaseIntervalMs = 1000;
	let stableRefreshCount = 0;
	let refreshTimer: ReturnType<typeof setTimeout> | null = null;

	const MAX_INTERVAL_MS = 6000;

	// ── Helpers ───────────────────────────────────────────────────────────────

	function getWorkspaceRootFolders(): ReadonlySet<string> {
		const folders = options.getWorkspaceRootFolders?.() ?? [];
		return new Set(folders.map((f) => f.trim()).filter(Boolean));
	}

	function isReady(): boolean {
		try {
			return !!getWebcontainer();
		} catch {
			return false;
		}
	}

	// ── Refresh ───────────────────────────────────────────────────────────────

	async function refresh(opts?: { silent?: boolean }): Promise<void> {
		const isSilent = !!opts?.silent;

		// Deduplicate in-flight requests.
		if (refreshInFlight) {
			if (!isSilent && refreshInFlightSilent) {
				await refreshInFlight;
			} else {
				return refreshInFlight;
			}
		}

		const run = (async () => {
			if (!isSilent) {
				loading = true;
				error = null;
			}

			let changed = false;

			try {
				const wc = getWebcontainer();
				if (!wc) throw new Error('WebContainer not initialized');

				const rootFolders = getWorkspaceRootFolders();
				const rootFoldersArray = Array.from(rootFolders).sort();
				const nextRootFoldersSignature = rootFoldersArray.join('|');

				const nextTree = await readDirRecursive(wc, '.', rootFolders);
				const nextSignature = createSignature(nextTree);

				const shouldUpdate =
					nextSignature !== lastSignature ||
					nextRootFoldersSignature !== lastRootFoldersSignature ||
					tree.length === 0;

				if (shouldUpdate) {
					tree = nextTree;
					lastSignature = nextSignature;
					lastRootFoldersSignature = nextRootFoldersSignature;
					expanded = pruneExpandedStatePure(expanded, nextTree);
					changed = true;
				}

				// Clear stale errors after any successful refresh.
				error = null;
			} catch (err) {
				const message = toErrorMessage(err);
				const isNotReady =
					message.includes('WebContainer not ready') ||
					message.includes('WebContainer not initialized');

				// Suppress transient init errors — they self-heal.
				if (!isNotReady) error = message;
			} finally {
				lastRefreshChanged = changed;
				if (!isSilent) stableRefreshCount = 0;
				refreshInFlight = null;
				refreshInFlightSilent = false;
				if (!isSilent) loading = false;
			}
		})();

		refreshInFlightSilent = isSilent;
		refreshInFlight = run;
		return run;
	}

	// ── Expanded state ────────────────────────────────────────────────────────

	function toggleDir(path: string): void {
		if (expanded[path]) {
			const { [path]: _removed, ...rest } = expanded;
			expanded = rest;
		} else {
			expanded = { ...expanded, [path]: true };
		}
	}

	function isExpanded(path: string): boolean {
		return !!expanded[path];
	}

	// ── Adaptive auto-refresh ─────────────────────────────────────────────────

	function getNextRefreshDelayMs(): number {
		if (tree.length === 0) return Math.min(autoRefreshBaseIntervalMs, 900);
		if (stableRefreshCount < 2) return autoRefreshBaseIntervalMs;
		if (stableRefreshCount < 6) return Math.min(autoRefreshBaseIntervalMs * 2, MAX_INTERVAL_MS);
		if (stableRefreshCount < 12) return Math.min(autoRefreshBaseIntervalMs * 4, MAX_INTERVAL_MS);
		return Math.min(autoRefreshBaseIntervalMs * 6, MAX_INTERVAL_MS);
	}

	function scheduleAutoRefresh(delayMs: number): void {
		if (!autoRefreshRunning) return;
		if (refreshTimer) clearTimeout(refreshTimer);

		refreshTimer = setTimeout(
			async () => {
				if (!autoRefreshRunning) return;
				await refresh({ silent: true });
				stableRefreshCount = lastRefreshChanged ? 0 : stableRefreshCount + 1;
				scheduleAutoRefresh(getNextRefreshDelayMs());
			},
			Math.max(150, delayMs)
		);
	}

	function startAutoRefresh(intervalMs = 1000): void {
		if (autoRefreshRunning) return;
		autoRefreshRunning = true;
		autoRefreshBaseIntervalMs = Math.max(300, intervalMs);
		stableRefreshCount = 0;
		scheduleAutoRefresh(autoRefreshBaseIntervalMs);
	}

	function stopAutoRefresh(): void {
		autoRefreshRunning = false;
		if (refreshTimer) {
			clearTimeout(refreshTimer);
			refreshTimer = null;
		}
		stableRefreshCount = 0;
	}

	// ── Public API ────────────────────────────────────────────────────────────

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
