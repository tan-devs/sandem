<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';

	import { PUBLIC_CONVEX_URL } from '$env/static/public';
	import { setupConvex } from 'convex-svelte';
	import NavigationBar from '$lib/components/layout/NavigationBar.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Avatar from '$lib/components/ui/Avatar.svelte';
	import SearchBar from '$lib/components/ui/SearchBar.svelte';
	import DropDown from '$lib/components/ui/DropDown.svelte';
	import Search from '@lucide/svelte/icons/search';

	setupConvex(PUBLIC_CONVEX_URL);

	const links = [
		{ path: '/', label: 'home' },
		{ path: '/projects', label: 'repo' },
		{ path: '/dev', label: 'auth' },
		{ path: '/workshop', label: 'shop' },
		{ path: '/test/ssr', label: 'server test' },
		{ path: '/test/client-only', label: 'client test' },
		{ path: '/test/queries', label: 'query test' }
	];

	let searchValue = $state('');
	let userDropdownOpen = $state(false);

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="container">
	<NavigationBar variant="standard" {links}>
		{#snippet field()}
			<SearchBar
				bind:value={searchValue}
				placeholder="Search..."
				style="flex: 0 1 200px; min-width: 150px;"
			>
				{#snippet icon()}
					<Search size={16} />
				{/snippet}
			</SearchBar>
		{/snippet}

		{#snippet actions()}
			<!-- Sign in button  -->
			<Button variant="outline" size="sm">Sign in</Button>
		{/snippet}
	</NavigationBar>

	<main>
		{@render children()}
	</main>
</div>

<style>
	.container {
		/*
		 * height: 100% propagates the definite height from body.
		 * grid-template-rows: auto 1fr gives the nav its natural height
		 * and lets main take exactly the remaining space — no more, no less.
		 * overflow: hidden clips anything that escapes (glow halos, etc.)
		 */
		height: 100%;
		overflow: hidden;
		display: grid;
		grid-template-areas:
			'navigation'
			'content';
		grid-template-rows: auto 1fr;
	}

	:global(main) {
		/*
		 * Sits in the 1fr row — height is now definite (= 100% - navbar).
		 * overflow-y: auto  → normal pages scroll their content here (not body).
		 * overflow-x: hidden → prevents horizontal bleed from hero glows etc.
		 * min-height: 0     → required for nested grids/flex to shrink correctly.
		 * position: relative → stacking context for page-level z-index layers.
		 */
		grid-area: content;
		min-height: 0;
		position: relative;
		overflow-y: auto;
		overflow-x: hidden;
		width: 100%;
	}

	:global(.navbar) {
		grid-area: navigation;
	}
</style>
