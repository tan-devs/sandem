<script lang="ts">
	/**
	 * routes/(app)/[repo]/+layout.svelte
	 *
	 * IDE shell. Consumes the pre-booted WebContainer singleton and preloaded
	 * projects from sandbox context set by (app)/+layout.svelte.
	 *
	 * Auth client is initialized in (app)/+layout.svelte — useAuth() here
	 * reads from that already-initialized client, no re-initialization needed.
	 */

	import { onMount, type Snippet } from 'svelte';

	import { useConvexClient, useQuery } from 'convex-svelte';
	import { api } from '$convex/_generated/api.js';
	import { PaneGroup, Pane, type PaneAPI } from 'paneforge';

	import { useAuth } from '$lib/svelte';
	import { createWorkspaceController } from '$lib/controllers/workspace';
	import { useActivity } from '$lib/hooks/useActivity.svelte.js';
	import { requireSandboxContext } from '$lib/context/webcontainer';

	import type { RepoLayoutData } from '$types/routes.js';
	import type { Id } from '$convex/_generated/dataModel.js';

	import { Statusbar } from '$lib/components/workspace';
	import { Resizer, ErrorPanel } from '$lib/components/primitives';
	import { ActivityBar } from '$lib/components/activity';
	import { SidebarPanel } from '$lib/components/panels';

	let { children, data }: { children: Snippet; data: RepoLayoutData } = $props();

	// ── Sandbox context ───────────────────────────────────────────────────────
	// wcSingleton is already booting (started in (app)/+layout.svelte onMount).
	// preloadedProjects were fetched silently while user was on home page.

	const sandbox = requireSandboxContext();

	const convexClient = useConvexClient();
	const auth = useAuth();

	// ── Identity ──────────────────────────────────────────────────────────────

	const currentUserResponse = useQuery(
		api.auth.getCurrentUser,
		() => (auth.isAuthenticated ? {} : 'skip'),
		() => ({ initialData: data.currentUser, keepPreviousData: true })
	);

	const currentUser = $derived(currentUserResponse.data ?? data.currentUser);
	const isGuest = $derived(!currentUser);
	const ownerId = $derived<Id<'users'> | null>(currentUser?._id ?? null);

	// ── Projects ──────────────────────────────────────────────────────────────
	// initialData comes from sandbox.getPreloadedProjects() — already fetched
	// at app layout level. Falls back to data.projects (SSR) if not yet ready.

	const projectsResponse = useQuery(
		api.projects.getAllProjects,
		() => (ownerId ? { ownerId } : 'skip'),
		() => ({
			initialData: sandbox.getPreloadedProjects().length
				? sandbox.getPreloadedProjects()
				: data.projects,
			keepPreviousData: true
		})
	);

	let sidebar = $state<PaneAPI>();

	// ── Workspace controller ──────────────────────────────────────────────────

	const ctrl = createWorkspaceController({
		getData: () => data,
		isGuest: () => isGuest,
		ownerId: () => ownerId,
		convexClient,
		getSidebar: () => sidebar,
		getProjectsData: () => projectsResponse.data,
		getProjectsError: () => projectsResponse.error,
		getExternalWebcontainer: () => sandbox.wc.getWebcontainer()
	});

	const activity = useActivity({ getPanels: () => ctrl.panels });

	onMount(() => {
		const cleanup = ctrl.mount();
		return () => {
			ctrl.destroyEditorSync();
			cleanup?.();
		};
	});
</script>

<!-- html -->

<div class="container">
	<main class="repo-layout">
		<ActivityBar getPanels={() => ctrl.panels} />

		<section class="workspace-shell">
			<PaneGroup direction="horizontal">
				<Pane bind:this={sidebar} collapsible collapsedSize={0} defaultSize={18}>
					<SidebarPanel activeTab={activity.activeTab} getPanels={() => ctrl.panels} />
				</Pane>

				<Resizer />

				<Pane>
					{#if ctrl.runtimePhase === 'failed'}
						<ErrorPanel
							title="Sandbox failed to start"
							description="The IDE hit a WebContainer runtime error. You can recover without refreshing."
							message={ctrl.runtimeError ?? 'Unknown runtime error.'}
							testId="runtime-recovery-ui"
						>
							{#snippet actions()}
								<button class="action" onclick={() => void ctrl.startRuntime()}>
									Retry runtime
								</button>
								<button class="action" onclick={() => ctrl.resetPanes()}>
									Reset pane visibility
								</button>
							{/snippet}
						</ErrorPanel>
					{:else if ctrl.ready}
						{@render children()}
					{:else}
						<p class="booting-msg">
							{isGuest ? 'Spinning up demo sandbox…' : 'Loading your projects…'}
						</p>
					{/if}
				</Pane>
			</PaneGroup>
		</section>
	</main>

	<Statusbar status={ctrl.statusText} {isGuest} panels={ctrl.panels} />
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
