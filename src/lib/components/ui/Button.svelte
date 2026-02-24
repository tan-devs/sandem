<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		variant = 'default',
		size = 'default',
		disabled = false,
		children,
		...rest
	}: {
		variant?: 'default' | 'outline' | 'ghost' | 'link';
		size?: 'default' | 'sm' | 'lg' | 'icon';
		disabled?: boolean;
		children?: Snippet;
		[key: string]: unknown;
	} = $props();
</script>

<button class="btn" data-variant={variant} data-size={size} {disabled} {...rest}>
	{@render children?.()}
</button>

<style>
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius);
		font-weight: 500;
		cursor: pointer;
		transition: all var(--time);
		border: 1px solid transparent;
	}

	/* Variant logic stays here, not in app.css */
	.btn[data-variant='default'] {
		background: var(--bg);
		color: var(--muted);
	}
	.btn[data-variant='default']:hover {
		color: var(--text);
	}
	.btn[data-variant='outline'] {
		background: transparent;
		border-color: var(--muted);
		color: var(--text);
	}
	.btn[data-variant='outline']:hover {
		border-color: var(--text);
		color: var(--text);
	}

	/* Size logic */
	.btn[data-size='sm'] {
		height: 2rem;
		padding: 0 0.75rem;
		font-size: 0.75rem;
	}
	.btn[data-size='default'] {
		height: 2.5rem;
		padding: 0 1rem;
		font-size: 0.875rem;
	}
	.btn[data-size='lg'] {
		height: 3rem;
		padding: 0 2rem;
		font-size: 1rem;
	}
</style>
