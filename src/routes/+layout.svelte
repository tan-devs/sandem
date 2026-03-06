<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';

	import { PUBLIC_CONVEX_URL } from '$env/static/public';
	import { setupConvex } from 'convex-svelte';

	setupConvex(PUBLIC_CONVEX_URL);
	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
