<script lang="ts">
	import { Trash2, RotateCcw, Square, Maximize2, X } from '@lucide/svelte';
	import Tabs from '$lib/components/ui/primitives/Tabs.svelte';
	import Button from '$lib/components/ui/primitives/Button.svelte';
	import type { TerminalPanelTab, TerminalPanelTabItem } from '$lib/stores/terminal';

	type Props = {
		tabItems: TerminalPanelTabItem[];
		activeTab: TerminalPanelTab;
		onTabSelect: (id: string) => void;
		onClear: () => void;
		onRestart: () => void;
		onKill: () => void;
		onToggleMaximize: () => void;
		onClose: () => void;
	};

	let {
		tabItems,
		activeTab,
		onTabSelect,
		onClear,
		onRestart,
		onKill,
		onToggleMaximize,
		onClose
	}: Props = $props();

	const isTerminal = $derived(activeTab === 'TERMINAL');
</script>

<div class="terminal-header">
	<Tabs variant="editor" tabs={tabItems} onSelect={onTabSelect}>
		{#snippet actions()}
			<div class="actions">
				<Button size="icon" variant="ghost" title="Clear" onclick={onClear}>
					<Trash2 size={14} strokeWidth={1.5} />
				</Button>
				<Button
					size="icon"
					variant="ghost"
					title="Restart"
					onclick={onRestart}
					disabled={!isTerminal}
				>
					<RotateCcw size={14} strokeWidth={1.5} />
				</Button>
				<Button size="icon" variant="ghost" title="Kill" onclick={onKill} disabled={!isTerminal}>
					<Square size={14} strokeWidth={1.5} />
				</Button>
				<Button size="icon" variant="ghost" title="Maximize" onclick={onToggleMaximize}>
					<Maximize2 size={14} strokeWidth={1.5} />
				</Button>
				<Button size="icon" variant="ghost" title="Close" onclick={onClose}>
					<X size={14} strokeWidth={1.5} />
				</Button>
			</div>
		{/snippet}
	</Tabs>
</div>

<style>
	.terminal-header {
		flex-shrink: 0;
		border-bottom: 1px solid var(--border);
	}

	.actions {
		display: flex;
		align-items: center;
		gap: 2px;
		padding-right: 4px;
	}
</style>
