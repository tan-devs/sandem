<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		preset = 'plain',
		ariaLabel = 'form',
		onsubmit,
		children
	}: {
		preset?: 'plain' | 'card' | 'panel' | 'grid';
		ariaLabel?: string;
		onsubmit?: (e: SubmitEvent) => void;
		children?: Snippet;
	} = $props();
</script>

<form
	aria-label={ariaLabel}
	data-preset={preset}
	onsubmit={(e) => {
		e.preventDefault();
		onsubmit?.(e);
	}}
>
	{@render children?.()}
</form>

<style>
	form {
		--form-input-bg: var(--bg);
		--form-input-border: var(--border);
		--form-text: var(--text);

		display: flex;
		flex-direction: column;
		gap: 1rem;
		width: 100%;
	}

	/* Preset-specific variable overrides */
	form[data-preset='card'] {
		padding: 2rem;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-card);
		--form-input-bg: var(--bg); /* Nested inputs adapt to the card */
	}

	form[data-preset='grid'] {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
		gap: 1.5rem;
	}
</style>
