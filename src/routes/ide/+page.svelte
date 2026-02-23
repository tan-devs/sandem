<script lang="ts">
	import { useQuery, useConvexClient } from 'convex-svelte';
	import { WebContainer } from '@webcontainer/api';
	import { api } from '$convex/_generated/api.js';
	import type { Doc } from '$convex/_generated/dataModel.js';
	import { VITE_REACT_TEMPLATE } from '$lib/templates.js';

	import { PaneGroup, Pane, PaneResizer } from 'paneforge';
	import Editor from '$lib/components/Editor.svelte';
	import Preview from '$lib/components/Preview.svelte';
	import Terminal from '$lib/components/Terminal.svelte';

	// 1. Get user from BOTH sources
	let { data }: { data: { user?: { id: string } } } = $props();
	const currentUser = useQuery(api.auth.getCurrentUser, {});
	const convexClient = useConvexClient();

	let wc = $state<WebContainer | undefined>();
	let project = $state<Doc<'projects'> | null | undefined>(undefined);
	let error = $state<string | undefined>();
	let isBooting = false;

	$effect(() => {
		// Use the Convex ID if available, otherwise fallback to the Auth ID from props
		const dbUser = currentUser.data;
		const effectiveUserId = dbUser?._id || data?.user?.id;

		console.log('IDE Sync Check:', {
			dbUserReady: !!dbUser,
			authPropReady: !!data?.user?.id,
			hasWc: !!wc,
			isBooting
		});

		// Trigger init only if we have an ID and haven't started booting yet
		if (effectiveUserId && !wc && !isBooting) {
			isBooting = true;
			init(effectiveUserId);
		}
	});

	async function init(ownerId: string) {
		try {
			// Step A: Prepare Template
			const filesArray = Object.entries(VITE_REACT_TEMPLATE.files).map(([name, node]) => ({
				name,
				contents: (node as { file: { contents: string } }).file.contents
			}));

			// Step B: Sync Project with Database
			// This ensures 'project' is set before we try to mount
			const syncProject = await convexClient.mutation(api.projects.getOrCreateUserWorkspace, {
				ownerId,
				defaultFiles: filesArray,
				entry: VITE_REACT_TEMPLATE.entry,
				visibleFiles: VITE_REACT_TEMPLATE.visibleFiles
			});

			if (!syncProject) throw new Error('Failed to load workspace.');
			project = syncProject;

			// Step C: Boot WebContainer (The Singleton Guard)
			if (!wc) {
				const wcFiles: import('@webcontainer/api').FileSystemTree = {};
				for (const f of project.files) {
					wcFiles[f.name] = { file: { contents: f.contents } };
				}

				const instance = await WebContainer.boot();
				await instance.mount(wcFiles);
				wc = instance; // This finally breaks the loading loop
			}
		} catch (e: unknown) {
			console.error('Initialization Error:', e);
			isBooting = false;
		}
	}
</script>

{#if error}
	<div class="status-screen error">{error}</div>
{:else if !wc || !project}
	<div class="status-screen">
		<div class="spinner"></div>
		<p>Loading your permanent workspace...</p>
	</div>
{:else}
	<div class="app-container">
		<PaneGroup direction="horizontal">
			<Pane defaultSize={50}>
				<PaneGroup direction="vertical">
					<Pane defaultSize={70}>
						<div class="pane-content editor-pane">
							<Editor webcontainer={wc} {project} />
						</div>
					</Pane>
					<PaneResizer class="resizer-horizontal" />
					<Pane defaultSize={30}>
						<div class="pane-content terminal-pane">
							<Terminal webcontainer={wc} />
						</div>
					</Pane>
				</PaneGroup>
			</Pane>
			<PaneResizer class="resizer-vertical" />
			<Pane defaultSize={50}>
				<div class="pane-content preview-pane">
					<Preview webcontainer={wc} />
				</div>
			</Pane>
		</PaneGroup>
	</div>
{/if}

<style>
	/* --- Container & Pane Helpers --- */
	.app-container {
		height: 100vh;
		width: 100%;
		background-color: #1e1e1e;
	}

	.pane-content {
		height: 100%;
		overflow: hidden;
	}

	/* --- Loading Screen Styles --- */
	.status-screen {
		height: 100vh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		background-color: #1e1e1e;
		color: #fff;
		font-family: sans-serif;
	}

	.error {
		color: #ff5f56;
	}

	.spinner {
		width: 40px;
		height: 40px;
		border: 3px solid rgba(255, 255, 255, 0.1);
		border-radius: 50%;
		border-top-color: #007acc;
		animation: spin 1s ease-in-out infinite;
		margin-bottom: 20px;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	/* Generic Resizer Styles from paneforge */
	:global(.resizer-horizontal) {
		height: 4px;
		background: #2d2d2d;
		cursor: row-resize;
	}
	:global(.resizer-vertical) {
		width: 4px;
		background: #2d2d2d;
		cursor: col-resize;
	}
	:global(.resizer-horizontal:hover),
	:global(.resizer-vertical:hover) {
		background: #007acc;
	}
</style>
