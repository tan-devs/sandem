<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		content,
		preset = 'default',
		accent
	}: {
		content?: Snippet;
		preset?: 'default' | 'notched' | 'flat';
		accent?: string;
	} = $props();
</script>

<article class="card" data-preset={preset} style:--accent={accent}>
	{@render content?.()}
</article>

<style>
	.card {
		display: inline;
		padding: 2rem;
		background: var(--bg);
		border: 1px solid var(--muted);
		border-radius: var(--radius);
		transition: transform var(--time);
	}

	.card[data-preset='notched'] {
		border-bottom: 4px solid var(--muted);
	}

	.card[data-preset='flat'] {
		box-shadow: none;
		background: transparent;
	}

	.card:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 6px -1px var(--shadow);
	}
</style>
