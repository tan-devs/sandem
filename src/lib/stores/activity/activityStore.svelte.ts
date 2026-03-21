import { Files, Search, GitBranch, Play, type IconProps } from '@lucide/svelte';
import { type Component } from 'svelte';

export type TabId = 'explorer' | 'search' | 'git' | 'run';

export interface Tool {
	id: TabId;
	icon: Component<IconProps>;
	label: string;
}

export const tools: Tool[] = [
	{ id: 'explorer', icon: Files, label: 'Explorer' },
	{ id: 'search', icon: Search, label: 'Search' },
	{ id: 'git', icon: GitBranch, label: 'Source Control' },
	{ id: 'run', icon: Play, label: 'Run & Debug' }
];

// Single $state instance shared across the whole app
export const activity = $state({ tab: 'explorer' as TabId });
