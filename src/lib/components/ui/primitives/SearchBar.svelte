<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		value = $bindable(''),
		placeholder = 'Search...',
		type = 'text',
		variant = 'default',
		size = 'md',
		tone = 'neutral',
		icon,
		class: className = '',
		...rest // Captures id, name, required, min, max, etc.
	}: {
		value: string;
		placeholder?: string;
		type?: 'text' | 'search' | 'email' | 'url' | 'tel';
		variant?: 'default' | 'outline' | 'ghost';
		size?: 'sm' | 'md' | 'lg';
		tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'info' | 'danger';
		icon?: Snippet;
		class?: string;
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

<div
	class="search-container {className}"
	data-variant={variant}
	data-size={size}
	style={`--search-tone: ${toneMap[tone]};`}
>
	{#if icon}
		<div class="search-icon">
			{@render icon()}
		</div>
	{/if}
	<input {type} bind:value {placeholder} {...rest} />
</div>

<style>
	.search-container {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--fg);
		color: var(--text);
	}

	.search-container[data-size='sm'] {
		padding: 0 0.5rem;
		height: 22px;
	}

	.search-container[data-size='sm'] input {
		font-size: 11px;
	}

	.search-container[data-size='lg'] {
		padding: 0.6rem 0.9rem;
	}

	.search-container[data-variant='outline'] {
		background: transparent;
	}

	.search-container[data-variant='ghost'] {
		background: transparent;
		border-color: transparent;
	}

	.search-container:focus-within {
		border-color: color-mix(in srgb, var(--search-tone) 55%, var(--border));
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--search-tone) 24%, transparent);
	}

	.search-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--muted);
		flex-shrink: 0;
	}

	input {
		border: none;
		background: transparent;
		outline: none;
		width: 100%;
		color: var(--text);
		font-size: 0.875rem;
		font-family: inherit;
	}

	input::placeholder {
		color: var(--muted);
	}
</style>
