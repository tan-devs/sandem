<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		preset = 'plain',
		variant = 'neutral',
		ariaLabel = 'form',
		class: className = '',
		onsubmit,
		children,
		...rest
	}: {
		preset?: 'plain' | 'card' | 'panel' | 'grid';
		variant?: 'neutral' | 'accent' | 'success' | 'warning' | 'info' | 'danger';
		ariaLabel?: string;
		class?: string;
		onsubmit?: (e: SubmitEvent) => void;
		children?: Snippet;
		[key: string]: unknown;
	} = $props();

	const toneMap = {
		neutral: 'var(--muted)',
		accent: 'var(--accent)',
		success: 'var(--success)',
		warning: 'var(--warning)',
		info: 'var(--info)',
		danger: 'var(--error)'
	} as const;
</script>

<form
	class={className}
	aria-label={ariaLabel}
	data-preset={preset}
	style={`--form-tone: ${toneMap[variant]};`}
	{...rest}
	onsubmit={(e) => {
		e.preventDefault();
		onsubmit?.(e);
	}}
>
	{@render children?.()}
</form>

<style>
	form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		width: 100%;
		color: var(--text);
	}

	form :global(input),
	form :global(textarea),
	form :global(select) {
		width: 100%;
		padding: 0.6rem 0.72rem;
		border: 1px solid color-mix(in srgb, var(--form-tone) 28%, var(--border));
		border-radius: var(--radius-sm);
		background: var(--fg);
		color: var(--text);
	}

	form :global(input:focus-visible),
	form :global(textarea:focus-visible),
	form :global(select:focus-visible) {
		outline: none;
		border-color: color-mix(in srgb, var(--form-tone) 55%, var(--border));
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--form-tone) 20%, transparent);
	}

	form :global(label) {
		display: grid;
		gap: 0.35rem;
		font-size: 0.86rem;
		color: var(--muted);
	}

	/* Preset variants */
	form[data-preset='card'] {
		padding: 1rem;
		background: color-mix(in srgb, var(--form-tone) 3%, var(--fg));
		border: 1px solid color-mix(in srgb, var(--form-tone) 28%, var(--border));
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-card);
	}

	form[data-preset='panel'] {
		padding: 0.9rem;
		background: transparent;
		border: 1px dashed color-mix(in srgb, var(--form-tone) 35%, var(--border));
		border-radius: var(--radius-md);
	}

	form[data-preset='grid'] {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
		gap: 1rem;
	}
</style>
