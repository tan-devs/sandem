<script lang="ts">
	import { Xterm, XtermAddon } from '@battlefieldduck/xterm-svelte';
	import type {
		ITerminalOptions,
		ITerminalInitOnlyOptions,
		Terminal
	} from '@battlefieldduck/xterm-svelte';
	import type { WebContainer, WebContainerProcess } from '@webcontainer/api';

	let {
		webcontainer
	}: {
		webcontainer: WebContainer;
	} = $props();

	// STRICT FIX: Explicitly allow undefined
	let terminal: Terminal | undefined = $state(undefined);
	let shellProcess: WebContainerProcess | undefined;
	let shellInput: WritableStreamDefaultWriter<string> | undefined;

	const options: ITerminalOptions & ITerminalInitOnlyOptions = {
		fontFamily: 'Consolas, monospace',
		convertEol: true,
		theme: { background: '#1e1e1e' }
	};

	async function onLoad() {
		if (!terminal) return;

		const fitAddon = new (await XtermAddon.FitAddon()).FitAddon();
		terminal.loadAddon(fitAddon);
		fitAddon.fit();

		window.addEventListener('resize', () => fitAddon.fit());

		shellProcess = await webcontainer.spawn('jsh', {
			terminal: { cols: terminal.cols, rows: terminal.rows }
		});

		shellInput = shellProcess.input.getWriter();

		shellProcess.output.pipeTo(
			new WritableStream<string>({
				write(data) {
					terminal?.write(data);
				}
			})
		);

		terminal.onResize((size: { cols: number; rows: number }) => {
			shellProcess?.resize({ cols: size.cols, rows: size.rows });
		});
	}

	function onData(data: string) {
		if (shellInput) {
			shellInput.write(data);
		}
	}
</script>

<div class="terminal-container">
	<Xterm bind:terminal {options} {onLoad} {onData} />
</div>

<style>
	.terminal-container {
		height: 100%;
		width: 100%;
		overflow: hidden;
		background-color: #1e1e1e;
		padding: 0.5rem;
		box-sizing: border-box;
	}
</style>
