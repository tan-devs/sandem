import { setContext, getContext } from 'svelte';
import type { WebContainer } from '@webcontainer/api';
import type { Doc } from '$convex/_generated/dataModel.js';
import type { WorkspaceEditorSync } from '$lib/services/workspace';
import type { IDEPanelsAdapter } from '$lib/controllers/panels';

// ---------------------------------------------------------------------------
// Canonical document types — derived directly from the Convex schema.
// Never hand-write fields here; if the schema changes, these follow.
// ---------------------------------------------------------------------------

export type ProjectDoc = Doc<'projects'>;
export type NodeDoc = Doc<'nodes'>;

/**
 * A project with its node list pre-fetched — the shape returned by
 * `api.projects.getProjectFiles`. Use this anywhere you need both the
 * project metadata and its filesystem contents together.
 *
 * `nodes` maps to the `nodes` table. Each node has:
 *   - path     absolute project-relative path, e.g. "/src/App.tsx"
 *   - name     filename/dirname segment, e.g. "App.tsx"
 *   - type     "file" | "folder"
 *   - content  string | undefined — only present on file nodes
 */
export type Project = ProjectDoc & {
	nodes: NodeDoc[];
	isOwner: boolean;
};

/**
 * Lightweight project summary used by the workspace Explorer sidebar.
 * Matches the fields available on `Doc<'projects'>` — no fabricated fields.
 */
export type WorkspaceProject = {
	id: string;
	/** Human-readable project name, e.g. "my-web-app". Maps to `projects.name`. */
	name: string;
	isPublic: boolean;
	/** Liveblocks room slug. Maps to `projects.room`. */
	room: string;
	/** Optional default-open file path. Maps to `projects.entry`. */
	entry?: string;
};

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const IDE_CONTEXT_KEY = Symbol('IDE');

export interface IDEContext {
	getWebcontainer: () => WebContainer;

	/**
	 * Returns the project for a given WebContainer path, or the active/first
	 * project when no path is provided (e.g. before any tab is open).
	 *
	 * Path format: full WC path, e.g. "my-project/src/App.jsx".
	 */
	getProject: (path?: string) => Project | undefined;

	/**
	 * Returns the default open file path for the active project.
	 * Reads from `projects.entry`, e.g. "/src/index.ts".
	 */
	getEntryPath: () => string | undefined;

	/** Optional external editor sync controller (Liveblocks Yjs bridge). */
	editorSync?: WorkspaceEditorSync;

	/** Returns the IDEPanelsAdapter — pass to ActivityBar and useActivity. */
	getPanels?: () => IDEPanelsAdapter;

	/** Optional workspace project list — used by Explorer in /repo. */
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
	/** `name` matches `projects.name` in the schema. */
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
	if (!context) throw new Error('IDE context required but not found.');
	return context;
}
