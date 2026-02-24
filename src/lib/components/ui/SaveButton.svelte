<script lang="ts">
	import Button from './Button.svelte';

	let {
		status = 'Saved',
		onsave
	}: {
		status?: 'Saved' | 'Saving...' | 'Unsaved changes';
		onsave: () => void;
	} = $props();

	// Derived state to disable the button when it's already saved or currently saving
	let isDisabled = $derived(status === 'Saved' || status === 'Saving...');
</script>

<div class="save-action">
	<Button variant="outline" size="sm" disabled={isDisabled} onclick={onsave}>
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			style="margin-right: 6px;"
		>
			<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
			<polyline points="17 21 17 13 7 13 7 21"></polyline>
			<polyline points="7 3 7 8 15 8"></polyline>
		</svg>
		Save
	</Button>

	<div class="indicator">
		<span class:saving={status === 'Saving...'} class:saved={status === 'Saved'}>
			{status === 'Saved' ? '✓ ' : ''}{status}
		</span>
	</div>
</div>

<style>
	.save-action {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.indicator {
		font-family: var(--fonts);
		font-size: 12px;
		color: var(--muted);
		min-width: 110px;
		text-align: right;
	}

	.indicator span {
		transition: color var(--time) var(--ease);
	}

	/* Hooking into your global app.css variables! */
	.indicator .saving {
		color: var(--warning);
	}

	.indicator .saved {
		color: var(--success);
	}
</style>
