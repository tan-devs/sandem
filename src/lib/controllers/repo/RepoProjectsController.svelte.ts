import { untrack } from 'svelte';
import { createError } from '$lib/sveltekit/index.js';
import { createRuntimeManager } from '$lib/services/runtime/createRuntimeManager.svelte';
import { createRepoProjectManager } from '$lib/services/explorer/ProjectService.svelte';
import type { Doc } from '$convex/_generated/dataModel.js';
import type { FileSystemTree } from '@webcontainer/api';
import { VITE_REACT_TEMPLATE } from '$lib/utils/ide/template.js';
import { areProjectsEqual, projectFolderName, uniqueProjects } from '$lib/utils/projects.js';
import type { RepoLayoutData } from '$types/routes.js';
import type { ConvexOperations } from '$lib/services/explorer/ProjectService.svelte';

type ProjectDoc = Doc<'projects'>;

// Re-export so callers can import from one place.
export type { ConvexOperations };

type Options = {
	getInitialProjects: () => RepoLayoutData['projects'];
	getWorkspaceTree: () => FileSystemTree;
	isDemo: () => boolean;
	isGuest: () => boolean;
	ownerId: () => string;
	convexClient: ConvexOperations;
};

const DEMO_FOLDER = 'demo';

export function createRepoController(options: Options) {
	// The demo project has no Convex ID — it is never persisted.
	const demoProject = {
		files: VITE_REACT_TEMPLATE.files,
		room: undefined
	} as unknown as ProjectDoc;

	// ── UI state ──────────────────────────────────────────────────────────────

	let projects = $state<ProjectDoc[]>([]);
	let activeProjectId = $state<string | null>(null);
	let renamingProjectId = $state<string | null>(null);
	let pendingDeleteProjectId = $state<string | null>(null);

	// ── Runtime manager ───────────────────────────────────────────────────────

	const runtime = createRuntimeManager({
		isDemo: options.isDemo,
		getProjects: () => projects,
		getEntryPath: () => getEntryPath(),
		getWorkspaceTree: options.getWorkspaceTree
	});

	// ── Project CRUD manager ──────────────────────────────────────────────────

	const projects_ = createRepoProjectManager({
		getProjects: () => projects,
		setProjects: (p) => {
			projects = p;
		},
		getActiveProjectId: () => activeProjectId,
		setActiveProjectId: (id) => {
			activeProjectId = id;
		},
		convexClient: options.convexClient,
		ownerId: options.ownerId,
		onError: (err, cause) => runtime.failRuntimeWithError(err, cause)
	});

	// ── Derived state ─────────────────────────────────────────────────────────

	/**
	 * Maps project _id → workspace folder name.
	 * Used to resolve which project owns a given WebContainer path.
	 */
	const folderMap = $derived(
		new Map<string, string>(
			options.isDemo() ? [] : projects.map((p) => [p._id, projectFolderName(p._id, p.name)])
		)
	);

	const activeProject = $derived(
		options.isDemo()
			? null
			: (projects.find((p) => p._id === activeProjectId) ?? projects[0] ?? null)
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

	// ── Project sync (called from reactive layout on Convex subscription updates) ──

	function syncProjects(nextProjects: RepoLayoutData['projects']) {
		const unique = uniqueProjects(nextProjects);

		if (
			!areProjectsEqual(
				untrack(() => projects),
				unique
			)
		) {
			projects = unique;
		}

		const current = untrack(() => activeProjectId);
		if (!current || !unique.some((p) => p._id === current)) {
			const next = unique[0]?._id ?? null;
			if (current !== next) activeProjectId = next;
		}
	}

	// ── Path helpers ──────────────────────────────────────────────────────────

	function getFallbackProject(): ProjectDoc {
		if (options.isDemo()) return demoProject;
		return activeProject ?? projects[0] ?? demoProject;
	}

	/**
	 * Given a WebContainer path, resolve which project owns it.
	 * Matches on the leading folder segment via folderMap.
	 */
	function getProjectForPath(path?: string): ProjectDoc {
		if (options.isDemo()) return demoProject;
		if (!path) return getFallbackProject();
		const folder = path.split('/')[0];
		const match = projects.find((p) => folderMap.get(p._id) === folder);
		return match ?? getFallbackProject();
	}

	function getEntryPath(): string {
		if (options.isDemo()) {
			return `${DEMO_FOLDER}/${VITE_REACT_TEMPLATE.entry}`;
		}

		const project = activeProject ?? projects[0];
		if (!project) return `${DEMO_FOLDER}/${VITE_REACT_TEMPLATE.entry}`;

		const folder = folderMap.get(project._id) ?? projectFolderName(project._id, project.name);
		const entryFile = project.entry ?? VITE_REACT_TEMPLATE.entry;
		return `${folder}/${entryFile}`;
	}

	// ── UI action handlers ────────────────────────────────────────────────────

	function selectProject(projectId: string) {
		activeProjectId = projectId;
		pendingDeleteProjectId = null;
		renamingProjectId = null;
		if (typeof window !== 'undefined') {
			window.localStorage.setItem('sandem.activeProjectId', projectId);
		}
	}

	function startRename(projectId: string) {
		renamingProjectId = projectId;
		pendingDeleteProjectId = null;
	}

	function cancelRename() {
		renamingProjectId = null;
	}

	function requestDelete(projectId: string) {
		pendingDeleteProjectId = pendingDeleteProjectId === projectId ? null : projectId;
		renamingProjectId = null;
	}

	// ── Lifecycle ─────────────────────────────────────────────────────────────

	function mount() {
		if (!options.isDemo() && projects.length === 0) {
			projects = uniqueProjects(options.getInitialProjects().slice());
			activeProjectId = projects[0]?._id ?? null;
		}

		if (!options.isDemo()) {
			const fromStorage = window.localStorage.getItem('sandem.activeProjectId');
			if (fromStorage && projects.some((p) => p._id === fromStorage)) {
				activeProjectId = fromStorage;
			}
		}

		void runtime.startRuntime();

		const onUnhandledError = (event: ErrorEvent) => {
			const message = event.error instanceof Error ? event.error.message : event.message;
			if (!message) return;
			if (!/webcontainer|sandbox|terminal|mount/i.test(message)) return;
			runtime.failRuntimeWithError(
				createError('A runtime error occurred.'),
				event.error ?? message
			);
		};

		const onUnhandledRejection = (event: PromiseRejectionEvent) => {
			const message = event.reason instanceof Error ? event.reason.message : String(event.reason);
			if (!/webcontainer|sandbox|terminal|mount/i.test(message)) return;
			runtime.failRuntimeWithError(
				createError('A runtime promise rejection occurred.'),
				event.reason
			);
		};

		window.addEventListener('error', onUnhandledError);
		window.addEventListener('unhandledrejection', onUnhandledRejection);

		return () => {
			window.removeEventListener('error', onUnhandledError);
			window.removeEventListener('unhandledrejection', onUnhandledRejection);
			void runtime.stopRuntime();
		};
	}

	// ── Public interface ──────────────────────────────────────────────────────

	return {
		// UI state
		get projects() {
			return projects;
		},
		get activeProjectId() {
			return activeProjectId;
		},
		get renamingProjectId() {
			return renamingProjectId;
		},
		get pendingDeleteProjectId() {
			return pendingDeleteProjectId;
		},
		get creatingProject() {
			return projects_.creatingProject;
		},
		get mutatingProjectId() {
			return projects_.mutatingProjectId;
		},

		// Runtime state
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

		// Methods
		syncProjects,
		getProjectForPath,
		getEntryPath,
		selectProject,
		startRename,
		cancelRename,
		requestDelete,
		createProjectCard: projects_.createProjectCard,
		commitRename: projects_.commitRename,
		confirmDelete: projects_.confirmDelete,

		// Runtime access
		getWebcontainer: () => runtime.webcontainer,
		getWorkspaceProjects: () => projects.map((p) => ({ id: p._id, title: p.name })),
		startRuntime: () => runtime.startRuntime(),
		failRuntimeWithError: (err: ReturnType<typeof createError>, cause?: unknown) =>
			runtime.failRuntimeWithError(err, cause),
		mount
	};
}
