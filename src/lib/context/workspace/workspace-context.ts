import { setContext, getContext } from 'svelte';

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

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

const WORKSPACE_CONTEXT_KEY = Symbol('Workspace');

/**
 * Project CRUD surface — only consumed by the Explorer sidebar (and its
 * controller). Every field is required: if you're providing this context at
 * all, you must implement the full contract. Callers that don't need project
 * management simply never call `requireWorkspaceContext()`.
 */
export interface WorkspaceContext {
	// ── Project list ──────────────────────────────────────────────────────────

	/** All projects visible in the workspace sidebar. */
	getWorkspaceProjects: () => WorkspaceProject[];

	// ── Selection state ───────────────────────────────────────────────────────

	getActiveProjectId: () => string | null;

	// ── Mutation inflight state ───────────────────────────────────────────────

	/** True while a new-project create request is in flight. */
	isCreatingProject: () => boolean;
	/** ID of the project currently being renamed, or null. */
	getRenamingProjectId: () => string | null;
	/** ID of the project pending delete confirmation, or null. */
	getPendingDeleteProjectId: () => string | null;
	/**
	 * ID of whichever project has any mutation in flight (create/rename/delete),
	 * or null. Use to disable affordances during async operations.
	 */
	getMutatingProjectId: () => string | null;

	// ── Actions ───────────────────────────────────────────────────────────────

	/** Create a new project. `name` defaults to a generated slug if omitted. */
	createProject: (name?: string, isPublic?: boolean) => Promise<void>;

	/** Switch the active project. */
	selectProject: (projectId: string) => void;

	/** Enter rename mode for a project (shows inline input). */
	startRenameProject: (projectId: string) => void;

	/** Abort an in-progress rename without committing. */
	cancelRenameProject: () => void;

	/** Commit a rename. `name` maps to `projects.name` in the schema. */
	commitRenameProject: (projectId: string, name: string) => Promise<void>;

	/** Show the delete-confirmation UI for a project. */
	requestDeleteProject: (projectId: string) => void;

	/** Execute the confirmed delete. */
	confirmDeleteProject: (projectId: string) => Promise<void>;
}

export function setWorkspaceContext(context: WorkspaceContext): void {
	setContext(WORKSPACE_CONTEXT_KEY, context);
}

export function getWorkspaceContext(): WorkspaceContext | null {
	const ctx = getContext<WorkspaceContext | undefined>(WORKSPACE_CONTEXT_KEY);
	return ctx ?? null;
}

/**
 * Use inside components/controllers that must have a workspace context —
 * i.e. the Explorer sidebar and anything it mounts.
 */
export function requireWorkspaceContext(): WorkspaceContext {
	const ctx = getWorkspaceContext();
	if (!ctx) throw new Error('WorkspaceContext required but not found.');
	return ctx;
}
