<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores'; // <-- 1. Import SvelteKit page store
	import { WebContainer } from '@webcontainer/api';
	import { PaneGroup, Pane, PaneResizer } from 'paneforge';

	import Editor from '$lib/components/Editor.svelte';
	import Preview from '$lib/components/Preview.svelte';
	import Terminal from '$lib/components/Terminal.svelte';
	import { VITE_REACT_TEMPLATE } from '$lib/templates.js';

	// 2. Extract the dynamic projectId from the URL
	let projectId = $derived($page.params.projectId);

	let wc: WebContainer | undefined = $state();
	let error: string | undefined = $state();

	onMount(() => {
		async function init() {
			try {
				const instance = await WebContainer.boot();
				await instance.mount(VITE_REACT_TEMPLATE.files);
				wc = instance;
			} catch (e) {
				console.error('WebContainer boot failed:', e);
				error = 'Failed to boot WebContainer.';
			}
		}
		init();
	});
</script>

{#if error}
	<div class="status-screen error">{error}</div>
{:else if !wc}
	<div class="status-screen">
		<div class="spinner"></div>
		<p>Loading Project: {projectId}...</p>
	</div>
{:else}
	<div class="app-container">
		<PaneGroup direction="horizontal">
			<Pane defaultSize={50}>
				<PaneGroup direction="vertical">
					<Pane defaultSize={70}>
						<div class="pane-content editor-pane">
							<Editor webcontainer={wc} {projectId} />
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
		color: white;
		font-family: sans-serif;
	}
	.error {
		color: #ff5f56;
	}
	.spinner {
		width: 40px;
		height: 40px;
		border: 4px solid #333;
		border-top: 4px solid #007acc;
		border-radius: 50%;
		animation: spin 1s linear infinite;
		margin-bottom: 1rem;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
