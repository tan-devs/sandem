import type { ExplorerController } from '$lib/controllers/ExplorerContoller.svelte.js';

/**
 * Composes the Explorer's mount lifecycle: keyboard shortcuts, pointer
 * dismissal, and file tree auto-refresh.
 *
 * The $effects (entry file auto-open, search expansion) live in Explorer.svelte
 * since createExplorerController owns tree + search state directly.
 *
 * Call the returned `mount()` inside onMount — it returns a cleanup function.
 */
export function useExplorer(explorer: ExplorerController, getActivityTab: () => string) {
	function mount() {
		// ── Keyboard shortcuts ────────────────────────────────────────────────

		function onKeyDown(event: KeyboardEvent) {
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

		// ── Pointer dismissal ─────────────────────────────────────────────────

		function onPointerDown() {
			if (explorer.contextMenu.open) explorer.closeContextMenu();
		}

		window.addEventListener('keydown', onKeyDown);
		window.addEventListener('pointerdown', onPointerDown);

		// ── Auto-refresh + bootstrap ──────────────────────────────────────────

		explorer.fileTree.startAutoRefresh(850);

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
				/* bootstrap failed — continue anyway */
			});
		});

		// ── Cleanup ───────────────────────────────────────────────────────────

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
