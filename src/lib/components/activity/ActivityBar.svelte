<script lang="ts">
	import { onMount } from 'svelte';
	import { Settings } from '@lucide/svelte';

	import Button from '$lib/components/primitives/Button.svelte';
	import { createActivityBarController } from '$lib/controllers/activity';
	import type { IDEPanels } from '$lib/stores/activity/index.js';

	// ---------------------------------------------------------------------------
	// Props
	// ---------------------------------------------------------------------------

	interface Props {
		/**
		 * Accessor for the workspace panels state.
		 * Pass from the layout: getPanels={() => ctrl.panels}
		 * The controller reads and writes leftPane / rightPane through this.
		 */
		getPanels: () => IDEPanels | undefined;
	}

	let { getPanels }: Props = $props();

	// ---------------------------------------------------------------------------
	// Controller
	// ---------------------------------------------------------------------------

	// Wrap getPanels in a closure so Svelte re-reads the current prop value on
	// every call rather than capturing the initial reference at construction time.
	const ctrl = createActivityBarController({ getPanels: () => getPanels() });
	onMount(() => ctrl.mount());
</script>

<aside class="activity-bar" aria-label="Activity Bar">
	<nav class="activities" aria-label="Primary activities">
		{#each ctrl.tabs as tab (tab.id)}
			{@const active = ctrl.activeTab === tab.id}
			<Button
				variant="ghost"
				tone="neutral"
				size="icon"
				justify="center"
				class={`activity-btn ${active ? 'active' : ''}`}
				title={tab.label}
				aria-label={tab.label}
				aria-pressed={active}
				onclick={() => ctrl.selectTab(tab.id)}
			>
				<tab.icon size={26} strokeWidth={1.25} />
			</Button>
		{/each}
	</nav>

	<div class="activity-footer">
		<Button
			variant="ghost"
			tone="neutral"
			size="icon"
			justify="center"
			class="activity-btn"
			title="Toggle Secondary Sidebar"
			aria-label="Toggle secondary sidebar"
			onclick={() => ctrl.toggleSecondaryPanel()}
		>
			<Settings size={26} strokeWidth={1.25} />
		</Button>
	</div>
</aside>

<style>
	.activity-bar {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		align-items: center;
		width: 48px;
		height: 100%;
		background: color-mix(in srgb, var(--mg) 86%, var(--bg));
		border-right: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
		overflow: hidden;
	}

	.activities,
	.activity-footer {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		padding: 8px 0;
	}

	:global([data-button-root].activity-btn) {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 38px;
		padding: 0;
		border-left: 2px solid transparent;
		color: color-mix(in srgb, var(--muted) 90%, var(--text));
		transition:
			background var(--time) var(--ease),
			color var(--time) var(--ease),
			border-color var(--time) var(--ease);
		border-radius: 0;
	}

	:global([data-button-root].activity-btn:hover) {
		background: color-mix(in srgb, var(--fg) 64%, var(--bg));
		color: var(--text);
	}

	:global([data-button-root].activity-btn.active) {
		color: var(--text);
		border-left-color: color-mix(in srgb, var(--accent) 76%, var(--highlight));
		background: color-mix(in srgb, var(--bg) 88%, var(--mg));
	}

	.activity-footer {
		border-top: 1px solid color-mix(in srgb, var(--border) 55%, transparent);
		width: 100%;
	}
</style>
