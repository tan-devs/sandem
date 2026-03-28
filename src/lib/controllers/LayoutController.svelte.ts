import type { PaneAPI } from 'paneforge';
import { createRepoController, type ConvexOperations } from './RepoController.svelte.js';
import { createLiveblocksEditorSync } from '$lib/controllers';
import type { EditorSync } from '$lib/controllers/LiveblocksSyncController.svelte';
import { createPanelsState } from '$lib/stores';
import { setIDEContext } from '$lib/context/ide-context.js';
import { projectFolderName } from '$lib/utils/projects.js';
import { api } from '$convex/_generated/api.js';
import { createError } from '$lib/sveltekit/index.js';
import type { RepoLayoutData } from '$types/routes.js';
import type { Id } from '$convex/_generated/dataModel.js';
import type { FileSystemTree } from '@webcontainer/api';

// ConvexOperations is owned by RepoProjectsController and re-exported here
// so layout consumers can import it from a single controller path if needed.
export type { ConvexOperations };

export type RepoLayoutContext = {
	getData: () => RepoLayoutData;
	isGuest: () => boolean;
	ownerId: () => Id<'users'> | null;
	// The convex-svelte client from useConvexClient() satisfies ConvexOperations directly.
	// No wrapper function needed.
	convexClient: ConvexOperations;
};

export type RepoLayoutSetup = {
	repo: ReturnType<typeof createRepoController>;
	editorSync: EditorSync;
	panels: ReturnType<typeof createPanelsState>;
	sidebar?: PaneAPI;
};

export function setupRepoLayout(context: RepoLayoutContext): RepoLayoutSetup {
	const repo = createRepoController({
		getInitialProjects: () => context.getData().projects,
		getWorkspaceTree: () =>
			(context.getData().workspaceTree as unknown as FileSystemTree) ?? ({} as FileSystemTree),
		isDemo: () => context.isGuest(),
		isGuest: () => context.isGuest(),
		ownerId: () => context.ownerId() ?? '',
		convexClient: context.convexClient
	});

	const editorSync = createLiveblocksEditorSync({
		getWebcontainer: () => repo.getWebcontainer(),
		persistFile: async (path, content) => {
			const activeProject = repo.activeProject;
			if (!activeProject) {
				return;
			}

			await context.convexClient.mutation(api.filesystem.upsertFile, {
				projectId: activeProject._id,
				path,
				content
			});
		},
		getWorkspaceRoot: () => {
			const p = repo.activeProject;
			return p ? projectFolderName(p._id, p.name) : '';
		},
		onError: (target, path, err) =>
			console.error(`[editorSync:${target}] write failed — "${path}"`, err)
	});

	const panels = createPanelsState({ activeTab: 'explorer' });

	setIDEContext({
		getActiveProjectId: () => repo.activeProjectId,
		getRenamingProjectId: () => repo.renamingProjectId,
		getPendingDeleteProjectId: () => repo.pendingDeleteProjectId,
		getMutatingProjectId: () => repo.mutatingProjectId,
		isCreatingProject: () => repo.creatingProject,

		getWebcontainer: repo.getWebcontainer,
		getProject: repo.getProjectForPath,
		getEntryPath: repo.getEntryPath,
		getWorkspaceProjects: repo.getWorkspaceProjects,
		createProject: repo.createProjectCard,
		selectProject: repo.selectProject,
		startRenameProject: repo.startRename,
		cancelRenameProject: repo.cancelRename,
		commitRenameProject: repo.commitRename,
		requestDeleteProject: repo.requestDelete,
		confirmDeleteProject: repo.confirmDelete,
		editorSync
	});

	return { repo, editorSync, panels };
}

export function syncRepoProjects(
	repo: ReturnType<typeof createRepoController>,
	isGuest: boolean,
	projectsData: RepoLayoutData['projects'] | undefined,
	projectsError: unknown,
	initialProjects: RepoLayoutData['projects']
): void {
	if (isGuest) {
		repo.syncProjects(initialProjects);
		return;
	}

	if (projectsError) {
		repo.failRuntimeWithError(
			createError('Failed to load projects for this workspace.', { code: 'INTERNAL_ERROR' }),
			projectsError
		);
		return;
	}

	repo.syncProjects(projectsData ?? initialProjects);
}
