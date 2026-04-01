<script lang="ts">
	import { onMount, type Snippet } from 'svelte';

	import { useConvexClient, useQuery } from 'convex-svelte';
	import { api } from '$convex/_generated/api.js';
	import { PaneGroup, Pane, type PaneAPI } from 'paneforge';

	import { createSvelteAuthClient, useAuth } from '$lib/svelte';
	import { authClient } from '$lib/context';
	import { createWorkspaceController } from '$lib/controllers/workspace';
	import { useActivity } from '$lib/hooks/useActivity.svelte.js';

	import type { RepoLayoutData } from '$types/routes.js';
	import type { Id } from '$convex/_generated/dataModel.js';

	import { Statusbar } from '$lib/components/workspace';
	import { Resizer, ErrorPanel } from '$lib/components/primitives';
	import { ActivityBar } from '$lib/components/activity';
	import { SidebarPanel } from '$lib/components/panels';

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
	const ownerId = $derived<Id<'users'> | null>(currentUser?._id ?? null);

	const projectsResponse = useQuery(
		api.projects.getAllProjects,
		() => (ownerId ? { ownerId } : 'skip'),
		() => ({ initialData: data.projects, keepPreviousData: true })
	);

	let sidebar = $state<PaneAPI>();

	const ctrl = createWorkspaceController({
		getData: () => data,
		isGuest: () => isGuest,
		ownerId: () => ownerId,
		convexClient,
		getSidebar: () => sidebar,
		getProjectsData: () => projectsResponse.data,
		getProjectsError: () => projectsResponse.error
	});

	// useActivity is called here solely to read activeTab for prop injection into
	// SidebarPanel. ActivityBar creates its own instance internally (for keyboard
	// mount lifecycle). Both instances share the same activityStore $state so
	// they always reflect the same value — no duplication of side effects.
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
					<!--
						activeTab flows from activityStore → useActivity → prop.
						SidebarPanel never touches the store directly.
					-->
					<SidebarPanel activeTab={activity.activeTab} />
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

	<Statusbar status={ctrl.statusText} {isGuest} />
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
