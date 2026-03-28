<script lang="ts">
	import AppHeader from '$lib/components/workspace/AppHeader.svelte';

	let { children } = $props();
</script>

<AppHeader />

{@render children()}
