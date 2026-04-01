/**
 * WorkspaceController.svelte.ts
 *
 * Assembly root for the workspace system.
 * Analogous to TerminalController in the terminal system.
 *
 * This is the only file allowed to instantiate workspace services.
 * +layout.svelte calls createWorkspaceController() and consumes
 * the returned flat API. Nothing else should reach into sub-services.
 *
 * Instantiation order:
 *   1. createWorkspaceProjectsStore()     — projects reactive state ($state, pure)
 *   2. createPanelsController(...)        — panels $state + service + PaneAPI $effect
 *   3. createWorkspaceRuntime(...)        — runtime + project orchestration
 *   4. createWorkspaceEditorSync(...)     — Liveblocks ↔ WebContainer ↔ Convex bridge
 *   5. useWorkspace(...)                  — project $effects + mount/cleanup
 *   6. setIDEContext(...)                 — registers workspace surface in Svelte context
 *
 * Returned API surface (all delegated — no logic lives here):
 *
 * | Category       | Properties / Methods                                              |
 * | -------------- | ----------------------------------------------------------------- |
 * | Lifecycle      | mount, destroyEditorSync                                          |
 * | Runtime state  | runtimePhase, runtimeError, ready, statusText                     |
 * | Panel object   | panels  (IDEPanels-compatible — pass to ActivityBar/useActivity)  |
 * | Panel state    | leftPane, downPane, rightPane                                     |
 * | Panel actions  | setLeft, setDown, setRight, toggleLeft, toggleDown, toggleRight   |
 * |                | resetPanes                                                        |
 * | Project state  | activeProjectId                                                   |
 * | Runtime action | startRuntime                                                      |
 * | Editor sync    | editorSync (watch, unwatch, flush, flushAll, destroy)             |
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
import { setIDEContext, type IDEContext } from '$lib/context/ide-context.js';
import { api } from '$convex/_generated/api.js';
import { projectFolderName } from '$lib/utils/explorer/projects.js';
import type { PaneAPI } from 'paneforge';
import type { FileSystemTree } from '@webcontainer/api';
import type { RepoLayoutData } from '$types/routes.js';
import type { Id } from '$convex/_generated/dataModel.js';

export type { ConvexOperations, WorkspaceEditorSync };

export type WorkspaceControllerOptions = {
	getData: () => RepoLayoutData;
	isGuest: () => boolean;
	ownerId: () => Id<'users'> | null;
	convexClient: ConvexOperations;
	getSidebar: () => PaneAPI | undefined;
	getProjectsData: () => RepoLayoutData['projects'] | undefined;
	getProjectsError: () => unknown;
};

export function createWorkspaceController(options: WorkspaceControllerOptions) {
	// ── 1. Projects store ─────────────────────────────────────────────────────
	//
	// Panels store is now owned by PanelsController (step 2).
	// workspace.store still composes both — we destructure projects out of it
	// so the rest of the controller is unchanged.

	const store = createWorkspaceStore();

	// ── 2. Panels ─────────────────────────────────────────────────────────────
	//
	// Self-contained: owns its own $state, service (persist/toggle), and the
	// $effect that syncs store.leftPane → PaneAPI.expand/collapse.
	// Exposes `panels` (IDEPanels-compatible) for the activity system and
	// individual getters/setters for the public API below.

	const panelsCtrl = createPanelsController({ getSidebar: options.getSidebar });

	// ── 3. Runtime ────────────────────────────────────────────────────────────

	const runtime = createWorkspaceRuntime({
		store,
		getWorkspaceTree: () =>
			(options.getData().workspaceTree as unknown as FileSystemTree) ?? ({} as FileSystemTree),
		isDemo: () => options.isGuest(),
		isGuest: () => options.isGuest(),
		ownerId: () => options.ownerId() ?? ('' as Id<'users'>),
		convexClient: options.convexClient
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
	//
	// useWorkspace registers project-related $effects (sync, sidebar open on
	// project switch, etc). PaneAPI sync has moved to PanelsController/usePanels —
	// getSidebar is kept here only for the duration until useWorkspace is updated
	// to remove its own sidebar $effect.

	const { mount } = useWorkspace({
		store,
		runtime,
		getSidebar: options.getSidebar,
		getProjectsData: options.getProjectsData,
		getProjectsError: options.getProjectsError,
		getInitialProjects: () => options.getData().projects,
		isGuest: options.isGuest
	});

	// ── 6. IDE context ────────────────────────────────────────────────────────

	setIDEContext({
		getActiveProjectId: () => store.projects.activeProjectId,
		getRenamingProjectId: () => store.projects.renamingProjectId,
		getPendingDeleteProjectId: () => store.projects.pendingDeleteProjectId,
		getMutatingProjectId: () => runtime.mutatingProjectId,
		isCreatingProject: () => runtime.creatingProject,

		getWebcontainer: runtime.getWebcontainer,

		getProject: runtime.getProjectForPath as IDEContext['getProject'],

		getEntryPath: runtime.getEntryPath,
		getWorkspaceProjects: runtime.getWorkspaceProjects,

		createProject: runtime.createProjectCard,
		selectProject: (id) => store.projects.selectProject(id),
		startRenameProject: (id) => store.projects.startRename(id),
		cancelRenameProject: () => store.projects.cancelRename(),
		commitRenameProject: runtime.commitRename,
		requestDeleteProject: (id) => store.projects.requestDelete(id),
		confirmDeleteProject: runtime.confirmDelete,
		editorSync
	});

	// ── Public API ────────────────────────────────────────────────────────────

	return {
		// ── Lifecycle ──────────────────────────────────────────────────────────
		mount,
		destroyEditorSync: () => editorSync.destroy(),

		// ── Runtime state ──────────────────────────────────────────────────────
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

		// ── Panel object ───────────────────────────────────────────────────────
		//
		// IDEPanels-compatible — pass directly to ActivityBar and useActivity:
		//   <ActivityBar getPanels={() => ctrl.panels} />
		//   useActivity({ getPanels: () => ctrl.panels })
		panels: panelsCtrl.panels,

		// ── Panel state ────────────────────────────────────────────────────────
		get leftPane() {
			return panelsCtrl.leftPane;
		},
		get downPane() {
			return panelsCtrl.downPane;
		},
		get rightPane() {
			return panelsCtrl.rightPane;
		},

		// ── Panel actions ──────────────────────────────────────────────────────
		setLeft: panelsCtrl.setLeft,
		setDown: panelsCtrl.setDown,
		setRight: panelsCtrl.setRight,
		toggleLeft: panelsCtrl.toggleLeft,
		toggleDown: panelsCtrl.toggleDown,
		toggleRight: panelsCtrl.toggleRight,
		resetPanes: panelsCtrl.resetAll,

		// ── Project state ──────────────────────────────────────────────────────
		get activeProjectId() {
			return store.projects.activeProjectId;
		},

		// ── Runtime action ─────────────────────────────────────────────────────
		startRuntime: () => runtime.startRuntime(),

		// ── Editor sync ────────────────────────────────────────────────────────
		editorSync
	};
}

export type WorkspaceController = ReturnType<typeof createWorkspaceController>;
