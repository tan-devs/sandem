<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';

	// Initialize Convex client
	import { PUBLIC_CONVEX_URL } from '$env/static/public';
	import { setupConvex } from 'convex-svelte';
	setupConvex(PUBLIC_CONVEX_URL);

	import AppHeader from '$lib/components/workspace/AppHeader.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<!-- html -->

<div class="container">
	<AppHeader />

	{@render children()}
</div>

<!-- /html -->

<style>
	.container {
		display: grid;
		grid-template-rows: auto 1fr;

		min-height: 100dvh;
		min-width: 100dvw;
		overflow: hidden;
	}
</style>
