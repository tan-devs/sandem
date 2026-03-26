<script lang="ts">
	import { Trash2, RotateCcw, Square, Maximize2, X } from '@lucide/svelte';
	import Tabs from '$lib/components/ui/primitives/Tabs.svelte';
	import Button from '$lib/components/ui/primitives/Button.svelte';
	import type {
		TerminalPanelTab,
		TerminalPanelTabItem
	} from '$lib/controllers/workspace/createTerminalPanelController.svelte';

	type Props = {
		panelTabItems: TerminalPanelTabItem[];
		activeTab: TerminalPanelTab;
		onTabSelect: (id: string) => void;
		onClearTerminal: () => void;
		onRestartTerminal: () => void;
		onKillTerminal: () => void;
		onToggleMaximize: () => void;
		onClosePanel: () => void;
	};

	let {
		panelTabItems,
		activeTab,
		onTabSelect,
		onClearTerminal,
		onRestartTerminal,
		onKillTerminal,
		onToggleMaximize,
		onClosePanel
	}: Props = $props();

	const terminalTab = 'TERMINAL' as const;
</script>

<div class="terminal-header">
	<Tabs variant="editor" tabs={panelTabItems} onSelect={onTabSelect}>
		{#snippet actions()}
			<div class="panel-actions">
				<Button
					size="icon"
					variant="ghost"
					class="action-btn"
					title="Clear"
					onclick={onClearTerminal}
				>
					<Trash2 size={14} strokeWidth={1.5} />
				</Button>
				<Button
					size="icon"
					variant="ghost"
					class="action-btn"
					title="Restart Terminal"
					onclick={onRestartTerminal}
					disabled={activeTab !== terminalTab}
				>
					<RotateCcw size={14} strokeWidth={1.5} />
				</Button>
				<Button
					size="icon"
					variant="ghost"
					class="action-btn"
					title="Kill Terminal"
					onclick={onKillTerminal}
					disabled={activeTab !== terminalTab}
				>
					<Square size={14} strokeWidth={1.5} />
				</Button>
				<Button
					size="icon"
					variant="ghost"
					class="action-btn"
					title="Maximize Panel"
					onclick={onToggleMaximize}
				>
					<Maximize2 size={14} strokeWidth={1.5} />
				</Button>
				<Button
					size="icon"
					variant="ghost"
					class="action-btn"
					title="Close Panel"
					onclick={onClosePanel}
				>
					<X size={14} strokeWidth={1.5} />
				</Button>
			</div>
		{/snippet}
	</Tabs>
</div>

<style>
	.terminal-header {
		display: block;
		background: color-mix(in srgb, var(--mg) 90%, var(--bg));
		border-bottom: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
		flex-shrink: 0;
	}

	.panel-actions {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.panel-actions :global([data-button-root]) {
		width: 24px;
		height: 24px;
		border-radius: 4px;
		padding: 0;
		color: color-mix(in srgb, var(--muted) 90%, var(--text));
	}

	.panel-actions :global([data-button-root]:hover) {
		background: color-mix(in srgb, var(--fg) 76%, var(--bg));
		color: var(--text);
	}

	.panel-actions :global([data-button-root]:disabled) {
		opacity: 0.45;
	}
</style>
