<script lang="ts">
	import { PanelLeft, PanelBottom, PanelRight, Columns2 } from '@lucide/svelte';
	import type { IDEPanelsAdapter } from '$lib/controllers/panels';

	interface Props {
		panels?: IDEPanelsAdapter;
		onSplitRight?: () => void;
	}

	let { panels, onSplitRight }: Props = $props();
</script>

<div class="panel-controls">
	<div class="tb-group">
		<button
			class="tb-btn"
			title="Split Editor Right (Ctrl+\)"
			onclick={onSplitRight}
			disabled={!onSplitRight}
		>
			<Columns2 size={15} strokeWidth={1.5} />
		</button>
	</div>

	<div class="tb-sep"></div>

	<div class="tb-group">
		<button
			class="tb-btn"
			class:active={panels?.leftPane}
			onclick={() => panels && (panels.leftPane = !panels.leftPane)}
			title="Toggle Primary Sidebar (Ctrl+B)"
			aria-pressed={panels?.leftPane}
		>
			<PanelLeft size={15} strokeWidth={1.5} />
		</button>
		<button
			class="tb-btn"
			class:active={panels?.downPane}
			onclick={() => panels && (panels.downPane = !panels.downPane)}
			title="Toggle Panel (Ctrl+J)"
			aria-pressed={panels?.downPane}
		>
			<PanelBottom size={15} strokeWidth={1.5} />
		</button>
		<button
			class="tb-btn"
			class:active={panels?.rightPane}
			onclick={() => panels && (panels.rightPane = !panels.rightPane)}
			title="Toggle Secondary Sidebar"
			aria-pressed={panels?.rightPane}
		>
			<PanelRight size={15} strokeWidth={1.5} />
		</button>
	</div>
</div>

<style>
	.panel-controls {
		display: flex;
		align-items: center;
		gap: 2px;
		-webkit-app-region: no-drag;
	}

	.tb-sep {
		width: 1px;
		height: 14px;
		background: var(--border);
		margin: 0 2px;
		flex-shrink: 0;
	}

	.tb-group {
		display: flex;
		align-items: center;
	}

	.tb-btn {
		width: 28px;
		height: 28px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		color: var(--muted);
		border-radius: 4px;
		cursor: pointer;
		flex-shrink: 0;
		transition:
			color 0.1s,
			background 0.1s;
	}
	.tb-btn:hover {
		background: var(--fg);
		color: var(--text);
	}
	.tb-btn:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.tb-btn.active {
		color: var(--text);
	}
	.tb-btn.active:hover {
		background: var(--fg);
	}
</style>
