<script lang="ts">
	import { onMount, untrack, type Snippet } from 'svelte';

	import { useConvexClient, useQuery } from 'convex-svelte';
	import { api } from '$convex/_generated/api.js';

	import { PaneGroup, Pane, type PaneAPI } from 'paneforge';

	import { createSvelteAuthClient, useAuth } from '$lib/svelte/index.js';
	import { createError } from '$lib/sveltekit/index.js';
	import { projectFolderName } from '$lib/utils/ide/projects.js';

	import { authClient, setIDEContext } from '$lib/context';
	import { createRepoController, createLiveblocksEditorSync } from '$lib/controllers';
	import { createPanelsState, setPanelsContext } from '$lib/stores';

	import type { RepoLayoutData } from '$types/routes.js';

	import { ActivityBar } from '$lib/components/sidebar/activities';
	import Sidebar from '$lib/components/sidebar/Sidebar.svelte';
	import Statusbar from '$lib/components/workspace/Statusbar.svelte';
	import Resizer from '$lib/components/ui/primitives/Resizer.svelte';
	import ErrorPanel from '$lib/components/ui/primitives/ErrorPanel.svelte';

	let { children, data }: { children: Snippet; data: RepoLayoutData } = $props();

	const convexClient = useConvexClient();

	createSvelteAuthClient({ authClient, getServerState: () => data.authState });
	const auth = useAuth();

	const currentUserResponse = useQuery(
		api.auth.getCurrentUser,
		() => (auth.isAuthenticated ? {} : 'skip'),
		() => ({ initialData: data.currentUser, keepPreviousData: true })
	);

	const currentUser = $derived(currentUserResponse.data ?? data.currentUser);
	const isGuest = $derived(!currentUser);
	const isDemo = $derived(isGuest);
	const ownerId = $derived(currentUser?._id ?? '');

	// Live Convex subscription — authoritative project list.
	// createProjectSyncController (manual polling) is now redundant and deleted.
	const projectsResponse = useQuery(
		api.projects.getAllProjects,
		() => (ownerId ? { ownerId } : 'skip'),
		() => ({ initialData: data.projects, keepPreviousData: true })
	);

	const convexOps = {
		mutation: (mutationRef: unknown, args: Record<string, unknown>) =>
			convexClient.mutation(mutationRef as never, args as never),
		query: (queryRef: unknown, args: Record<string, unknown>) =>
			convexClient.query(queryRef as never, args as never)
	};

	const repo = createRepoController({
		getInitialProjects: () => data.projects,
		getWorkspaceTree: () => data.workspaceTree ?? {},
		isDemo: () => isDemo,
		isGuest: () => isGuest,
		ownerId: () => ownerId,
		convexClient: convexOps
	});

	// Seed from server data immediately (handles SSR initial state).
	$effect(() => {
		repo.syncProjects(data.projects);
	});

	// Keep project list in sync with the live Convex subscription.
	$effect(() => {
		if (isDemo) return;

		const queryState = projectsResponse as {
			data?: RepoLayoutData['projects'];
			error?: unknown;
		};

		if (queryState.error) {
			repo.failRuntimeWithError(
				createError('Failed to load projects for this workspace.', { code: 'INTERNAL_ERROR' }),
				queryState.error
			);
			return;
		}

		if (queryState.data) repo.syncProjects(queryState.data);
		else repo.syncProjects(data.projects);
	});

	// ── Liveblocks → WebContainer → Convex write pipeline ────────────────────
	//
	// getWorkspaceRoot() resolves the active project's folder name using the same
	// projectFolderName() utility that createRepoController uses internally, so
	// paths stay consistent across the multi-project workspace layout.
	//
	const editorSync = createLiveblocksEditorSync({
		getWebcontainer: () => repo.getWebcontainer(),
		persistFile: async (path, content) => {
			await convexClient.mutation(api.filesystem.upsertFile, { path, content });
		},
		getWorkspaceRoot: () => {
			const p = repo.activeProject;
			return p ? projectFolderName(p._id, p.title) : '';
		},
		onError: (target, path, err) =>
			console.error(`[editorSync:${target}] write failed — "${path}"`, err)
	});
	// ─────────────────────────────────────────────────────────────────────────

	const panels = createPanelsState({ activeTab: 'explorer' });
	setPanelsContext(panels);

	let sidebar = $state<PaneAPI>();

	$effect(() => {
		const open = panels.leftPane;
		untrack(() => (open ? sidebar?.expand() : sidebar?.collapse()));
	});

	const runtimePhase = $derived(repo.runtimePhase);
	const runtimeError = $derived(repo.runtimeError);
	const ready = $derived(repo.ready);
	const statusText = $derived(repo.statusText);
	const activeProjectId = $derived(repo.activeProjectId);
	const renamingProjectId = $derived(repo.renamingProjectId);
	const pendingDeleteProjectId = $derived(repo.pendingDeleteProjectId);
	const mutatingProjectId = $derived(repo.mutatingProjectId);
	const creatingProject = $derived(repo.creatingProject);

	setIDEContext({
		getWebcontainer: repo.getWebcontainer,
		getProject: repo.getProjectForPath,
		getEntryPath: repo.getEntryPath,
		getWorkspaceProjects: repo.getWorkspaceProjects,
		getActiveProjectId: () => activeProjectId,
		getRenamingProjectId: () => renamingProjectId,
		getPendingDeleteProjectId: () => pendingDeleteProjectId,
		getMutatingProjectId: () => mutatingProjectId,
		isCreatingProject: () => creatingProject,
		createProject: repo.createProjectCard,
		selectProject: repo.selectProject,
		startRenameProject: repo.startRename,
		cancelRenameProject: repo.cancelRename,
		commitRenameProject: repo.commitRename,
		requestDeleteProject: repo.requestDelete,
		confirmDeleteProject: repo.confirmDelete,
		// Exposed so editor tabs can call watch/unwatch/flush directly.
		editorSync
	});

	onMount(() => {
		const cleanup = repo.mount();
		return () => {
			editorSync.destroy();
			cleanup?.();
		};
	});
</script>

<!-- html -->

<div class="container">
	<main class="repo-layout">
		<ActivityBar {panels} />

		<section class="workspace-shell">
			<PaneGroup direction="horizontal">
				<Pane bind:this={sidebar} collapsible collapsedSize={0} defaultSize={18}>
					<Sidebar />
				</Pane>

				<Resizer />

				<Pane>
					{#if runtimePhase === 'failed'}
						<ErrorPanel
							title="Sandbox failed to start"
							description="The IDE hit a WebContainer runtime error. You can recover without refreshing."
							message={runtimeError ?? 'Unknown runtime error.'}
							testId="runtime-recovery-ui"
						>
							{#snippet actions()}
								<button class="action" onclick={() => void repo.startRuntime()}>
									Retry runtime
								</button>
								<button
									class="action"
									onclick={() => {
										panels.leftPane = true;
										panels.downPane = true;
										panels.rightPane = true;
									}}
								>
									Reset pane visibility
								</button>
							{/snippet}
						</ErrorPanel>
					{:else if ready}
						{@render children()}
					{:else}
						<p class="booting-msg">
							{isDemo ? 'Spinning up demo sandbox…' : 'Loading your projects…'}
						</p>
					{/if}
				</Pane>
			</PaneGroup>
		</section>
	</main>

	<Statusbar status={statusText} {isGuest} />
</div>

<!-- /html -->

<style>
	.container {
		display: grid;
		grid-template-rows: 1fr auto;
		max-height: 100dvh;
		height: 100%;
		overflow: hidden;
	}

	.repo-layout {
		display: grid;
		grid-template-columns: auto 1fr;
		height: 100%;
	}

	.workspace-shell {
		display: grid;
		grid-template-rows: 1fr;
		min-height: 0;
	}

	.action {
		font-size: 0.72rem;
		padding: 0.2rem 0.4rem;
		border: 1px solid var(--border);
		border-radius: 0.35rem;
		background: transparent;
		color: var(--text);
		cursor: pointer;
	}

	.action:hover:not(:disabled) {
		background: var(--fg);
	}

	.booting-msg {
		padding: 1rem;
		color: var(--muted);
	}
</style>
