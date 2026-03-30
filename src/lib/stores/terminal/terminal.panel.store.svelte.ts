import type { ITerminalInitOnlyOptions, ITerminalOptions } from '@battlefieldduck/xterm-svelte';

export const TERMINAL_PANEL_TABS = [
	'PROBLEMS',
	'OUTPUT',
	'DEBUG CONSOLE',
	'TERMINAL',
	'PORTS'
] as const;
export type TerminalPanelTab = (typeof TERMINAL_PANEL_TABS)[number];

// Explicit type for the components to consume
export type TerminalPanelTabItem = {
	id: TerminalPanelTab;
	label: string;
	active: boolean;
	closable: boolean;
};

/** Type guard — used by createTerminalWorkspace to validate tab switches. */
export function isTerminalPanelTab(value: string): value is TerminalPanelTab {
	return TERMINAL_PANEL_TABS.includes(value as TerminalPanelTab);
}

/** Placeholder text shown when the active tab is not TERMINAL. */
export function getTabPlaceholder(tab: Exclude<TerminalPanelTab, 'TERMINAL'>): string {
	const messages: Record<Exclude<TerminalPanelTab, 'TERMINAL'>, string> = {
		PROBLEMS: 'No problems have been detected in the workspace.',
		OUTPUT: 'Select an output channel to see logs.',
		'DEBUG CONSOLE': 'Debug console is idle. Start debugging to view output.',
		PORTS: 'No forwarded ports are currently open.'
	};
	return messages[tab];
}

// Build the tab items, maintaining data injection principles
export function buildTerminalPanelTabItems(activeTab: TerminalPanelTab): TerminalPanelTabItem[] {
	return TERMINAL_PANEL_TABS.map((tab) => ({
		id: tab,
		label: tab,
		active: activeTab === tab,
		closable: false // Can be parameterized later if some tabs become closable
	}));
}

export function createTerminalPanelStore() {
	let activeTab = $state<TerminalPanelTab>('TERMINAL');

	const xtermOptions: ITerminalOptions & ITerminalInitOnlyOptions = {
		fontSize: 13,
		lineHeight: 1.22,
		scrollback: 7000,
		cursorBlink: true,
		cursorStyle: 'block',
		allowTransparency: true
	};

	// Keep the store clean by passing the $state into the pure function
	const tabItems = $derived(buildTerminalPanelTabItems(activeTab));

	return {
		get activeTab() {
			return activeTab;
		},
		get xtermOptions() {
			return xtermOptions;
		},
		get tabItems() {
			return tabItems;
		},
		switchTab: (tab: TerminalPanelTab) => {
			activeTab = tab;
		}
	};
}
