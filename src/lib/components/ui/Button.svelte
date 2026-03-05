<script lang="ts">
	import { Button } from 'bits-ui';
	import type { ButtonRootProps } from 'bits-ui';

	type Props = ButtonRootProps & {
		variant?: 'default' | 'outline' | 'ghost' | 'link' | 'delete';
	};

	let { variant = 'default', children, ...rest }: Props = $props();
</script>

<Button.Root data-variant={variant} {...rest}>
	{@render children?.()}
</Button.Root>

<style>
	:global([data-button-root]) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-family: inherit;
		font-weight: 500;
		border-radius: var(--radius);
		border: 1px solid transparent;
		cursor: pointer;
		transition: all var(--time) var(--ease);
	}

	:global([data-button-root][data-variant='default']) {
		background: var(--bg);
		color: var(--muted);
	}

	:global([data-button-root][data-variant='default']:hover) {
		color: var(--text);
	}

	:global([data-button-root][data-variant='outline']) {
		background: transparent;
		color: var(--text);
		border-color: var(--border);
	}

	:global([data-button-root][data-variant='outline']:hover) {
		background: var(--bg);
	}

	:global([data-button-root][data-variant='ghost']) {
		background: transparent;
		color: var(--muted);
		padding: 0;
	}

	:global([data-button-root][data-variant='ghost']:hover) {
		background: transparent;
		color: var(--text);
	}

	:global([data-button-root][data-variant='link']) {
		background: transparent;
		color: var(--accent);
		border-color: transparent;
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	:global([data-button-root][data-variant='link']:hover) {
		opacity: 0.8;
	}

	:global([data-button-root][data-variant='delete']) {
		background: transparent;
		color: var(--error, #e55);
		border-color: transparent;
	}

	:global([data-button-root][data-variant='delete']:hover) {
		background: color-mix(in srgb, var(--error, #e55) 12%, transparent);
		border-color: color-mix(in srgb, var(--error, #e55) 30%, transparent);
	}

	:global([data-button-root]:disabled),
	:global([data-button-root][aria-disabled='true']) {
		opacity: 0.4;
		cursor: not-allowed;
		pointer-events: none;
	}

	:global([data-button-root][data-variant='ghost'][aria-current='page']) {
		color: var(--text);
		background: var(--bg);
	}
</style>
