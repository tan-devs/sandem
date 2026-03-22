<script lang="ts">
	import { Plus, ChevronDown, ChevronUp } from '@lucide/svelte';
	import Button from '$lib/components/ui/primitives/Button.svelte';
	import type { TerminalPanelTab } from '$lib/controllers/workspace/createTerminalPanelController.svelte.js';

	type Props = {
		activeTab: TerminalPanelTab;
		isOpen: boolean;
		isReady: boolean;
		onEnsureShell: () => void;
		onRestartShell: () => void;
		onSetOpen: (next: boolean) => void;
	};

	let { activeTab, isOpen, isReady, onEnsureShell, onRestartShell, onSetOpen }: Props = $props();
</script>

{#if activeTab === 'TERMINAL' && isOpen}
	<div class="terminal-toolbar">
		<div class={`session-tab ${isReady ? 'active' : ''}`}>
			<Button size="sm" variant="ghost" onclick={onEnsureShell}>1: jsh</Button>
		</div>
		<div class="terminal-toolbar-actions">
			<div class="toolbar-btn">
				<Button size="icon" variant="ghost" title="New Terminal" onclick={onRestartShell}>
					<Plus size={14} strokeWidth={1.7} />
				</Button>
			</div>
			<div class="toolbar-btn">
				<Button
					size="icon"
					variant="ghost"
					title="Collapse Toolbar"
					onclick={() => onSetOpen(false)}
				>
					<ChevronDown size={14} strokeWidth={1.7} />
				</Button>
			</div>
		</div>
	</div>
{:else if activeTab === 'TERMINAL'}
	<div class="terminal-toolbar collapsed">
		<div class="toolbar-btn">
			<Button size="sm" variant="ghost" title="Expand Toolbar" onclick={() => onSetOpen(true)}>
				<ChevronUp size={14} strokeWidth={1.7} />
				Terminal
			</Button>
		</div>
	</div>
{/if}

<style>
	.terminal-toolbar {
		height: 30px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-inline: 8px;
		background: color-mix(in srgb, var(--bg) 95%, black);
		border-bottom: 1px solid color-mix(in srgb, var(--border) 58%, transparent);
	}

	.terminal-toolbar::before {
		content: 'TERMINAL';
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.08em;
		color: color-mix(in srgb, var(--muted) 76%, var(--text));
		margin-right: 10px;
	}

	.terminal-toolbar > :first-child {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.terminal-toolbar.collapsed {
		justify-content: flex-start;
	}

	.session-tab :global([data-button-root]) {
		height: 22px;
		padding: 0 10px;
		font-size: 11px;
		font-weight: 500;
		letter-spacing: 0.02em;
		border-radius: 4px;
		background: transparent !important;
		border: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
		color: var(--muted);
	}

	.session-tab.active :global([data-button-root]) {
		color: var(--text);
		background: color-mix(in srgb, var(--fg) 62%, var(--bg)) !important;
	}

	.terminal-toolbar-actions {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.toolbar-btn :global([data-button-root]) {
		height: 22px;
		min-width: 22px;
		padding: 0 6px;
		font-size: 12px;
		line-height: 1;
		border-radius: 4px;
		background: transparent !important;
		color: var(--muted);
		border: 1px solid color-mix(in srgb, var(--border) 45%, transparent);
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
	}

	.toolbar-btn :global([data-button-root]:hover) {
		color: var(--text);
		background: color-mix(in srgb, var(--fg) 70%, var(--bg));
	}
</style>
