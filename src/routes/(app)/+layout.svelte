<script lang="ts">
	import AppHeader from '$lib/components/workspace/AppHeader.svelte';

	let { children } = $props();
</script>

<div class="container">
	<AppHeader />
	{@render children()}
</div>

<style>
	.container {
		height: 100dvh;
		overflow-y: auto;
		overflow-x: hidden;
		scrollbar-gutter: stable;
	}
</style>
