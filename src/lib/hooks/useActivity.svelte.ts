import { activityStore, ACTIVITY_TABS } from '$lib/stores/activity/index.js';
import { createActivityTabService, createActivityKeyboardService } from '$lib/services/activity';
import type { IDEPanels } from '$lib/stores/activity/index.js';

// ---------------------------------------------------------------------------
// Deps interface
// ---------------------------------------------------------------------------

export interface UseActivityDeps {
	/**
	 * Returns the live panels object from the workspace.
	 * The hook reads/writes leftPane and rightPane through this accessor
	 * so the hook itself carries no reference to the workspace controller.
	 */
	getPanels: () => IDEPanels | undefined;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * useActivity
 *
 * Assembles createActivityTabService + createActivityKeyboardService into a
 * single reactive API surface. This is the only file that imports
 * activityStore — services and the controller never touch the store directly.
 *
 * Returned surface:
 *
 *   activeTab          — reactive getter, current TabId from activityStore
 *   tabs               — static ActivityTab registry (icons, labels, shortcuts)
 *   selectTab(id)      — switch tab or toggle sidebar if same tab re-clicked
 *   toggleSecondary()  — flip the secondary (right) panel
 *   mountKeyboard()    — registers global shortcuts; returns cleanup function
 *
 * Usage in a controller:
 *
 *   const activity = useActivity({ getPanels: () => workspacePanels });
 *   onMount(() => activity.mountKeyboard());
 */
export function useActivity(deps: UseActivityDeps) {
	const tabService = createActivityTabService({
		getActiveTab: () => activityStore.activeTab,
		setActiveTab: (tab) => {
			activityStore.activeTab = tab;
		},
		getPanels: deps.getPanels
	});

	const keyboardService = createActivityKeyboardService({
		tabs: ACTIVITY_TABS,
		onSelect: tabService.selectTab
	});

	return {
		/** Reactive — reads directly from activityStore.$state */
		get activeTab() {
			return activityStore.activeTab;
		},
		/** Static tab registry — icons, labels, keyboard shortcut metadata */
		tabs: ACTIVITY_TABS,
		/** Switch to a tab; re-clicking the active tab toggles the sidebar */
		selectTab: tabService.selectTab,
		/** Toggle the secondary (right) panel */
		toggleSecondaryPanel: tabService.toggleSecondaryPanel,
		/** Call in onMount — returns teardown cleanup */
		mountKeyboard: keyboardService.mount
	};
}
