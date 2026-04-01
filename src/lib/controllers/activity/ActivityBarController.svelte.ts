import { useActivity } from '$lib/hooks/useActivity.svelte.js';
import type { IDEPanels } from '$lib/stores/activity/index.js';

// ---------------------------------------------------------------------------
// Options interface
// ---------------------------------------------------------------------------

export interface CreateActivityBarControllerOptions {
	/**
	 * Accessor for the workspace panels reactive object.
	 * Passed in from the component so the controller stays decoupled from
	 * any specific workspace implementation.
	 *
	 * Example:
	 *   createActivityBarController({ getPanels: () => workspaceCtrl.panels })
	 */
	getPanels: () => IDEPanels | undefined;
}

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

/**
 * createActivityBarController
 *
 * Thin adapter between useActivity and the ActivityBar component.
 * Responsibilities:
 *   1. Instantiate useActivity with the correct deps.
 *   2. Expose a mount() function the component calls in onMount.
 *   3. Forward only what the component needs — no internal state leaks.
 *
 * The component calls mount() → gets back the keyboard cleanup function.
 * Everything else (activeTab, tabs, actions) is accessed as plain properties.
 */
export function createActivityBarController(options: CreateActivityBarControllerOptions) {
	const activity = useActivity({ getPanels: options.getPanels });

	/**
	 * Call inside onMount in ActivityBar.svelte.
	 * Returns the keyboard listener teardown — pass it as the onMount return.
	 */
	function mount(): () => void {
		return activity.mountKeyboard();
	}

	return {
		/** Reactive — current active TabId */
		get activeTab() {
			return activity.activeTab;
		},
		/** Static ActivityTab registry for rendering the button list */
		tabs: activity.tabs,
		/** Switch tab / toggle sidebar */
		selectTab: activity.selectTab,
		/** Toggle secondary sidebar */
		toggleSecondaryPanel: activity.toggleSecondaryPanel,
		/** Mount keyboard shortcuts, returns cleanup */
		mount
	};
}
