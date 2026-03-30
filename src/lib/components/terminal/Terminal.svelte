<script lang="ts">
	import { onMount } from 'svelte';
	import { requireIDEContext } from '$lib/context';
	import { getPanelsContext } from '$lib/stores';
	import { terminalStore } from '$lib/stores/terminal';
	import { createTerminalController } from '$lib/controllers';
	import { TerminalPanelHeader, TerminalToolbar, TerminalViewport } from '$lib/components/terminal';

	// ── Wiring ────────────────────────────────────────────────────────────────
	//
	// Terminal.svelte is a pure wiring root — no logic, no state, no imports
	// beyond context + the controller. Everything flows through ctrl.*.

	const ide = requireIDEContext();
	const ctrl = createTerminalController({ ide, store: terminalStore, getPanels: getPanelsContext });

	// ── Lifecycle ─────────────────────────────────────────────────────────────
	//
	// onMount returns cleanup → Svelte calls it as onDestroy automatically.

	onMount(() => ctrl.mount());
</script>

<div class="terminal-layout">
	<TerminalPanelHeader
		tabItems={ctrl.tabItems}
		activeTab={ctrl.activeTab}
		onTabSelect={ctrl.switchTab}
		onClear={ctrl.clearActiveTerminal}
		onRestart={ctrl.restartActiveShell}
		onKill={ctrl.killActiveShell}
		onToggleMaximize={ctrl.toggleMaximize}
		onClose={ctrl.closePanel}
	/>

	<TerminalToolbar
		activeTab={ctrl.activeTab}
		sessions={ctrl.sessionViews}
		activeSessionId={ctrl.activeSessionId}
		onSelectSession={ctrl.selectSession}
		onCloseSession={ctrl.closeSession}
		onCreateSession={ctrl.newSession}
		onRenameSession={ctrl.renameSession}
		onMoveSession={ctrl.reorderSession}
	/>

	<TerminalViewport
		activeTab={ctrl.activeTab}
		placeholderText={ctrl.placeholderText}
		sessions={ctrl.sessionViews}
		activeSessionId={ctrl.activeSessionId}
		canExecute={ctrl.canExecute}
		options={ctrl.xtermOptions}
		onLoad={ctrl.onTerminalMount}
		onData={ctrl.sendInput}
		onRetry={ctrl.ensureShellReady}
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
