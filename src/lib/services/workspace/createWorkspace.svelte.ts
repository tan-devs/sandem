/**
 * createWorkspace.svelte.ts
 *
 * Service-level workspace coordinator.
 * Composes store + runtime + hook into a single flat API consumed by
 * WorkspaceController.svelte.ts (the assembly root for the IDE layout).
 *
 * Call order matters: createWorkspaceRuntime must be called before useWorkspace
 * so that the runtime's failRuntimeWithError is available as the error sink
 * before any $effects register. useWorkspace's mount() owns startRuntime and
 * the window error guards — do not call runtime.startRuntime() separately here.
 */

import { createWorkspaceStore } from '$lib/stores/workspace/workspace.store.svelte.js';
import { useWorkspace } from '$lib/hooks/useWorkspace.svelte.js';
import { createWorkspaceRuntime } from './createWorkspaceRuntime.svelte.js';
import type { ConvexOperations } from '$lib/services/webcontainer';
import type { FileSystemTree } from '@webcontainer/api';
import type { RepoLayoutData } from '$types/routes.js';
import type { PaneAPI } from 'paneforge';

export interface WorkspaceControllerOptions {
	getInitialProjects: () => RepoLayoutData['projects'];
	getProjectsData: () => RepoLayoutData['projects'] | undefined;
	getProjectsError: () => unknown;
	getWorkspaceTree: () => FileSystemTree;
	getSidebar: () => PaneAPI | undefined;
	isDemo: () => boolean;
	isGuest: () => boolean;
	ownerId: () => string;
	convexClient: ConvexOperations;
}

export function createWorkspaceController(options: WorkspaceControllerOptions) {
	const store = createWorkspaceStore();

	// Runtime is created before the hook so its error sink is available
	// to any $effects that useWorkspace registers.
	const runtime = createWorkspaceRuntime({
		store,
		isDemo: options.isDemo,
		isGuest: options.isGuest,
		ownerId: options.ownerId,
		getWorkspaceTree: options.getWorkspaceTree,
		convexClient: options.convexClient
	});

	// useWorkspace owns: project sync effect, sidebar DOM effect, localStorage
	// effect, startRuntime(), and window error/rejection listeners.
	const hook = useWorkspace({
		store,
		runtime,
		getSidebar: options.getSidebar,
		getProjectsData: options.getProjectsData,
		getProjectsError: options.getProjectsError,
		getInitialProjects: options.getInitialProjects,
		isGuest: options.isGuest
	});

	// ── Lifecycle ─────────────────────────────────────────────────────────────
	// mount() delegates entirely to the hook — which handles startRuntime and
	// window error guards internally. This avoids double-booting the runtime.

	function mount(): (() => void) | void {
		return hook.mount();
	}

	// ── Public interface ──────────────────────────────────────────────────────

	return {
		// ── Store: panel state ────────────────────────────────────────────────
		get leftPane() {
			return store.panels.leftPane;
		},
		get downPane() {
			return store.panels.downPane;
		},
		get rightPane() {
			return store.panels.rightPane;
		},
		setLeft: (v: boolean) => store.panels.setLeft(v),
		setDown: (v: boolean) => store.panels.setDown(v),
		setRight: (v: boolean) => store.panels.setRight(v),
		resetPanes: () => store.panels.resetAll(),

		// ── Store: project selection + rename/delete UI state ─────────────────
		get activeProjectId() {
			return store.projects.activeProjectId;
		},
		get renamingProjectId() {
			return store.projects.renamingProjectId;
		},
		get pendingDeleteProjectId() {
			return store.projects.pendingDeleteProjectId;
		},

		// ── Runtime: phase + status ───────────────────────────────────────────
		get runtimePhase() {
			return runtime.runtimePhase;
		},
		get runtimeError() {
			return runtime.runtimeError;
		},
		get ready() {
			return runtime.ready;
		},
		// statusText is derived inside createWorkspaceRuntime — no duplication.
		get statusText() {
			return runtime.statusText;
		},

		// ── Runtime: project data ─────────────────────────────────────────────
		get activeProject() {
			return runtime.activeProject;
		},
		get creatingProject() {
			return runtime.creatingProject;
		},
		get mutatingProjectId() {
			return runtime.mutatingProjectId;
		},

		// ── Actions: project selection (delegated to store rich methods) ───────
		// These methods keep pendingDeleteProjectId / renamingProjectId in sync
		// atomically — never call setActiveProjectId + setRenamingProjectId
		// separately from the outside.
		selectProject: (id: string) => store.projects.selectProject(id),
		startRename: (id: string) => store.projects.startRename(id),
		cancelRename: () => store.projects.cancelRename(),
		requestDelete: (id: string) => store.projects.requestDelete(id),

		// ── Actions: project CRUD (delegated through runtime) ─────────────────
		createProjectCard: runtime.createProjectCard,
		commitRename: runtime.commitRename,
		confirmDelete: runtime.confirmDelete,

		// ── Path helpers (delegated through runtime) ──────────────────────────
		getProjectForPath: runtime.getProjectForPath,
		getWorkspaceProjects: runtime.getWorkspaceProjects,

		// ── Runtime IO ────────────────────────────────────────────────────────
		getWebcontainer: runtime.getWebcontainer,
		startRuntime: runtime.startRuntime,
		failRuntimeWithError: runtime.failRuntimeWithError,

		// ── Lifecycle ─────────────────────────────────────────────────────────
		mount
	};
}

export type WorkspaceController = ReturnType<typeof createWorkspaceController>;
