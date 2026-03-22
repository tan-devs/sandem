import type { ITerminalInitOnlyOptions, ITerminalOptions } from '@battlefieldduck/xterm-svelte';

export const terminalPanelTabs = [
	'PROBLEMS',
	'OUTPUT',
	'DEBUG CONSOLE',
	'TERMINAL',
	'PORTS'
] as const;
export type TerminalPanelTab = (typeof terminalPanelTabs)[number];

export type TerminalPanelTabItem = {
	id: TerminalPanelTab;
	label: TerminalPanelTab;
	active: boolean;
	closable: false;
};

export function isTerminalPanelTab(value: string): value is TerminalPanelTab {
	return terminalPanelTabs.includes(value as TerminalPanelTab);
}

export function getTerminalTabPlaceholder(tab: Exclude<TerminalPanelTab, 'TERMINAL'>): string {
	const messages: Record<Exclude<TerminalPanelTab, 'TERMINAL'>, string> = {
		PROBLEMS: 'No problems have been detected in the workspace.',
		OUTPUT: 'Select an output channel to see logs.',
		'DEBUG CONSOLE': 'Debug console is idle. Start debugging to view output.',
		PORTS: 'No forwarded ports are currently open.'
	};
	return messages[tab];
}

export function createTerminalPanelController() {
	let activeTab = $state<TerminalPanelTab>('TERMINAL');
	let isTerminalToolbarOpen = $state(true);
	let terminalError = $state<string | null>(null);

	const options: ITerminalOptions & ITerminalInitOnlyOptions = {
		fontSize: 13,
		lineHeight: 1.22,
		scrollback: 7000,
		cursorBlink: true,
		cursorStyle: 'block',
		allowTransparency: true
	};

	const panelTabItems: TerminalPanelTabItem[] = $derived(
		terminalPanelTabs.map((tab) => ({
			id: tab,
			label: tab,
			active: activeTab === tab,
			closable: false
		}))
	);

	function setActiveTab(tab: TerminalPanelTab) {
		activeTab = tab;
	}

	function setTerminalToolbarOpen(next: boolean) {
		isTerminalToolbarOpen = next;
	}

	function setTerminalError(next: string | null) {
		terminalError = next;
	}

	function clearTerminalError() {
		terminalError = null;
	}

	return {
		get activeTab() {
			return activeTab;
		},
		setActiveTab,
		get isTerminalToolbarOpen() {
			return isTerminalToolbarOpen;
		},
		setTerminalToolbarOpen,
		get terminalError() {
			return terminalError;
		},
		setTerminalError,
		clearTerminalError,
		get options() {
			return options;
		},
		get panelTabItems() {
			return panelTabItems;
		}
	};
}
