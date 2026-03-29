import type { ITerminalInitOnlyOptions, ITerminalOptions } from '@battlefieldduck/xterm-svelte';

// ---------------------------------------------------------------------------
// Panel tab definitions
// ---------------------------------------------------------------------------

export const TERMINAL_PANEL_TABS = [
	'PROBLEMS',
	'OUTPUT',
	'DEBUG CONSOLE',
	'TERMINAL',
	'PORTS'
] as const;

export type TerminalPanelTab = (typeof TERMINAL_PANEL_TABS)[number];

export type TerminalPanelTabItem = {
	id: TerminalPanelTab;
	label: TerminalPanelTab;
	active: boolean;
	closable: false;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function isTerminalPanelTab(value: string): value is TerminalPanelTab {
	return TERMINAL_PANEL_TABS.includes(value as TerminalPanelTab);
}

/** Returns the placeholder text shown when the active tab is not TERMINAL. */
export function getTabPlaceholder(tab: Exclude<TerminalPanelTab, 'TERMINAL'>): string {
	const messages: Record<Exclude<TerminalPanelTab, 'TERMINAL'>, string> = {
		PROBLEMS: 'No problems have been detected in the workspace.',
		OUTPUT: 'Select an output channel to see logs.',
		'DEBUG CONSOLE': 'Debug console is idle. Start debugging to view output.',
		PORTS: 'No forwarded ports are currently open.'
	};
	return messages[tab];
}

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

export function createTerminalPanelController() {
	let activeTab = $state<TerminalPanelTab>('TERMINAL');

	/** xterm options are static — set once, never mutated at runtime. */
	const xtermOptions: ITerminalOptions & ITerminalInitOnlyOptions = {
		fontSize: 13,
		lineHeight: 1.22,
		scrollback: 7000,
		cursorBlink: true,
		cursorStyle: 'block',
		allowTransparency: true
	};

	const tabItems = $derived<TerminalPanelTabItem[]>(
		TERMINAL_PANEL_TABS.map((tab) => ({
			id: tab,
			label: tab,
			active: activeTab === tab,
			closable: false
		}))
	);

	function switchTab(tab: TerminalPanelTab) {
		activeTab = tab;
	}

	return {
		get activeTab() {
			return activeTab;
		},
		switchTab,
		get xtermOptions() {
			return xtermOptions;
		},
		get tabItems() {
			return tabItems;
		}
	};
}
