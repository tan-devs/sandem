<script lang="ts">
	import { onMount } from 'svelte';
	import { WebContainer } from '@webcontainer/api';
	import { createSvelteAuthClient } from '$lib/svelte/index.js';
	import { authClient } from '$lib/context/auth-client.js';
	import { setIDEContext } from '$lib/context/ide-context.js';
	import { createProjectMounter } from '$lib/hooks/createProjectMounter.svelte.js';

	export const ssr = false; // disable SSR for the IDE route

	let { children, data } = $props();

	// Handshake between SSR state and Client state
	createSvelteAuthClient({
		authClient,
		getServerState: () => data.authState
	});

	let webcontainer: WebContainer | null = null;

	onMount(async () => {
		webcontainer = await WebContainer.boot();

		setIDEContext({
			getWebcontainer: () => {
				if (!webcontainer) throw new Error('WebContainer not ready');
				return webcontainer;
			},
			getProject: () => {
				if (!data.project) throw new Error('missing project');
				return data.project;
			}
		});

		if (webcontainer && data.project) {
			const mounter = createProjectMounter(
				() => webcontainer!,
				() => data.project
			);
			await mounter.mountProjectFiles();
		}
	});
</script>

<aside>aside</aside>
{@render children()}
