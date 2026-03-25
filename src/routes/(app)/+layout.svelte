<script lang="ts">
	let { children } = $props();
</script>

<div class="container">
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
