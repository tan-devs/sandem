<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		active = false,
		variant = 'default',
		onclick,
		children
	}: {
		active?: boolean;
		variant?: 'default' | 'editor';
		onclick?: () => void;
		children?: Snippet;
	} = $props();
</script>

<button class="tab" class:active data-variant={variant} {onclick}>
	{@render children?.()}
</button>

<style>
	.tab {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		border: none;
		background: transparent;
		font-family: var(--fonts, system-ui, -apple-system, sans-serif);
		transition: all var(--time, 0.2s) var(--ease, ease);
		white-space: nowrap;
	}

	/* --- Editor Preset (VS Code Style) --- */
	.tab[data-variant='editor'] {
		padding: 10px 16px;
		color: #969696;
		font-size: 13px;
		border-right: 1px solid #1e1e1e;
		border-top: 2px solid transparent;
	}

	.tab[data-variant='editor']:hover {
		background-color: #1e1e1e;
	}

	.tab[data-variant='editor'].active {
		background-color: #1e1e1e;
		color: #ffffff;
		border-top: 2px solid #007acc; /* VS Code blue accent */
	}

	/* --- Default Preset (Standard Web App Style) --- */
	.tab[data-variant='default'] {
		padding: 0.5rem 1rem;
		color: var(--muted);
		border-bottom: 2px solid transparent;
		font-weight: 500;
	}

	.tab[data-variant='default']:hover {
		color: var(--text);
	}

	.tab[data-variant='default'].active {
		color: var(--text);
		border-bottom-color: var(--accent, #007acc);
	}
</style>
