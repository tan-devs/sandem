<script lang="ts">
	import { Xterm, XtermAddon } from '@battlefieldduck/xterm-svelte';
	import type {
		ITerminalOptions,
		ITerminalInitOnlyOptions,
		Terminal
	} from '@battlefieldduck/xterm-svelte';
	import type { WebContainerProcess } from '@webcontainer/api';

	// Accept the booted and mounted webcontainer
	let { webcontainer }: { webcontainer: import('@webcontainer/api').WebContainer } = $props();

	let terminal = $state<Terminal>();
	let shellProcess: WebContainerProcess | undefined;
	let shellInput: WritableStreamDefaultWriter<string> | undefined;

	const options: ITerminalOptions & ITerminalInitOnlyOptions = {
		fontFamily: 'Consolas, monospace',
		convertEol: true, // Prevents diagonal staircase text
		theme: { background: '#1e1e1e' } // Matches the editor
	};

	async function onLoad() {
		if (!terminal) return;

		// 1. Load and apply FitAddon
		const fitAddon = new (await XtermAddon.FitAddon()).FitAddon();
		terminal.loadAddon(fitAddon);
		fitAddon.fit();

		// 2. Make it responsive!
		window.addEventListener('resize', () => fitAddon.fit());

		// 3. Spawn a 'jsh' (JavaScript Shell) process in the WebContainer
		shellProcess = await webcontainer.spawn('jsh', {
			terminal: {
				cols: terminal.cols,
				rows: terminal.rows
			}
		});

		// 4. Get the input writer so we can send keystrokes to the shell
		shellInput = shellProcess.input.getWriter();

		// 5. Pipe the shell's output to the terminal
		shellProcess.output.pipeTo(
			new WritableStream({
				write(data) {
					terminal?.write(data);
				}
			})
		);

		// Optional: Tell the shell when the terminal is resized
		terminal.onResize((size) => {
			shellProcess?.resize({
				cols: size.cols,
				rows: size.rows
			});
		});
	}

	function onData(data: string) {
		// 6. Send keystrokes directly into the WebContainer shell
		if (shellInput) {
			shellInput.write(data);
		}
	}
</script>

<div class="h-full w-full overflow-hidden border-t border-[#2d2d2d] bg-[#1e1e1e] p-2">
	<Xterm bind:terminal {options} {onLoad} {onData} />
</div>
