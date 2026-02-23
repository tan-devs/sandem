<script lang="ts">
	import { onMount } from 'svelte';
	import { WebContainer } from '@webcontainer/api';

	import Editor from '$lib/components/Editor.svelte';
	import Preview from '$lib/components/Preview.svelte';
	import Terminal from '$lib/components/Terminal.svelte'; // <-- 1. Import Terminal

	import { VITE_REACT_TEMPLATE, type CodeFile } from '$lib/templates.js';

	let wc: WebContainer | undefined = $state();
	let error: string | undefined = $state();

	onMount(() => {
		async function init() {
			try {
				const instance = await WebContainer.boot();

				const wcFiles = Object.fromEntries(
					Object.entries(VITE_REACT_TEMPLATE.files).map(([name, file]) => [
						name,
						{ file: { contents: (file as CodeFile).contents } }
					])
				);
				await instance.mount(wcFiles);

				wc = instance;
			} catch (e) {
				console.error('WebContainer boot failed:', e);
				error = 'Failed to boot WebContainer. Ensure COOP/COEP headers are set.';
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
		<p>Initializing WebContainer...</p>
	</div>
{:else}
	<div class="ide-grid">
		<div class="editor-pane">
			<Editor webcontainer={wc} />
		</div>
		<div class="preview-pane">
			<Preview webcontainer={wc} />
		</div>
		<div class="terminal-pane">
			<Terminal webcontainer={wc} />
		</div>
	</div>
{/if}

<style>
	/* --- IDE Grid Layout --- */
	.ide-grid {
		display: grid;
		grid-template-columns: 50% 50%; /* Left / Right split */
		grid-template-rows: 70% 30%; /* Top / Bottom split for the right side */
		height: 100vh;
		width: 100%;
		overflow: hidden;
		background-color: #1e1e1e;
	}

	.editor-pane {
		grid-column: 1 / 2;
		grid-row: 1 / 3; /* Spans the entire height of the left column */
		border-right: 1px solid #2d2d2d;
		overflow: hidden; /* Ensures child components don't break the grid */
	}

	.preview-pane {
		grid-column: 2 / 3;
		grid-row: 1 / 2; /* Top right */
		overflow: hidden;
	}

	.terminal-pane {
		grid-column: 2 / 3;
		grid-row: 2 / 3; /* Bottom right */
		border-top: 1px solid #2d2d2d;
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
