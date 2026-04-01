import { Files, Search, GitBranch, Play, type IconProps } from '@lucide/svelte';
import type { Component } from 'svelte';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TabId = 'explorer' | 'search' | 'git' | 'run';

/**
 * A single entry in the activity bar. Each tab maps to a primary panel
 * in the IDE sidebar and carries its own keyboard shortcut segments.
 *
 * shortcutLetter  →  Ctrl/Cmd + Shift + <letter>
 * shortcutNumber  →  Alt + <number>
 */
export interface ActivityTab {
	id: TabId;
	icon: Component<IconProps>;
	label: string;
	shortcutLetter: string;
	shortcutNumber: string;
}

/**
 * Minimal panel shape the activity system reads/writes.
 * The workspace panels store must be assignable to this type.
 *
 * leftPane   — the primary sidebar (Explorer / Search / Git / Run)
 * rightPane  — the secondary sidebar (Settings / Inspector)
 */
export interface IDEPanels {
	leftPane: boolean;
	rightPane: boolean | unknown;
}

// ---------------------------------------------------------------------------
// Static data — tab registry
// ---------------------------------------------------------------------------

export const ACTIVITY_TABS: ActivityTab[] = [
	{ id: 'explorer', icon: Files, label: 'Explorer', shortcutLetter: 'e', shortcutNumber: '1' },
	{ id: 'search', icon: Search, label: 'Search', shortcutLetter: 'f', shortcutNumber: '2' },
	{ id: 'git', icon: GitBranch, label: 'Source Control', shortcutLetter: 'g', shortcutNumber: '3' },
	{ id: 'run', icon: Play, label: 'Run & Debug', shortcutLetter: 'd', shortcutNumber: '4' }
];

// ---------------------------------------------------------------------------
// Reactive state — single shared instance
// ---------------------------------------------------------------------------

/**
 * Single $state object that owns the active tab selection for the whole app.
 * Never import this directly in components — use the hook or controller.
 */
export const activityStore = $state({
	activeTab: 'explorer' as TabId
});
