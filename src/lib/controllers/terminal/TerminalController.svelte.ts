import type { IDEContext } from '$lib/context/webcontainer';
import type { TerminalStore } from '$lib/stores/terminal/terminal.store.svelte.js';
import { appendTerminalAudit } from '$lib/stores/collaboration';
import { createTerminalShell } from '$lib/services/terminal/createTerminalShell.svelte.js';
import { createTerminalWorkspace } from '$lib/services/terminal/createTerminalWorkspace.svelte.js';
import { useTerminal } from '$lib/hooks/useTerminal.svelte.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PanelLayout = { upPane?: boolean; downPane?: boolean };

export type TerminalControllerOptions = {
	ide: IDEContext;
	store: typeof TerminalStore;
	/**
	 * Returns the current panel visibility state.
	 * Pass `() => panelsCtrl.panels` from the workspace.
	 * Typed as a loose shape so the controller doesn't couple to PanelsController.
	 */
	getPanels: () => PanelLayout | undefined;
};

// ---------------------------------------------------------------------------
// Controller
//
// Assembly layer. Instantiates the workspace service and the hook, wires them
// together, and returns a flat API that Terminal.svelte consumes directly.
//
// Layer contract:
//   TerminalStore (terminal.store.svelte.ts)    — reactive UI state
//   createTerminalWorkspace (service)           — shell runtime, xterm, theme
//   useTerminal (hook)                          — $effect + mount/cleanup
//   TerminalController (this)                   — assembles all three, flat API
//
// File: TerminalController.svelte.ts → function: createTerminalController
// ---------------------------------------------------------------------------

export function createTerminalController(options: TerminalControllerOptions) {
	const { ide, store } = options;

	const workspace = createTerminalWorkspace({
		store,
		createShell: ({ canExecute, onAudit }) =>
			createTerminalShell(ide.getWebcontainer, { canExecute, onAudit }),
		recordAudit: appendTerminalAudit,
		getLayout: () => options.getPanels() as PanelLayout | undefined
	});

	// useTerminal registers the $effect for reactive session sync and returns
	// mount(). Both happen during component initialization — which they do
	// because createTerminalController is called at the top level of the
	// Terminal.svelte <script> block.
	const { mount } = useTerminal({ store, workspace });

	return {
		// ── Lifecycle ───────────────────────────────────────────────────────
		mount,

		// ── Panel state ─────────────────────────────────────────────────────
		get activeTab() {
			return store.panel.activeTab;
		},
		get tabItems() {
			return store.panel.tabItems;
		},
		get xtermOptions() {
			return store.panel.xtermOptions;
		},

		// ── Session state ────────────────────────────────────────────────────
		get activeSessionId() {
			return store.sessions.activeSessionId;
		},

		// ── Permissions ──────────────────────────────────────────────────────
		get canExecute() {
			return store.canExecute;
		},

		// ── Workspace state ──────────────────────────────────────────────────
		get sessionViews() {
			return workspace.sessionViews;
		},
		get placeholderText() {
			return workspace.placeholderText;
		},

		// ── Panel actions ────────────────────────────────────────────────────
		switchTab: (id: string) => void workspace.switchTab(id),
		clearActiveTerminal: workspace.clearActiveTerminal,
		restartActiveShell: () => void workspace.restartActiveShell(),
		killActiveShell: workspace.killActiveShell,
		toggleMaximize: workspace.toggleMaximize,
		closePanel: workspace.closePanel,

		// ── Session actions ──────────────────────────────────────────────────
		selectSession: (id: string) => void workspace.selectSession(id),
		closeSession: workspace.closeSession,
		newSession: () => void workspace.newSession(),
		renameSession: workspace.renameSession,
		reorderSession: workspace.reorderSession,
		ensureShellReady: (id: string) => void workspace.ensureShellReady(id),

		// ── Viewport actions ─────────────────────────────────────────────────
		onTerminalMount: workspace.onTerminalMount,
		sendInput: workspace.sendInput
	};
}

export type TerminalController = ReturnType<typeof createTerminalController>;
