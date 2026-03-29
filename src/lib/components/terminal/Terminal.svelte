<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { requireIDEContext } from '$lib/context/ide-context.js';
	import { createTerminal } from '$lib/services/createTerminal.svelte.js';
	import { useTerminal } from '$lib/hooks/useTerminal.svelte.js';
	import TerminalPanelHeader from './TerminalPanelHeader.svelte';
	import TerminalToolbar from './TerminalToolbar.svelte';
	import TerminalViewport from './TerminalViewport.svelte';

	// ── Wiring ────────────────────────────────────────────────────────────────

	const ide = requireIDEContext();
	const terminal = createTerminal(ide);
	const { mount } = useTerminal(terminal);

	// ── Lifecycle ─────────────────────────────────────────────────────────────

	let destroy: () => void;
	onMount(() => {
		destroy = mount();
	});
	onDestroy(() => destroy?.());
</script>

<div class="terminal-layout">
	<TerminalPanelHeader
		tabItems={terminal.panel.tabItems}
		activeTab={terminal.panel.activeTab}
		onTabSelect={(id) => void terminal.workspace.switchTab(id)}
		onClear={terminal.workspace.clearActiveTerminal}
		onRestart={() => void terminal.workspace.restartActiveShell()}
		onKill={terminal.workspace.killActiveShell}
		onToggleMaximize={terminal.workspace.toggleMaximize}
		onClose={terminal.workspace.closePanel}
	/>

	<TerminalToolbar
		activeTab={terminal.panel.activeTab}
		sessions={terminal.workspace.sessionViews.map((s) => ({
			id: s.id,
			label: s.label,
			isReady: s.isReady
		}))}
		activeSessionId={terminal.sessions.activeSessionId}
		onSelectSession={(id) => void terminal.workspace.selectSession(id)}
		onCloseSession={terminal.workspace.closeSession}
		onEnsureShell={(id) => void terminal.workspace.ensureShellReady(id)}
		onCreateSession={() => void terminal.workspace.newSession()}
		onRenameSession={terminal.workspace.renameSession}
		onMoveSession={terminal.workspace.reorderSession}
	/>

	<TerminalViewport
		activeTab={terminal.panel.activeTab}
		placeholderText={terminal.workspace.placeholderText}
		sessions={terminal.workspace.sessionViews}
		activeSessionId={terminal.sessions.activeSessionId}
		canExecute={terminal.canExecute}
		options={terminal.panel.xtermOptions}
		onLoad={(sessionId) => void terminal.workspace.onTerminalMount(sessionId)}
		onData={terminal.workspace.sendInput}
		onRetry={(sessionId) => void terminal.workspace.ensureShellReady(sessionId)}
	/>
</div>

<style>
	.terminal-layout {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--bg);
		border-top: 1px solid var(--border);
	}
</style>
