<script lang="ts">
	// Load global app styles once at the root layout level.
	import '../app.css';
	// Use the bundled favicon for all routes.
	import favicon from '$lib/assets/favicon.svg';

	// Read the Convex deployment URL from public environment variables.
	import { PUBLIC_CONVEX_URL } from '$env/static/public';
	// Initialize Convex client integration for Svelte.
	import { setupConvex } from 'convex-svelte';

	import AppHeader from '$lib/components/ui/navigation/AppHeader.svelte';

	// Bootstrap Convex before rendering nested routes.
	setupConvex(PUBLIC_CONVEX_URL);
	// Receive route content from child layouts/pages.
	let { children } = $props();
</script>

<svelte:head>
	<!-- Set the browser tab icon globally. -->
	<link rel="icon" href={favicon} />
</svelte:head>

<!-- Render the active child route tree. -->

<div class="container">
	<AppHeader />

	{@render children()}
</div>

<style>
	.container {
		display: grid;
		grid-template-rows: auto 1fr;

		min-height: 100dvh;
		min-width: 100dvw;
		overflow: hidden;
	}
</style>
