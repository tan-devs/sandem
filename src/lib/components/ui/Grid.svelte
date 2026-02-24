<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		children,
		minWidth = '300px',
		gap = '2rem'
	}: {
		children?: Snippet;
		minWidth?: string;
		gap?: string;
	} = $props();
</script>

<div class="auto-grid" style:--min-width={minWidth} style:--gap={gap}>
	{@render children?.()}
</div>

<style>
	.auto-grid {
		display: grid;
		/* Local variable usage ensures no leakage */
		grid-template-columns: repeat(auto-fit, minmax(var(--min-width), 1fr));
		gap: var(--gap);
		margin-top: var(--gap);
	}
</style>
