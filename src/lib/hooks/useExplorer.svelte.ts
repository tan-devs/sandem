/**
 * Explorer lifecycle hook.
 *
 * Must be called during component script evaluation (Svelte 5 requirement
 * for $effect registration). Registers reactive effects that bridge store
 * state → UI side effects. Returns mount() for onMount-time setup.
 *
 * Registered $effects:
 *   • Search expansion: when a query is active, auto-expand directories
 *     that contain matching results.
 *
 * mount() handles:
 *   • Keyboard shortcuts (Cmd/Ctrl+N, Shift+N, F2, Delete, Escape)
 *   • Pointer dismissal (closes context menu on outside click)
 *   • File tree auto-refresh + stabilised bootstrap loop
 *
 * Returns a cleanup function — pass directly to onMount() so Svelte
 * auto-calls it on component destroy.
 */

import type { ExplorerController } from '$lib/controllers/explorer';

export function useExplorer(explorer: ExplorerController, getActivityTab: () => string) {
	// ── $effect: search → auto-expand matching directories ───────────────────
	$effect(() => {
		if (!explorer.hasSearch) return;
		for (const path of explorer.expandOnSearch) {
			if (!explorer.isExpanded(path)) explorer.toggleDir(path);
		}
	});

	// ── mount() — runs in onMount, returns cleanup ────────────────────────────
	function mount(): () => void {
		// ── Keyboard shortcuts ─────────────────────────────────────────────────
		function onKeyDown(event: KeyboardEvent): void {
			if (getActivityTab() !== 'explorer') return;

			const target = event.target as HTMLElement | null;
			if (
				target instanceof HTMLInputElement ||
				target instanceof HTMLTextAreaElement ||
				target instanceof HTMLSelectElement ||
				target?.isContentEditable
			)
				return;

			const cmdOrCtrl = event.metaKey || event.ctrlKey;

			if (cmdOrCtrl && !event.shiftKey && event.key.toLowerCase() === 'n') {
				event.preventDefault();
				explorer.openCreateDialog('file');
				return;
			}
			if (cmdOrCtrl && event.shiftKey && event.key.toLowerCase() === 'n') {
				event.preventDefault();
				explorer.openCreateDialog('folder');
				return;
			}
			if (event.key === 'F2') {
				event.preventDefault();
				explorer.openRenameDialog();
				return;
			}
			if (event.key === 'Delete') {
				event.preventDefault();
				explorer.openDeleteDialog();
				return;
			}
			if (event.key === 'Escape') {
				if (explorer.dialogState.open) {
					explorer.closeDialog();
					return;
				}
				explorer.closeContextMenu();
			}
		}

		// ── Pointer dismissal ──────────────────────────────────────────────────
		function onPointerDown(): void {
			if (explorer.contextMenu.open) explorer.closeContextMenu();
		}

		window.addEventListener('keydown', onKeyDown);
		window.addEventListener('pointerdown', onPointerDown);

		// ── Auto-refresh ───────────────────────────────────────────────────────
		explorer.fileTree.startAutoRefresh(850);

		// ── Bootstrap loop: poll until tree stabilises ─────────────────────────
		// Handles the race between WebContainer boot and first tree read.
		explorer.fileTree.refresh({ silent: true }).then(() => {
			let previousLength = 0;
			let stabilizedCount = 0;

			const runBootstrap = async () => {
				for (let i = 0; i < 80; i++) {
					await explorer.fileTree.refresh({ silent: true });
					const current = explorer.fileTree.tree.length;

					if (current === 0) {
						stabilizedCount = 0;
					} else if (current === previousLength) {
						stabilizedCount++;
						if (stabilizedCount >= 3) break;
					} else {
						stabilizedCount = 0;
					}

					previousLength = current;
					await new Promise<void>((r) => setTimeout(r, 300));
				}
			};

			runBootstrap().catch(() => {
				/* bootstrap failed — auto-refresh will continue polling */
			});
		});

		// ── Cleanup ────────────────────────────────────────────────────────────
		return () => {
			window.removeEventListener('keydown', onKeyDown);
			window.removeEventListener('pointerdown', onPointerDown);
			explorer.fileTree.stopAutoRefresh();
			explorer.projectSync.stop();
			explorer.reset();
		};
	}

	return { mount };
}
