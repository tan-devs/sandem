<script lang="ts">
	import { onMount } from 'svelte';

	// Accept the booted and mounted webcontainer
	let { webcontainer }: { webcontainer: import('@webcontainer/api').WebContainer } = $props();
	let iframeUrl: string = $state('');

	onMount(() => {
		async function startServer() {
			// Install dependencies
			const installProcess = await webcontainer.spawn('npm', ['install']);
			await installProcess.exit;

			// Start the dev server
			await webcontainer.spawn('npm', ['run', 'dev']);

			// Listen for the URL
			webcontainer.on('server-ready', (port, url) => {
				iframeUrl = url;
			});
		}

		startServer();
	});
</script>

<div class="preview-shell">
	{#if iframeUrl}
		<iframe title="WebContainer Preview" src={iframeUrl}></iframe>
	{:else}
		<div class="preview-loading">Starting Dev Server...</div>
	{/if}
</div>

<style>
	.preview-shell {
		background: white;
		border-left: 1px solid #2d2d2d;
		height: 100%;
		width: 100%;
	}
	iframe {
		width: 100%;
		height: 100%;
		border: none;
	}
	.preview-loading {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		background: #1e1e1e;
		color: #969696;
	}
</style>
