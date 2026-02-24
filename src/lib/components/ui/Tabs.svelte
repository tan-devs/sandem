<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		variant = 'default',
		children,
		actions
	}: {
		variant?: 'default' | 'editor';
		children?: Snippet;
		actions?: Snippet;
	} = $props();
</script>

<div class="tabs-container" data-variant={variant}>
	<div class="tabs-list">
		{@render children?.()}
	</div>

	{#if actions}
		<div class="tabs-actions">
			{@render actions()}
		</div>
	{/if}
</div>

<style>
	.tabs-container {
		display: flex;
		align-items: center;
		width: 100%;
	}

	.tabs-list {
		display: flex;
		flex-wrap: nowrap;
		overflow-x: auto;
		flex: 1; /* Takes up all available space to push actions to the right */
	}

	.tabs-actions {
		margin-left: auto;
		display: flex;
		align-items: center;
		padding: 0 16px;
	}

	/* --- Editor Preset --- */
	.tabs-container[data-variant='editor'] {
		background-color: #2d2d2d;
	}

	/* --- Default Preset --- */
	.tabs-container[data-variant='default'] {
		border-bottom: 1px solid var(--border, #e5e7eb);
	}
</style>
