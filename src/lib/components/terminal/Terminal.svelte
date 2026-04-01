<script lang="ts">
	import { onMount } from 'svelte';
	import { requireIDEContext } from '$lib/context';
	import { terminalStore } from '$lib/stores/terminal';
	import { createTerminalController } from '$lib/controllers/terminal';
	import { TerminalPanelHeader, TerminalToolbar, TerminalViewport } from '$lib/components/terminal';

	// ── Props ─────────────────────────────────────────────────────────────────
	//
	// getPanels is injected from the layout — the terminal only reads downPane
	// for maximize / close layout mutations. No context lookup, no legacy store.
	// Usage: <Terminal getPanels={() => panelsStore} />

	interface Props {
		getPanels: () => { downPane?: boolean } | undefined;
	}

	let { getPanels }: Props = $props();

	// ── Wiring ────────────────────────────────────────────────────────────────
	//
	// Wrap getPanels in a closure so the controller always re-reads the live
	// prop value on every call, not the value captured at construction time.
	// Terminal.svelte is a pure wiring root — no logic, no state.

	const ide = requireIDEContext();
	const ctrl = createTerminalController({
		ide,
		store: terminalStore,
		getPanels: () => getPanels()
	});

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
