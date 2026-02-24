<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		value = $bindable(),
		variant = 'text',
		icon,
		accent = 'var(--accent)',
		padding = '0.5rem',
		...rest // Captures id, name, required, min, max, etc.
	}: {
		value: string;
		variant?: string;
		icon?: Snippet;
		accent?: string;
		padding?: string;
		[key: string]: unknown;
	} = $props();
</script>

<div class="search-container" style:--accent={accent} style:--padding={padding}>
	{#if icon}
		{@render icon()}
	{/if}
	<input type={variant} bind:value {...rest} />
</div>

<style>
	.search-container {
		display: flex;
		align-items: center;
		padding: var(--padding);
		border: 1px solid var(--border);
		border-radius: var(--radius-base);
		background: var(--form-input-bg, var(--bg));
	}
	.search-container:focus-within {
		border-color: var(--accent);
		box-shadow: 0 0 0 2px var(--accent);
	}
	input {
		border: none;
		background: transparent;
		outline: none;
		width: 100%;
		color: inherit;
	}
</style>
