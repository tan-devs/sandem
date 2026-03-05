<script lang="ts">
	import { Xterm } from '@battlefieldduck/xterm-svelte';
	import type {
		ITerminalOptions,
		ITerminalInitOnlyOptions,
		Terminal
	} from '@battlefieldduck/xterm-svelte';
	import { onDestroy } from 'svelte';
	import { createShellProcess } from '$lib/hooks/createShellProcess.svelte.js';
	import { requireIDEContext } from '$lib/context/ide-context.js';

	const ide = requireIDEContext();
	let terminalInstance: Terminal | undefined = $state(undefined);

	// createShellProcess (not useShellProcess — that export doesn't exist)
	const shell = createShellProcess(ide.getWebcontainer);

	const options: ITerminalOptions & ITerminalInitOnlyOptions = {
		fontSize: 13,
		cursorBlink: true
	};

	async function handleLoad() {
		if (!terminalInstance) return;
		// Resolve CSS tokens to concrete values for the xterm theme.
		// CSS custom properties can't be used directly in JS objects, so
		// we read the computed values here — we're already in browser context.
		const style = getComputedStyle(document.documentElement);
		terminalInstance.options.fontFamily = style.getPropertyValue('--fonts-mono').trim();
		terminalInstance.options.theme = {
			background: style.getPropertyValue('--bg').trim(),
			foreground: style.getPropertyValue('--text').trim()
		};
		await shell.initShell(terminalInstance);
	}

	// Kill the shell process when this component is destroyed to avoid
	// leaking the WebContainer process and the WritableStream writer.
	onDestroy(() => {
		shell.killShell();
	});
</script>

<div class="terminal-layout">
	<div class="terminal-header">
		<div class="terminal-tab">Terminal</div>
	</div>
	<div class="terminal-container">
		<Xterm
			bind:terminal={terminalInstance}
			{options}
			onLoad={handleLoad}
			onData={(data) => shell.writeInput(data)}
		/>
	</div>
</div>

<style>
	.terminal-layout {
		display: flex;
		flex-direction: column;
		background: var(--bg);
	}
	.terminal-header {
		background: var(--fg);
		border-bottom: 1px solid var(--border);
		border-top: 1px solid var(--border);
	}
	.terminal-tab {
		padding: 8px 16px;
		background: var(--bg);
		color: var(--text);
		font-size: 12px;
		font-family: var(--fonts-mono);
		width: fit-content;
		border-top: 2px solid var(--accent);
	}
	.terminal-container {
		flex: 1;
		padding: 8px;
	}
</style>
