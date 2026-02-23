<script lang="ts">
	import { onMount } from 'svelte';
	import type { WebContainer } from '@webcontainer/api';

	let {
		webcontainer
	}: {
		webcontainer: WebContainer;
	} = $props();

	let iframeUrl: string = $state('');

	onMount(() => {
		async function startServer() {
			const installProcess = await webcontainer.spawn('npm', ['install']);
			await installProcess.exit;

			await webcontainer.spawn('npm', ['run', 'dev']);

			// STRICT FIX: Type the callback variables natively
			webcontainer.on('server-ready', (port: number, url: string) => {
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
