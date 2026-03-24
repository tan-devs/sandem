import type { ConvexProjectsApi, ProjectFolder } from '$types/projects';
import { createProjectPollingPolicy, type PollTickResult } from '$lib/controllers/project';

type Options = {
	projectsApi: ConvexProjectsApi;
	owner: string;
};

type ProjectSyncController = {
	projects: ProjectFolder[];
	loading: boolean;
	error: string | null;
	startPolling: () => void;
	stopPolling: () => void;
	syncProjects: (opts?: { silent?: boolean }) => Promise<void>;
	createProjectFolder: (title: string) => Promise<string | null>;
	deleteProjectFolder: (projectId: string) => Promise<boolean>;
};

function computeProjectSignature(values: ProjectFolder[]): string {
	return values
		.map((p) => `${p._id}:${p.title}`)
		.sort()
		.join('|');
}

export function createProjectSyncController(options: Options): ProjectSyncController {
	const { projectsApi, owner } = options;

	let projects = $state<ProjectFolder[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let syncInFlight: Promise<PollTickResult> | null = null;

	async function runSync(opts?: { silent?: boolean }): Promise<PollTickResult> {
		if (syncInFlight) return syncInFlight;

		const silent = !!opts?.silent;
		if (!silent) {
			loading = true;
			error = null;
		}

		syncInFlight = (async () => {
			try {
				if (!owner) {
					const changed = projects.length > 0;
					projects = [];
					error = null;
					return changed ? 'changed' : 'stable';
				}

				const before = computeProjectSignature(projects);
				const next = await projectsApi.list(owner);
				projects = next;
				error = null;

				const after = computeProjectSignature(next);
				return before === after ? 'stable' : 'changed';
			} catch (err) {
				error = err instanceof Error ? err.message : String(err);
				return 'error';
			} finally {
				syncInFlight = null;
				if (!silent) loading = false;
			}
		})();

		return syncInFlight;
	}

	const polling = createProjectPollingPolicy({
		tick: () => runSync({ silent: true })
	});

	async function syncProjects(opts?: { silent?: boolean }): Promise<void> {
		await runSync(opts);
	}

	function startPolling() {
		polling.start();
	}

	function stopPolling() {
		polling.stop();
	}

	async function createProjectFolder(title: string): Promise<string | null> {
		try {
			const id = await projectsApi.create(owner, title);
			polling.reset();
			await syncProjects();
			return id;
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
			return null;
		}
	}

	async function deleteProjectFolder(projectId: string): Promise<boolean> {
		try {
			await projectsApi.delete(owner, projectId);
			polling.reset();
			await syncProjects();
			return true;
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
			return false;
		}
	}

	return {
		get projects() {
			return projects;
		},
		get loading() {
			return loading;
		},
		get error() {
			return error;
		},
		startPolling,
		stopPolling,
		syncProjects,
		createProjectFolder,
		deleteProjectFolder
	};
}
