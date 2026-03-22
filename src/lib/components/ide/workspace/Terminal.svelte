<script lang="ts">
	import type { Terminal } from '@battlefieldduck/xterm-svelte';
	import { onDestroy } from 'svelte';

	import {
		createTerminalPanelController,
		getTerminalTabPlaceholder,
		isTerminalPanelTab,
		type TerminalPanelTab
	} from '$lib/controllers';
	import { requireIDEContext } from '$lib/context';
	import { createShellProcess } from '$lib/services';
	import { createErrorReporter } from '$lib/sveltekit/index.js';
	import { appendTerminalAudit, collaborationPermissionsStore } from '$lib/stores';
	import { getPanelsContext } from '$lib/stores';
	import TerminalPanelHeader from './TerminalPanelHeader.svelte';
	import TerminalToolbar from './TerminalToolbar.svelte';
	import TerminalViewport from './TerminalViewport.svelte';

	const ide = requireIDEContext();
	const terminalPanel = createTerminalPanelController();
	let terminalInstance: Terminal | undefined = $state(undefined);
	let canExecute = $state(true);
	let roomId = $state<string | null>(null);
	const unsubscribePermissions = collaborationPermissionsStore.subscribe((value) => {
		canExecute = value.canWrite;
		roomId = value.roomId;
	});

	// createShellProcess (not useShellProcess — that export doesn't exist)
	const shell = createShellProcess(ide.getWebcontainer, {
		canExecute: () => canExecute,
		onAudit: ({ command, allowed, at }) => {
			appendTerminalAudit({
				at,
				command,
				allowed,
				roomId
			});
		}
	});

	const panels = getPanelsContext();

	const reportTerminalError = createErrorReporter((next) => {
		terminalPanel.setTerminalError(next);
	});
	let themeObserver: MutationObserver | undefined;

	function syncTerminalTheme() {
		if (!terminalInstance) return;

		const style = getComputedStyle(document.documentElement);
		const mono = style.getPropertyValue('--fonts-mono').trim();
		terminalInstance.options.fontFamily =
			mono || "'Cascadia Mono', 'Consolas', 'SF Mono', monospace";
		terminalInstance.options.theme = {
			background: style.getPropertyValue('--bg').trim(),
			foreground: style.getPropertyValue('--text').trim(),
			cursor: style.getPropertyValue('--text').trim(),
			selectionBackground: style.getPropertyValue('--border').trim()
		};
	}

	function watchThemeChanges() {
		themeObserver?.disconnect();
		themeObserver = new MutationObserver(() => {
			syncTerminalTheme();
		});
		themeObserver.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ['data-theme', 'data-mode', 'style', 'class']
		});
	}

	async function handleLoad() {
		if (!terminalInstance) return;
		try {
			terminalPanel.clearTerminalError();
			syncTerminalTheme();
			watchThemeChanges();
			await shell.initShell(terminalInstance);
		} catch (error) {
			reportTerminalError('Failed to initialize terminal shell.', error);
		}
	}

	async function ensureShell() {
		if (!terminalInstance) return;
		try {
			terminalPanel.clearTerminalError();
			if (!shell.isReady) {
				await shell.initShell(terminalInstance);
			}
		} catch (error) {
			reportTerminalError('Failed to start terminal shell.', error);
		}
	}

	async function handleTabClick(id: string) {
		if (!isTerminalPanelTab(id)) return;

		terminalPanel.setActiveTab(id);

		const tab: TerminalPanelTab = id;
		if (tab === 'TERMINAL') {
			await ensureShell();
		}
	}

	function clearTerminal() {
		shell.clearTerminal();
	}

	async function restartTerminal() {
		try {
			terminalPanel.clearTerminalError();
			await shell.restartShell();
		} catch (error) {
			reportTerminalError('Failed to restart terminal shell.', error);
		}
	}

	function killTerminal() {
		try {
			shell.killShell();
		} catch (error) {
			reportTerminalError('Failed to stop terminal shell.', error);
		}
	}

	function handleTerminalInput(data: string) {
		try {
			shell.writeInput(data);
		} catch (error) {
			reportTerminalError('Failed to send input to terminal process.', error);
		}
	}

	function toggleMaximize() {
		if (!panels) return;
		const isMaximized = !panels.upPane && panels.downPane;
		if (isMaximized) {
			panels.upPane = true;
			return;
		}
		panels.downPane = true;
		panels.upPane = false;
	}

	function closePanel() {
		if (!panels) return;
		panels.downPane = false;
	}

	const placeholderText = $derived.by(() => {
		if (terminalPanel.activeTab === 'TERMINAL') return '';
		return getTerminalTabPlaceholder(terminalPanel.activeTab);
	});

	// Kill the shell process when this component is destroyed to avoid
	// leaking the WebContainer process and the WritableStream writer.
	onDestroy(() => {
		unsubscribePermissions();
		themeObserver?.disconnect();
		shell.killShell();
	});
</script>

<div class="terminal-layout">
	<TerminalPanelHeader
		panelTabItems={terminalPanel.panelTabItems}
		activeTab={terminalPanel.activeTab}
		onTabSelect={(id) => void handleTabClick(id)}
		onClearTerminal={clearTerminal}
		onRestartTerminal={() => void restartTerminal()}
		onKillTerminal={killTerminal}
		onToggleMaximize={toggleMaximize}
		onClosePanel={closePanel}
	/>

	<TerminalToolbar
		activeTab={terminalPanel.activeTab}
		isOpen={terminalPanel.isTerminalToolbarOpen}
		isReady={shell.isReady}
		onEnsureShell={() => void ensureShell()}
		onRestartShell={() => void restartTerminal()}
		onSetOpen={terminalPanel.setTerminalToolbarOpen}
	/>

	<TerminalViewport
		activeTab={terminalPanel.activeTab}
		{placeholderText}
		terminalError={terminalPanel.terminalError}
		{canExecute}
		shellReady={shell.isReady}
		options={terminalPanel.options}
		onLoad={handleLoad}
		onData={handleTerminalInput}
		onRetry={() => void ensureShell()}
		bind:terminal={terminalInstance}
	/>
</div>

<style>
	.terminal-layout {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: color-mix(in srgb, var(--bg) 92%, black);
		border-top: 1px solid color-mix(in srgb, var(--border) 64%, transparent);
	}
</style>
