import { getContext, setContext } from 'svelte';

export type PanelKey = 'leftPane' | 'upPane' | 'downPane' | 'rightPane';

export interface IDEPanels {
	leftPane: boolean;
	upPane: boolean;
	downPane: boolean;
	rightPane: boolean;
	activeTab?: string;
}

const PANELS_CONTEXT_KEY = 'panels';

const DEFAULT_PANELS: IDEPanels = {
	leftPane: true,
	upPane: true,
	downPane: true,
	rightPane: true,
	activeTab: 'explorer'
};

class PanelsState implements IDEPanels {
	leftPane = $state(DEFAULT_PANELS.leftPane);
	upPane = $state(DEFAULT_PANELS.upPane);
	downPane = $state(DEFAULT_PANELS.downPane);
	rightPane = $state(DEFAULT_PANELS.rightPane);
	activeTab = $state<string | undefined>(DEFAULT_PANELS.activeTab);

	constructor(initial?: Partial<IDEPanels>) {
		if (initial?.leftPane !== undefined) this.leftPane = initial.leftPane;
		if (initial?.upPane !== undefined) this.upPane = initial.upPane;
		if (initial?.downPane !== undefined) this.downPane = initial.downPane;
		if (initial?.rightPane !== undefined) this.rightPane = initial.rightPane;
		if (initial?.activeTab !== undefined) this.activeTab = initial.activeTab;
	}
}

export function createPanelsState(initial?: Partial<IDEPanels>): IDEPanels {
	return new PanelsState(initial);
}

export function setPanelsContext(panels: IDEPanels) {
	setContext(PANELS_CONTEXT_KEY, panels);
}

export function getPanelsContext(): IDEPanels | undefined {
	return getContext<IDEPanels | undefined>(PANELS_CONTEXT_KEY);
}

export function requirePanelsContext(): IDEPanels {
	const panels = getPanelsContext();
	if (!panels) {
		throw new Error('Panels context required but not found');
	}
	return panels;
}

export function togglePanel(panels: IDEPanels | undefined, key: PanelKey) {
	if (!panels) return;
	panels[key] = !panels[key];
}
