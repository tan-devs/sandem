// src/lib/context/ide/ide-context.ts
import { setContext, getContext } from 'svelte';
import type { WebContainer } from '@webcontainer/api';
import type { Doc } from '$convex/_generated/dataModel.js';
import type { EditorSync } from '$lib/controllers/LiveblocksSyncController.svelte';

export type ProjectDoc = Doc<'projects'>;
export type NodeDoc = Doc<'nodes'>;

export type WorkspaceProject = {
	id: string;
	name: string;
	title: string;
	isPublic: boolean;
	room: string;
};

const IDE_CONTEXT_KEY = Symbol('IDE');

export interface IDEContext {
	getWebcontainer: () => WebContainer;

	// path is the full WC path e.g. "my-project/src/App.jsx".
	// When omitted (e.g. before any tab is open) returns the active/first project.
	getProject: (path?: string) => ProjectDoc | undefined;

	// Returns the default open file path for the project.
	// Maps to the optional `entry` field in the projects schema (e.g., "/src/index.ts").
	getEntryPath: () => string | undefined;

	// Optional external editor sync controller interface (e.g. Liveblocks).
	editorSync?: EditorSync;

	// Optional workspace project controls (used by Explorer in /repo).
	// Updated to reflect the new schema properties: `name`, `isPublic`, and `room`.
	getWorkspaceProjects?: () => WorkspaceProject[];

	getActiveProjectId?: () => string | null;
	getRenamingProjectId?: () => string | null;
	getPendingDeleteProjectId?: () => string | null;
	getMutatingProjectId?: () => string | null;

	isCreatingProject?: () => boolean;
	createProject?: (name?: string, isPublic?: boolean) => Promise<void>;
	selectProject?: (projectId: string) => void;

	startRenameProject?: (projectId: string) => void;
	cancelRenameProject?: () => void;
	// Updated from `title` to `name` to match the new schema definition
	commitRenameProject?: (projectId: string, name: string) => Promise<void>;

	requestDeleteProject?: (projectId: string) => void;
	confirmDeleteProject?: (projectId: string) => Promise<void>;
}

export function setIDEContext(context: IDEContext) {
	setContext(IDE_CONTEXT_KEY, context);
}

export function getIDEContext(): IDEContext | null {
	const ctx = getContext<IDEContext | undefined>(IDE_CONTEXT_KEY);
	return ctx ?? null;
}

export function requireIDEContext(): IDEContext {
	const context = getIDEContext();
	if (!context) {
		throw new Error('IDE context required but not found');
	}
	return context;
}
