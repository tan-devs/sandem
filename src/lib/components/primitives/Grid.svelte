<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		children,
		minWidth = '300px',
		gap = '1rem',
		variant = 'default'
	}: {
		children?: Snippet;
		minWidth?: string;
		gap?: string;
		variant?: 'default' | 'cards' | 'compact';
	} = $props();
</script>

<div class="auto-grid" data-variant={variant} style:--min-width={minWidth} style:--gap={gap}>
	{@render children?.()}
</div>

<style>
	.auto-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(var(--min-width), 1fr));
		gap: var(--gap);
	}

	.auto-grid[data-variant='cards'] {
		padding: 0.5rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--fg);
	}

	.auto-grid[data-variant='compact'] {
		gap: calc(var(--gap) * 0.65);
	}
</style>
