/**
 * createWorkspaceRuntime.svelte.ts
 *
 * Workspace runtime orchestration service.
 *
 * CHANGE: Accepts optional `getExternalWebcontainer` and passes it to
 * createRuntimeManager so the pre-booted wcSingleton instance is used
 * instead of calling WebContainer.boot() again.
 */

import {
	createRuntimeManager,
	createRepoProjectManager,
	type ConvexOperations
} from '$lib/services/webcontainer';
import { VITE_REACT_TEMPLATE } from '$lib/utils';
import { projectFolderName } from '$lib/utils/explorer/projects.js';
import { createError } from '$lib/sveltekit/index.js';
import type { Doc, Id } from '$convex/_generated/dataModel.js';
import { WebContainer, type FileSystemTree } from '@webcontainer/api';
import type { WorkspaceStore } from '$lib/stores/workspace/workspace.store.svelte.js';

export type { ConvexOperations };

type ProjectDoc = Doc<'projects'>;

export type WorkspaceRuntimeOptions = {
	store: WorkspaceStore;
	getWorkspaceTree: () => FileSystemTree;
	isDemo: () => boolean;
	isGuest: () => boolean;
	ownerId: () => string | null;
	convexClient: ConvexOperations;
	/**
	 * When provided, the runtime skips WebContainer.boot() and uses this
	 * instance directly. Pass `wcSingleton.getWebcontainer` from the
	 * sandbox context set by (app)/+layout.svelte.
	 */
	getExternalWebcontainer?: () => Promise<WebContainer>;
};

const DEMO_FOLDER = 'demo';

const demoProject = {
	files: VITE_REACT_TEMPLATE.files,
	room: undefined
} as unknown as ProjectDoc;

export function createWorkspaceRuntime(options: WorkspaceRuntimeOptions) {
	const { store } = options;

	const runtime = createRuntimeManager({
		isDemo: options.isDemo,
		getProjects: () => store.projects.projects,
		getEntryPath: () => getEntryPath(),
		getWorkspaceTree: options.getWorkspaceTree,
		getExternalWebcontainer: options.getExternalWebcontainer
	});

	const projectManager = createRepoProjectManager({
		getProjects: () => store.projects.projects,
		setProjects: (p) => store.projects.setProjects(p),
		getActiveProjectId: () => store.projects.activeProjectId,
		setActiveProjectId: (id) => store.projects.setActiveProjectId(id),
		convexClient: options.convexClient,
		// options.ownerId is () => string — guests get a localStorage UUID,
		// real users get their Convex Id. Cast here since createRepoProjectManager
		// expects Id<'users'>; guest operations are skipped at the Convex layer.
		ownerId: () => options.ownerId() as Id<'users'>,
		onError: (err, cause) =>
			runtime.failRuntimeWithError(
				createError(err.message ?? 'A project operation failed.'),
				cause ?? err
			)
	});

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

	return {
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
		get creatingProject() {
			return projectManager.creatingProject;
		},
		get mutatingProjectId() {
			return projectManager.mutatingProjectId;
		},
		getProjectForPath,
		getEntryPath,
		getWorkspaceProjects: () =>
			store.projects.projects.map((p) => ({
				id: p._id,
				name: p.name,
				isPublic: p.isPublic ?? false,
				room: p.room ?? '',
				entry: p.entry
			})),
		startRuntime: () => runtime.startRuntime(),
		stopRuntime: () => runtime.stopRuntime(),
		failRuntimeWithError: (err: ReturnType<typeof createError>, cause?: unknown) =>
			runtime.failRuntimeWithError(err, cause),
		getWebcontainer: () => {
			if (!runtime.webcontainer) throw new Error('WebContainer is not initialized.');
			return runtime.webcontainer;
		},
		createProjectCard: projectManager.createProjectCard,
		commitRename: projectManager.commitRename,
		confirmDelete: projectManager.confirmDelete
	};
}

export type WorkspaceRuntime = ReturnType<typeof createWorkspaceRuntime>;
