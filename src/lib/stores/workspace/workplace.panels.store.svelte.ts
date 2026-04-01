/**
 * workspace.panels.store.svelte.ts
 *
 * Pure reactive panel visibility state for the workspace layout.
 * No IO. No computed values. Zero runtime knowledge.
 *
 * $state lives here. DOM side-effects (PaneAPI expand/collapse calls)
 * live in useWorkspace — keeping this store portable and testable.
 */

export type WorkspacePanelsStore = ReturnType<typeof createWorkspacePanelsStore>;

export function createWorkspacePanelsStore() {
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
