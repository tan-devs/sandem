<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';

	import { page } from '$app/state';
	let { children } = $props();

	// Check if we are in the IDE to decide layout rendering
	let isIDERoute = $derived(page.url.pathname.startsWith('/ide'));

	import { PUBLIC_CONVEX_URL } from '$env/static/public';
	import { setupConvex } from 'convex-svelte';
	// register the URL with the Convex Svelte helper
	setupConvex(PUBLIC_CONVEX_URL);

	import NavigationBar from '$lib/components/layout/NavigationBar.svelte';

	const links = [
		{ path: '/', label: 'Home' },
		{ path: '/projects', label: 'Repo' },
		{ path: '/dev', label: 'Dev' },
		{ path: '/test/ssr', label: 'SSR Test' },
		{ path: '/test/client-only', label: 'Client Test' },
		{ path: '/test/queries', label: 'Queries Test' }
	];
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{#if !isIDERoute}
	<NavigationBar variant={'standard'} {links} />
	<main class="standard-main">
		{@render children()}
	</main>
{:else}
	{@render children()}
{/if}

<style>
	.standard-main {
		/* Standard layout padding */
		padding: 2rem 0;
	}
</style>
