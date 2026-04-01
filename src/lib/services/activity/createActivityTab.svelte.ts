import type { TabId, IDEPanels } from '$lib/stores/activity/index.js';

// ---------------------------------------------------------------------------
// Deps interface
// ---------------------------------------------------------------------------

export interface ActivityTabServiceDeps {
	/** Returns the currently active tab id from the store. */
	getActiveTab: () => TabId;
	/** Writes a new active tab id into the store. */
	setActiveTab: (tab: TabId) => void;
	/**
	 * Returns the current workspace panels object.
	 * May return undefined during SSR or before the workspace is mounted.
	 */
	getPanels: () => IDEPanels | undefined;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * createActivityTabService
 *
 * Owns the two core activity bar interactions:
 *
 * selectTab(id)
 *   — If the clicked tab is already active, toggle the left panel closed/open.
 *   — Otherwise switch to the new tab and force the left panel open.
 *
 * toggleSecondaryPanel()
 *   — Flips rightPane boolean on the panels object.
 *   — No-ops when rightPane is not a boolean (e.g. a Pane API object).
 *
 * Pure logic — no $state, no DOM, no side effects beyond mutating the
 * reactive panels object and calling setActiveTab.
 */
export function createActivityTabService(deps: ActivityTabServiceDeps) {
	function selectTab(id: TabId): void {
		const panels = deps.getPanels();
		if (!panels) return;

		if (deps.getActiveTab() === id) {
			// Same tab clicked — toggle sidebar visibility
			panels.leftPane = !panels.leftPane;
			return;
		}

		deps.setActiveTab(id);
		panels.leftPane = true;
	}

	function toggleSecondaryPanel(): void {
		const panels = deps.getPanels();
		if (!panels) return;
		if (typeof panels.rightPane !== 'boolean') return;
		panels.rightPane = !panels.rightPane;
	}

	return { selectTab, toggleSecondaryPanel };
}
