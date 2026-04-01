import type { PaneAPI } from 'paneforge';
import { createPanelsStore } from '$lib/stores/panels';
import { createPanelsService } from '$lib/services/panels/createPanelsService.svelte.js';
import { usePanels } from '$lib/hooks/usePanels.svelte.js';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface CreatePanelsControllerOptions {
	/**
	 * Returns the PaneAPI for the left sidebar.
	 * Passed from WorkspaceController which binds it to the <Pane> element.
	 */
	getSidebar: () => PaneAPI | undefined;
}

// ---------------------------------------------------------------------------
// Adapter type
// ---------------------------------------------------------------------------

/**
 * IDEPanelsAdapter
 *
 * The assignable panel visibility shape consumed by the activity bar,
 * editor shortcuts, and any other system that reads or writes panel state.
 *
 * All three panes are exposed:
 *   leftPane  — sidebar (activity bar / explorer)
 *   downPane  — terminal panel (toggled by Ctrl+`)
 *   rightPane — secondary panel (future use)
 *
 * Writes route through createPanelsService so persistence always fires.
 * No upPane. No activeTab. Replaces the legacy IDEPanels interface.
 */
export interface IDEPanelsAdapter {
	leftPane: boolean;
	downPane: boolean;
	rightPane: boolean;
}

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

/**
 * createPanelsController
 *
 * The single source of truth for panel visibility. Self-contained: owns
 * the store, service, and hook. Instantiated once inside WorkspaceController.
 *
 * Instantiation order:
 *   1. createPanelsStore()        — $state (leftPane, downPane, rightPane)
 *   2. createPanelsService(store) — set/toggle/persist/reset logic
 *   3. service.hydrate()          — restore localStorage on boot
 *   4. usePanels(store, service)  — registers store → PaneAPI $effect
 *
 * Exposed surface:
 *
 *   panels          — IDEPanelsAdapter object with assignable leftPane/rightPane.
 *                     Pass to ActivityBar / useActivity as `getPanels`.
 *
 *   leftPane        — reactive getter
 *   downPane        — reactive getter
 *   rightPane       — reactive getter
 *
 *   setLeft(v)      — set + persist
 *   setDown(v)      — set + persist
 *   setRight(v)     — set + persist
 *   toggleLeft()    — flip + persist
 *   toggleDown()    — flip + persist
 *   toggleRight()   — flip + persist
 *   resetAll()      — open all panes + persist (ErrorPanel recovery)
 */
export function createPanelsController(options: CreatePanelsControllerOptions) {
	// ── 1. Store ──────────────────────────────────────────────────────────────
	const store = createPanelsStore();

	// ── 2. Service ────────────────────────────────────────────────────────────
	const service = createPanelsService({ store });

	// ── 3. Hydrate ────────────────────────────────────────────────────────────
	service.hydrate();

	// ── 4. Hook ($effect: store → PaneAPI) ────────────────────────────────────
	const hook = usePanels({ store, service, getSidebar: options.getSidebar });

	// ── IDEPanelsAdapter ──────────────────────────────────────────────────────
	//
	// Consumers write panel visibility via direct property assignment
	// (e.g. `panels.leftPane = true`, `panels.downPane = !panels.downPane`).
	// Every write routes through the service so persistence always fires.
	const panels: IDEPanelsAdapter = {
		get leftPane(): boolean {
			return store.leftPane;
		},
		set leftPane(v: boolean) {
			service.setLeft(v);
		},
		get downPane(): boolean {
			return store.downPane;
		},
		set downPane(v: boolean) {
			service.setDown(v);
		},
		get rightPane(): boolean {
			return store.rightPane;
		},
		set rightPane(v: boolean) {
			service.setRight(v);
		}
	};

	// ── Public API ────────────────────────────────────────────────────────────
	return {
		/**
		 * Pass to ActivityBar, useActivity, and createEditorShortcuts
		 * as `getPanels={() => ctrl.panels}`.
		 */
		panels,

		// Reactive getters — consumed by WorkspaceController's public API
		// and by usePanels for the PaneAPI $effect.
		get leftPane(): boolean {
			return store.leftPane;
		},
		get downPane(): boolean {
			return store.downPane;
		},
		get rightPane(): boolean {
			return store.rightPane;
		},

		// Explicit setters + toggles
		setLeft: hook.setLeft,
		setDown: hook.setDown,
		setRight: hook.setRight,
		toggleLeft: hook.toggleLeft,
		toggleDown: hook.toggleDown,
		toggleRight: hook.toggleRight,
		resetAll: hook.resetAll
	};
}

export type PanelsController = ReturnType<typeof createPanelsController>;
