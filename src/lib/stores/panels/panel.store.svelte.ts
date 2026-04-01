/**
 * panel.store.svelte.ts
 *
 * Pure reactive panel visibility state. No IO. No computed values.
 * No Svelte context. No PaneAPI.
 *
 * $state lives here.
 * Persistence (localStorage) lives in createPanelsService.
 * DOM side-effects (PaneAPI expand/collapse) live in usePanels / useWorkspace.
 *
 * This is the canonical panels store. workspace.panels.store.svelte.ts is
 * superseded by this file — delete it.
 */

export type PanelsStore = ReturnType<typeof createPanelsStore>;

export function createPanelsStore() {
	let leftPane = $state(true);
	let downPane = $state(true);
	let rightPane = $state(false);

	return {
		get leftPane() {
			return leftPane;
		},
		get downPane() {
			return downPane;
		},
		get rightPane() {
			return rightPane;
		},

		setLeft(open: boolean) {
			leftPane = open;
		},
		setDown(open: boolean) {
			downPane = open;
		},
		setRight(open: boolean) {
			rightPane = open;
		},

		/**
		 * Restores all panes to visible.
		 * Called by the ErrorPanel recovery button when the runtime fails
		 * and panels may be hidden, obscuring the recovery UI.
		 */
		resetAll() {
			leftPane = true;
			downPane = true;
			rightPane = true;
		}
	};
}
