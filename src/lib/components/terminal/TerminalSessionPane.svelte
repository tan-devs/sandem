<script lang="ts">
	import { Xterm } from '@battlefieldduck/xterm-svelte';
	import type {
		ITerminalInitOnlyOptions,
		ITerminalOptions,
		Terminal
	} from '@battlefieldduck/xterm-svelte';

	import { ErrorPanel, Button } from '$lib/components/ui/primitives/';

	type Props = {
		sessionId: string;
		sessionLabel: string;
		shellReady: boolean;
		terminalError: string | null;
		canExecute: boolean;
		options: ITerminalOptions & ITerminalInitOnlyOptions;
		/** Passes the live Terminal instance so workspace can register it on runtimes[] directly. */
		onLoad: (sessionId: string, terminal: Terminal) => Promise<void> | void;
		onData: (sessionId: string, data: string) => void;
		onRetry: (sessionId: string) => void;
	};

	let {
		sessionId,
		sessionLabel,
		shellReady,
		terminalError,
		canExecute,
		options,
		onLoad,
		onData,
		onRetry
	}: Props = $props();

	// terminal is local state — no longer a bindable prop.
	// xterm sets it via bind:terminal; we forward it to onLoad so the workspace
	// can register it on runtimes[] directly, bypassing the derived SessionView.
	let terminal = $state<Terminal | undefined>();
</script>

<div class="pane">
	{#if terminalError}
		<ErrorPanel
			title="Terminal unavailable"
			description="The terminal pane encountered an error."
			message={terminalError}
			testId={`terminal-pane-error-${sessionId}`}
			compact
		>
			{#snippet actions()}
				<Button size="sm" variant="ghost" onclick={() => onRetry(sessionId)}>Retry</Button>
			{/snippet}
		</ErrorPanel>
	{:else if !canExecute}
		<div class="empty">Terminal is read-only for viewers.</div>
	{:else}
		<div class="xterm-wrap">
			<Xterm
				bind:terminal
				{options}
				onLoad={() => onLoad(sessionId, terminal!)}
				onData={(data) => onData(sessionId, data)}
			/>
		</div>
		<div class="statusbar" role="status" aria-live="polite">
			<span class="dot" class:ready={shellReady}></span>
			<span class="label">{sessionLabel}</span>
			<span class="sep"></span>
			<span>{shellReady ? 'Connected' : 'Starting…'}</span>
			<span class="spacer"></span>
			<span>{canExecute ? 'Read/Write' : 'Read-Only'}</span>
			<span class="sep"></span>
			<span>UTF-8</span>
		</div>
	{/if}
</div>

<style>
	.pane {
		display: grid;
		grid-template-rows: minmax(0, 1fr) 22px;
		height: 100%;
		min-height: 0;
	}

	.xterm-wrap {
		min-height: 0;
		overflow: hidden;
	}

	.statusbar {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 0 10px;
		font-size: 11px;
		font-family: var(--fonts-mono, monospace);
		color: var(--muted);
		background: color-mix(in srgb, var(--bg) 80%, var(--mg));
		border-top: 1px solid var(--border);
	}

	.dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #f59e0b;
		flex-shrink: 0;
	}

	.dot.ready {
		background: #22c55e;
	}

	.label {
		font-weight: 600;
		color: var(--text);
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.sep {
		width: 1px;
		height: 10px;
		background: var(--border);
		flex-shrink: 0;
	}

	.spacer {
		flex: 1;
	}

	.empty {
		height: 100%;
		display: grid;
		place-items: center;
		font-size: 12px;
		color: var(--muted);
	}
</style>
