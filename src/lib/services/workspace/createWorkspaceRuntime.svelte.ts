/**
 * createWorkspaceRuntime.svelte.ts
 *
 * Workspace runtime orchestration service.
 *
 * Responsibilities:
 *   - Manages the WebContainer lifecycle via createRuntimeManager
 *   - Manages project CRUD mutations via createRepoProjectManager
 *   - Derives computed state (folderMap, activeProject, statusText) from the store
 *   - Exposes path helpers consumed by IDEContext and WorkspaceController
 *
 * Does NOT own UI state — that lives in WorkspaceStore (panels + projects).
 * Does NOT own $effects or mount/cleanup logic — that lives in useWorkspace.
 * Does NOT know about Svelte context or layout — that lives in WorkspaceController.
 *
 * Receives the store as a dependency so all reactive reads are live-derived
 * from the single source of truth rather than duplicated.
 */

import {
	createRuntimeManager,
	createRepoProjectManager,
	type ConvexOperations
} from '$lib/services/webcontainer';
import { VITE_REACT_TEMPLATE } from '$lib/utils';
import { projectFolderName } from '$lib/utils/explorer/projects.js';
import { createError } from '$lib/sveltekit/index.js';
import type { Doc } from '$convex/_generated/dataModel.js';
import type { FileSystemTree } from '@webcontainer/api';
import type { WorkspaceStore } from '$lib/stores/workspace/workspace.store.svelte.js';

export type { ConvexOperations };

type ProjectDoc = Doc<'projects'>;

export type WorkspaceRuntimeOptions = {
	store: WorkspaceStore;
	getWorkspaceTree: () => FileSystemTree;
	isDemo: () => boolean;
	isGuest: () => boolean;
	ownerId: () => string;
	convexClient: ConvexOperations;
};

const DEMO_FOLDER = 'demo';

// The demo project has no Convex ID and is never persisted.
const demoProject = {
	files: VITE_REACT_TEMPLATE.files,
	room: undefined
} as unknown as ProjectDoc;

export function createWorkspaceRuntime(options: WorkspaceRuntimeOptions) {
	const { store } = options;

	// ── Sub-services ──────────────────────────────────────────────────────────

	const runtime = createRuntimeManager({
		isDemo: options.isDemo,
		getProjects: () => store.projects.projects,
		getEntryPath: () => getEntryPath(),
		getWorkspaceTree: options.getWorkspaceTree
	});

	const projectManager = createRepoProjectManager({
		getProjects: () => store.projects.projects,
		setProjects: (p) => store.projects.setProjects(p),
		getActiveProjectId: () => store.projects.activeProjectId,
		setActiveProjectId: (id) => store.projects.setActiveProjectId(id),
		convexClient: options.convexClient,
		ownerId: options.ownerId,
		// Wrap the plain Error from projectManager into a createError so that
		// failRuntimeWithError receives the correct type.
		onError: (err, cause) =>
			runtime.failRuntimeWithError(
				createError(err.message ?? 'A project operation failed.'),
				cause ?? err
			)
	});

	// ── Derived state ─────────────────────────────────────────────────────────
	// Computed from the store — no duplication of $state.

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

	const statusText = $derived(
		runtime.runtimePhase === 'failed'
			? '⚠️ Runtime failed · recovery available'
			: runtime.ready
				? options.isGuest()
					? '👤 Guest session · changes are temporary'
					: `⚡ Ready · ${activeProject?.name ?? 'Project'}`
				: runtime.runtimePhase === 'installing'
					? '📦 Installing project dependencies…'
					: runtime.runtimePhase === 'mounting'
						? '🗂️ Mounting project files…'
						: '⏳ Starting sandbox runtime…'
	);

	// ── Path helpers ──────────────────────────────────────────────────────────

	function getFallbackProject(): ProjectDoc {
		if (options.isDemo()) return demoProject;
		return activeProject ?? store.projects.projects[0] ?? demoProject;
	}

	function getProjectForPath(path?: string): ProjectDoc {
		if (options.isDemo()) return demoProject;
		if (!path) return getFallbackProject();
		const folder = path.split('/')[0];
		const match = store.projects.projects.find((p) => folderMap.get(p._id) === folder);
		return match ?? getFallbackProject();
	}

	function getEntryPath(): string {
		if (options.isDemo()) return `${DEMO_FOLDER}/${VITE_REACT_TEMPLATE.entry}`;
		const project = activeProject ?? store.projects.projects[0];
		if (!project) return `${DEMO_FOLDER}/${VITE_REACT_TEMPLATE.entry}`;
		const folder = folderMap.get(project._id) ?? projectFolderName(project._id, project.name);
		return `${folder}/${project.entry ?? VITE_REACT_TEMPLATE.entry}`;
	}

	// ── Public interface ──────────────────────────────────────────────────────

	return {
		// ── Runtime state (reactive, from createRuntimeManager) ───────────────
		get runtimePhase() {
			return runtime.runtimePhase;
		},
		get runtimeError() {
			return runtime.runtimeError;
		},
		get ready() {
			return runtime.ready;
		},
		get statusText() {
			return statusText;
		},
		get activeProject() {
			return activeProject;
		},

		// ── Project manager state ─────────────────────────────────────────────
		get creatingProject() {
			return projectManager.creatingProject;
		},
		get mutatingProjectId() {
			return projectManager.mutatingProjectId;
		},

		// ── Path helpers ──────────────────────────────────────────────────────
		getProjectForPath,
		getEntryPath,

		/** Stable shape consumed by IDEContext.getWorkspaceProjects */
		getWorkspaceProjects: () =>
			store.projects.projects.map((p) => ({
				id: p._id,
				name: p.name,
				isPublic: p.isPublic ?? false,
				room: p.room ?? '',
				entry: p.entry
			})),

		// ── Runtime lifecycle ─────────────────────────────────────────────────
		startRuntime: () => runtime.startRuntime(),
		stopRuntime: () => runtime.stopRuntime(),
		failRuntimeWithError: (err: ReturnType<typeof createError>, cause?: unknown) =>
			runtime.failRuntimeWithError(err, cause),
		getWebcontainer: () => {
			if (!runtime.webcontainer) throw new Error('WebContainer is not initialized.');
			return runtime.webcontainer;
		},

		// ── Project CRUD (delegated to projectManager) ────────────────────────
		createProjectCard: projectManager.createProjectCard,
		commitRename: projectManager.commitRename,
		confirmDelete: projectManager.confirmDelete
	};
}

export type WorkspaceRuntime = ReturnType<typeof createWorkspaceRuntime>;
