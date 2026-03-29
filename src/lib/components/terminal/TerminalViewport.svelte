<script lang="ts">
	import type {
		ITerminalInitOnlyOptions,
		ITerminalOptions,
		Terminal
	} from '@battlefieldduck/xterm-svelte';
	import type { TerminalPanelTab } from '$lib/controllers/TerminalPanelController.svelte.js';
	import TerminalSessionPane from './TerminalSessionPane.svelte';

	type TerminalSessionView = {
		id: string;
		label: string;
		isReady: boolean;
		error: string | null;
		terminal?: Terminal;
	};

	type Props = {
		activeTab: TerminalPanelTab;
		placeholderText: string;
		sessions: TerminalSessionView[];
		activeSessionId: string;
		canExecute: boolean;
		options: ITerminalOptions & ITerminalInitOnlyOptions;
		onLoad: (sessionId: string) => Promise<void> | void;
		onData: (sessionId: string, data: string) => void;
		onRetry: (sessionId: string) => void;
	};

	let {
		activeTab,
		placeholderText,
		sessions,
		activeSessionId,
		canExecute,
		options,
		onLoad,
		onData,
		onRetry
	}: Props = $props();

	const activeSession = $derived(sessions.find((s) => s.id === activeSessionId) ?? null);
</script>

<div class="viewport">
	{#if activeTab === 'TERMINAL'}
		{#if activeSession}
			<TerminalSessionPane
				sessionId={activeSession.id}
				sessionLabel={activeSession.label}
				shellReady={activeSession.isReady}
				terminalError={activeSession.error}
				{canExecute}
				{options}
				{onLoad}
				{onData}
				{onRetry}
				bind:terminal={activeSession.terminal}
			/>
		{:else}
			<div class="empty">No terminal session available.</div>
		{/if}
	{:else}
		<div class="empty">{placeholderText}</div>
	{/if}
</div>

<style>
	.viewport {
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	.empty {
		height: 100%;
		display: grid;
		place-items: center;
		font-size: 12px;
		color: var(--muted);
	}
</style>
