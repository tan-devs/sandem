/**
 * WorkspaceController.svelte.ts
 *
 * Assembly root for the workspace system.
 *
 * CHANGE: Accepts optional `getExternalWebcontainer` from sandbox context
 * and passes it down to createWorkspaceRuntime → createRuntimeManager,
 * bypassing WebContainer.boot() when the singleton is already booting.
 */

import { createWorkspaceStore } from '$lib/stores/workspace/workspace.store.svelte.js';
import { createPanelsController } from '$lib/controllers/panels';
import {
	createWorkspaceRuntime,
	type ConvexOperations
} from '$lib/services/workspace/createWorkspaceRuntime.svelte.js';
import {
	createWorkspaceEditorSync,
	type WorkspaceEditorSync
} from '$lib/services/workspace/createWorkspaceEditorsync.svelte';
import { useWorkspace } from '$lib/hooks/useWorkspace.svelte.js';
import { type IDEContext, setIDEContext } from '$lib/context/webcontainer';
import { setWorkspaceContext } from '$lib/context/workspace';
import { api } from '$convex/_generated/api.js';
import { projectFolderName } from '$lib/utils/explorer/projects.js';
import type { PaneAPI } from 'paneforge';
import type { FileSystemTree, WebContainer } from '@webcontainer/api';
import type { RepoLayoutData } from '$types/routes.js';
import type { Id } from '$convex/_generated/dataModel.js';

export type { ConvexOperations, WorkspaceEditorSync };

export type WorkspaceControllerOptions = {
	getData: () => RepoLayoutData;
	isGuest: () => boolean;
	/**
	 * Always a plain string. Real users pass their Convex Id (which is a
	 * branded string), guests pass a localStorage-persisted UUID. The cast
	 * to Id<'users'> happens inside the controller at the runtime boundary.
	 */
	ownerId: () => string;
	convexClient: ConvexOperations;
	getSidebar: () => PaneAPI | undefined;
	getProjectsData: () => RepoLayoutData['projects'] | undefined;
	getProjectsError: () => unknown;
	/**
	 * When provided, skip WebContainer.boot() and use this instance.
	 * Use wcSingleton.waitForWebcontainer() — the async form — so this is
	 * safe to call before boot completes.
	 * If undefined, the runtime boots its own instance (legacy fallback).
	 */
	getExternalWebcontainer?: () => Promise<WebContainer>;
};

export function createWorkspaceController(options: WorkspaceControllerOptions) {
	// ── 1. Projects store ─────────────────────────────────────────────────────

	const store = createWorkspaceStore();

	// ── 2. Panels ─────────────────────────────────────────────────────────────

	const panelsCtrl = createPanelsController({ getSidebar: options.getSidebar });

	// ── 3. Runtime ────────────────────────────────────────────────────────────

	const runtime = createWorkspaceRuntime({
		store,
		getWorkspaceTree: () =>
			(options.getData().workspaceTree as FileSystemTree) ?? ({} as FileSystemTree),
		isDemo: () => false,
		isGuest: () => options.isGuest(),
		// options.ownerId is () => string — cast here since createRepoProjectManager
		// expects Id<'users'>; guest Convex ops are skipped at the service layer.
		ownerId: () => options.ownerId() as Id<'users'>,
		convexClient: options.convexClient,
		// Pass through — undefined is safe, runtime falls back to boot()
		getExternalWebcontainer: options.getExternalWebcontainer
	});

	// ── 4. Editor sync ────────────────────────────────────────────────────────

	const editorSync = createWorkspaceEditorSync({
		getWebcontainer: () => runtime.getWebcontainer(),
		persistFile: async (path, content) => {
			const active = runtime.activeProject;
			if (!active) return;
			await options.convexClient.mutation(api.filesystem.upsertFile, {
				projectId: active._id,
				path,
				content
			});
		},
		getWorkspaceRoot: () => {
			const p = runtime.activeProject;
			return p ? projectFolderName(p._id, p.name) : '';
		},
		onError: (target, path, err) =>
			console.error(`[editorSync:${target}] write failed — "${path}"`, err)
	});

	// ── 5. Hook ───────────────────────────────────────────────────────────────

	const { mount } = useWorkspace({
		store,
		runtime,
		getProjectsData: options.getProjectsData,
		getProjectsError: options.getProjectsError,
		getInitialProjects: () => options.getData().projects,
		isGuest: options.isGuest
	});

	// ── 6. IDE context ────────────────────────────────────────────────────────

	setIDEContext({
		getWebcontainer: runtime.getWebcontainer,
		getProject: runtime.getProjectForPath as IDEContext['getProject'],
		getEntryPath: runtime.getEntryPath,
		getPanels: () => panelsCtrl.panels,
		editorSync
	});

	// ── 7. Workspace context ──────────────────────────────────────────────────

	setWorkspaceContext({
		getWorkspaceProjects: runtime.getWorkspaceProjects,
		getActiveProjectId: () => store.projects.activeProjectId,
		getRenamingProjectId: () => store.projects.renamingProjectId,
		getPendingDeleteProjectId: () => store.projects.pendingDeleteProjectId,
		getMutatingProjectId: () => runtime.mutatingProjectId,
		isCreatingProject: () => runtime.creatingProject,
		createProject: runtime.createProjectCard,
		selectProject: (id) => store.projects.selectProject(id),
		startRenameProject: (id) => store.projects.startRename(id),
		cancelRenameProject: () => store.projects.cancelRename(),
		commitRenameProject: runtime.commitRename,
		requestDeleteProject: (id) => store.projects.requestDelete(id),
		confirmDeleteProject: runtime.confirmDelete
	});

	// ── Public API ────────────────────────────────────────────────────────────

	return {
		mount,
		destroyEditorSync: () => editorSync.destroy(),
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
			return runtime.statusText;
		},
		panels: panelsCtrl.panels,
		get leftPane() {
			return panelsCtrl.leftPane;
		},
		get downPane() {
			return panelsCtrl.downPane;
		},
		get rightPane() {
			return panelsCtrl.rightPane;
		},
		setLeft: panelsCtrl.setLeft,
		setDown: panelsCtrl.setDown,
		setRight: panelsCtrl.setRight,
		toggleLeft: panelsCtrl.toggleLeft,
		toggleDown: panelsCtrl.toggleDown,
		toggleRight: panelsCtrl.toggleRight,
		resetPanes: panelsCtrl.resetAll,
		get activeProjectId() {
			return store.projects.activeProjectId;
		},
		startRuntime: () => runtime.startRuntime(),
		editorSync
	};
}

export type WorkspaceController = ReturnType<typeof createWorkspaceController>;
