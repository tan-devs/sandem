// ---------------------------------------------------------------------------
// Shared explorer types
//
// Import from here in components and controllers alike so the shapes stay
// in sync. None of these types require runtime context — they are pure data
// contracts.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Dialog
// ---------------------------------------------------------------------------

export type ExplorerDialogIntent = 'create-file' | 'create-folder' | 'rename' | 'delete';

export type ExplorerDialogState = {
	open: boolean;
	intent: ExplorerDialogIntent | null;
	/** The current text value of the dialog input field. */
	value: string;
	/** The path the dialog was opened against (used for rename / delete). */
	targetPath: string | null;
};

// ---------------------------------------------------------------------------
// Context menu
// ---------------------------------------------------------------------------

export type ContextMenuAction = 'new-file' | 'new-folder' | 'rename' | 'delete' | 'refresh';

export type ContextMenuState = {
	open: boolean;
	x: number;
	y: number;
	/** The node path the menu was opened on. */
	path: string | null;
};

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

export type TimelineEventKind = 'action' | 'error' | 'file-open' | 'folder-toggle';

export type TimelineEvent = {
	id: string;
	at: number;
	kind: TimelineEventKind;
	label: string;
	/** Present for file-open and folder-toggle events. */
	path?: string;
};

// ---------------------------------------------------------------------------
// Action buttons (toolbar)
// ---------------------------------------------------------------------------

import type { Component } from 'svelte';

export type ActionButton = {
	id: string;
	title?: string;
	icon?: Component;
	handler?: () => void | Promise<void>;
	/** Static boolean or a reactive getter. */
	disabled?: boolean | (() => boolean);
	isSpacer?: boolean;
};
