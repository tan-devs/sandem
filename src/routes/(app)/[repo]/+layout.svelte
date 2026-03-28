<script lang="ts">
	import { onMount, untrack, type Snippet } from 'svelte';

	import { useConvexClient, useQuery } from 'convex-svelte';
	import { api } from '$convex/_generated/api.js';
	import { PaneGroup, Pane, type PaneAPI } from 'paneforge';

	import { createSvelteAuthClient, useAuth } from '$lib/svelte/index.js';
	import { authClient } from '$lib/context/auth';
	import {
		setupRepoLayout,
		syncRepoProjects
	} from '$lib/controllers/repo/RepoLayoutController.svelte';

	import type { RepoLayoutData } from '$types/routes.js';
	import type { Id } from '$convex/_generated/dataModel.js';

	import { ActivityBar } from '$lib/components/sidebar/activities';
	import Sidebar from '$lib/components/sidebar/Sidebar.svelte';
	import Statusbar from '$lib/components/workspace/Statusbar.svelte';
	import Resizer from '$lib/components/ui/primitives/Resizer.svelte';
	import ErrorPanel from '$lib/components/ui/primitives/ErrorPanel.svelte';

	import { setPanelsContext } from '$lib/stores';

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

	// Typed as null when unauthenticated — the query's 'skip' guard handles the falsy case.
	// Previously typed as Id<'users'> | '' which is misleading ('' is not a valid user ID).
	const ownerId = $derived<Id<'users'> | null>(currentUser?._id ?? null);

	// Live Convex subscription — authoritative project list.
	const projectsResponse = useQuery(
		api.projects.getAllProjects,
		() => (ownerId ? { ownerId } : 'skip'),
		() => ({ initialData: data.projects, keepPreviousData: true })
	);

	const { repo, editorSync, panels } = setupRepoLayout({
		getData: () => data,
		isGuest: () => isGuest,
		ownerId: () => ownerId,
		convexClient
	});
	setPanelsContext(panels);

	// Single effect handles both the initial SSR seed and live subscription updates.
	// Previously split across two effects, causing redundant syncs on every render.
	$effect(() => {
		syncRepoProjects(
			repo,
			Boolean(isGuest),
			projectsResponse.data,
			projectsResponse.error,
			data.projects
		);
	});

	let sidebar = $state<PaneAPI>();

	$effect(() => {
		const open = panels.leftPane;
		untrack(() => (open ? sidebar?.expand() : sidebar?.collapse()));
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
					{#if repo.runtimePhase === 'failed'}
						<ErrorPanel
							title="Sandbox failed to start"
							description="The IDE hit a WebContainer runtime error. You can recover without refreshing."
							message={repo.runtimeError ?? 'Unknown runtime error.'}
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
					{:else if repo.ready}
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

	<Statusbar status={repo.statusText} {isGuest} />
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
