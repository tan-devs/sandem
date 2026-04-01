/**
 * createWorkspaceProjects.svelte.ts
 *
 * Standalone project CRUD + path helpers service.
 *
 * Use this when you need project management WITHOUT the WebContainer runtime
 * (e.g. sidebar components, SSR-adjacent helpers, or lightweight contexts).
 * For the full orchestrated runtime, use createWorkspaceRuntime instead —
 * it creates its own internal project manager.
 *
 * Responsibilities:
 *   - Delegates Convex CRUD mutations to createRepoProjectManager
 *   - Derives folderMap and activeProject from the store reactively
 *   - Exposes path helpers (getProjectForPath, getEntryPath, getWorkspaceProjects)
 *
 * Does NOT own $state — all reactive reads flow from WorkspaceStore.
 * Does NOT touch the WebContainer filesystem.
 */

import { createRepoProjectManager } from '$lib/services/webcontainer';
import { projectFolderName } from '$lib/utils/explorer/projects.js';
import { VITE_REACT_TEMPLATE } from '$lib/utils';
import type { ConvexOperations } from '$lib/services/webcontainer';
import type { Doc } from '$convex/_generated/dataModel.js';
import type { WorkspaceStore } from '$lib/stores/workspace/workspace.store.svelte.js';

type ProjectDoc = Doc<'projects'>;

export type WorkspaceProjectsOptions = {
	store: WorkspaceStore;
	convexClient: ConvexOperations;
	ownerId: () => string;
	isDemo: () => boolean;
	onError: (err: Error, cause?: unknown) => void;
};

const DEMO_FOLDER = 'demo';

// The demo project has no Convex ID and is never persisted.
const demoProject = {
	files: VITE_REACT_TEMPLATE.files,
	room: undefined
} as unknown as ProjectDoc;

export function createWorkspaceProjects(options: WorkspaceProjectsOptions) {
	const { store } = options;

	// ── CRUD (delegated) ──────────────────────────────────────────────────────

	const crudManager = createRepoProjectManager({
		getProjects: () => store.projects.projects,
		setProjects: (p) => store.projects.setProjects(p),
		getActiveProjectId: () => store.projects.activeProjectId,
		setActiveProjectId: (id) => store.projects.setActiveProjectId(id),
		convexClient: options.convexClient,
		ownerId: options.ownerId,
		onError: options.onError
	});

	// ── Derived state ─────────────────────────────────────────────────────────
	// Both derived values read from the store so they stay in sync with any
	// external mutations (e.g. project sync effect in useWorkspace).

	const folderMap = $derived(
		new Map<string, string>(
			options.isDemo()
				? []
				: store.projects.projects.map((p) => [p._id, projectFolderName(p._id, p.name)])
		)
	);

	const activeProject = $derived(
		options.isDemo()
			? null
			: (store.projects.projects.find((p) => p._id === store.projects.activeProjectId) ??
					store.projects.projects[0] ??
					null)
	);

	// ── Path helpers ──────────────────────────────────────────────────────────

	function getFallbackProject(): ProjectDoc {
		if (options.isDemo()) return demoProject;
		return activeProject ?? store.projects.projects[0] ?? demoProject;
	}

	/**
	 * Resolve which project owns a given WebContainer path by matching the
	 * leading folder segment against the folderMap. Falls back to the active
	 * project if no folder match is found.
	 */
	function getProjectForPath(path?: string): ProjectDoc {
		if (options.isDemo()) return demoProject;
		if (!path) return getFallbackProject();
		const folder = path.split('/')[0];
		const match = store.projects.projects.find((p) => folderMap.get(p._id) === folder);
		return match ?? getFallbackProject();
	}

	/**
	 * Return the WebContainer path that should be opened when the runtime
	 * boots — i.e. the entry file of the active project.
	 */
	function getEntryPath(): string {
		if (options.isDemo()) return `${DEMO_FOLDER}/${VITE_REACT_TEMPLATE.entry}`;
		const project = activeProject ?? store.projects.projects[0];
		if (!project) return `${DEMO_FOLDER}/${VITE_REACT_TEMPLATE.entry}`;
		const folder = folderMap.get(project._id) ?? projectFolderName(project._id, project.name);
		return `${folder}/${project.entry ?? VITE_REACT_TEMPLATE.entry}`;
	}

	/** Stable shape consumed by IDEContext.getWorkspaceProjects. */
	function getWorkspaceProjects() {
		return store.projects.projects.map((p) => ({
			id: p._id,
			name: p.name,
			isPublic: p.isPublic ?? false,
			room: p.room ?? '',
			entry: p.entry
		}));
	}

	// ── Public interface ──────────────────────────────────────────────────────

	return {
		get activeProject() {
			return activeProject;
		},
		get creatingProject() {
			return crudManager.creatingProject;
		},
		get mutatingProjectId() {
			return crudManager.mutatingProjectId;
		},
		createProjectCard: crudManager.createProjectCard,
		commitRename: crudManager.commitRename,
		confirmDelete: crudManager.confirmDelete,
		getProjectForPath,
		getEntryPath,
		getWorkspaceProjects
	};
}

export type WorkspaceProjects = ReturnType<typeof createWorkspaceProjects>;
