<script lang="ts">
	import { onDestroy, onMount } from 'svelte';

	import {
		createTerminalWorkspaceController,
		createTerminalPanelController,
		createTerminalSessionsController
	} from '$lib/controllers';
	import { requireIDEContext } from '$lib/context/ide-context.js';
	import { createShellProcess } from '$lib/services';
	import { appendTerminalAudit, collaborationPermissionsStore } from '$lib/stores';
	import { getPanelsContext } from '$lib/stores';
	import TerminalPanelHeader from './TerminalPanelHeader.svelte';
	import TerminalToolbar from './TerminalToolbar.svelte';
	import TerminalViewport from './TerminalViewport.svelte';

	const ide = requireIDEContext();
	const panel = createTerminalPanelController();
	const sessions = createTerminalSessionsController();

	let canExecute = $state(true);
	let roomId = $state<string | null>(null);

	const unsubscribePermissions = collaborationPermissionsStore.subscribe((value) => {
		canExecute = value.canWrite;
		roomId = value.roomId;
	});

	const layout = getPanelsContext();

	const workspace = createTerminalWorkspaceController({
		panel,
		sessions,
		createShell: ({ canExecute, onAudit }) =>
			createShellProcess(ide.getWebcontainer, { canExecute, onAudit }),
		canExecute: () => canExecute,
		getRoomId: () => roomId,
		recordAudit: appendTerminalAudit,
		getLayout: () => layout
	});

	$effect(() => {
		workspace.syncRuntimes();
	});

	onMount(() => {
		sessions.restoreFromStorage();
		workspace.syncRuntimes();
	});

	onDestroy(() => {
		unsubscribePermissions();
		workspace.destroy();
	});
</script>

<div class="terminal-layout">
	<TerminalPanelHeader
		tabItems={panel.tabItems}
		activeTab={panel.activeTab}
		onTabSelect={(id) => void workspace.switchTab(id)}
		onClear={workspace.clearActiveTerminal}
		onRestart={() => void workspace.restartActiveShell()}
		onKill={workspace.killActiveShell}
		onToggleMaximize={workspace.toggleMaximize}
		onClose={workspace.closePanel}
	/>

	<TerminalToolbar
		activeTab={panel.activeTab}
		sessions={workspace.sessionViews.map((s) => ({
			id: s.id,
			label: s.label,
			isReady: s.isReady
		}))}
		activeSessionId={sessions.activeSessionId}
		onSelectSession={(id) => void workspace.selectSession(id)}
		onCloseSession={workspace.closeSession}
		onEnsureShell={(id) => void workspace.ensureShellReady(id)}
		onCreateSession={() => void workspace.newSession()}
		onRenameSession={workspace.renameSession}
		onMoveSession={workspace.reorderSession}
	/>

	<TerminalViewport
		activeTab={panel.activeTab}
		placeholderText={workspace.placeholderText}
		sessions={workspace.sessionViews}
		activeSessionId={sessions.activeSessionId}
		{canExecute}
		options={panel.xtermOptions}
		onLoad={(sessionId) => void workspace.onTerminalMount(sessionId)}
		onData={workspace.sendInput}
		onRetry={(sessionId) => void workspace.ensureShellReady(sessionId)}
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
