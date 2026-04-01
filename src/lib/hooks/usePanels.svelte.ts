import type { PaneAPI } from 'paneforge';
import type { PanelsStore } from '$lib/stores/panels';
import type { PanelsService } from '$lib/services/panels';

// ---------------------------------------------------------------------------
// Deps
// ---------------------------------------------------------------------------

export interface UsePanelsDeps {
	store: PanelsStore;
	service: PanelsService;
	/**
	 * Returns the PaneAPI bound to the left sidebar pane.
	 * May be undefined before the component mounts — the effect guards on this.
	 */
	getSidebar: () => PaneAPI | undefined;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * usePanels
 *
 * Registers the $effect that mirrors store.leftPane → PaneAPI.expand/collapse.
 * Must be called at the top level of a Svelte component script (or inside
 * another hook called from there) so the effect runs in the correct context.
 *
 * This is the only place PaneAPI is touched in the panels system.
 * All other panel logic goes through PanelsService.
 */
export function usePanels(deps: UsePanelsDeps) {
	const { store, service } = deps;

	// Sync left pane store → PaneAPI whenever leftPane changes.
	// PaneAPI.expand/collapse are idempotent — safe to call even if already
	// in the target state.
	$effect(() => {
		const sidebar = deps.getSidebar();
		if (!sidebar) return;

		if (store.leftPane) {
			sidebar.expand();
		} else {
			sidebar.collapse();
		}
	});

	return {
		// Expose service surface so the controller only needs to hold usePanels
		setLeft: service.setLeft,
		setDown: service.setDown,
		setRight: service.setRight,
		toggleLeft: service.toggleLeft,
		toggleDown: service.toggleDown,
		toggleRight: service.toggleRight,
		resetAll: service.resetAll
	};
}
