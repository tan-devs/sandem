import { XtermAddon } from '@battlefieldduck/xterm-svelte';
import type { Terminal } from '@battlefieldduck/xterm-svelte';
import type { WebContainer, WebContainerProcess } from '@webcontainer/api';

type ShellProcessOptions = {
	canExecute?: () => boolean;
	onAudit?: (entry: { command: string; allowed: boolean; at: number }) => void;
};

export function createTerminalShell(
	getWebcontainer: () => WebContainer,
	options: ShellProcessOptions = {}
) {
	let shellProcess: WebContainerProcess | undefined;
	let shellInput: WritableStreamDefaultWriter<string> | undefined;
	let terminalRef: Terminal | undefined;
	let fitAddon:
		| InstanceType<Awaited<ReturnType<typeof XtermAddon.FitAddon>>['FitAddon']>
		| undefined;
	let onWindowResize: (() => void) | undefined;
	let ready = $state(false);
	let commandBuffer = '';
	let gitShimInitialized = false;

	function isAllowed() {
		return options.canExecute ? options.canExecute() : true;
	}

	function audit(command: string, allowed: boolean) {
		const trimmed = command.trim();
		if (!trimmed) return;
		options.onAudit?.({ command: trimmed, allowed, at: Date.now() });
	}

	function pushCommandChunks(data: string, allowed: boolean) {
		commandBuffer += data;
		const lines = commandBuffer.split(/\r?\n/);
		commandBuffer = lines.pop() ?? '';
		for (const line of lines) {
			audit(line, allowed);
		}
	}

	async function setupGitCommandShim() {
		if (!shellInput || gitShimInitialized) return;
		gitShimInitialized = true;

		await shellInput.write(
			'mkdir -p .sandem/bin; ' +
				'if ! command -v git >/dev/null 2>&1; then ' +
				"if command -v isogit >/dev/null 2>&1; then echo '#!/bin/sh' > .sandem/bin/git; echo 'isogit \"$@\"' >> .sandem/bin/git; " +
				"elif command -v pnpm >/dev/null 2>&1; then echo '#!/bin/sh' > .sandem/bin/git; echo 'pnpm exec isogit \"$@\"' >> .sandem/bin/git; " +
				"elif command -v npx >/dev/null 2>&1; then echo '#!/bin/sh' > .sandem/bin/git; echo 'npx isogit \"$@\"' >> .sandem/bin/git; " +
				'fi; ' +
				'if [ -f .sandem/bin/git ]; then chmod +x .sandem/bin/git; export PATH="$PWD/.sandem/bin:$PATH"; fi; ' +
				'fi\n'
		);
	}

	async function attach(terminal: Terminal) {
		if (!isAllowed()) {
			audit('init-shell', false);
			return;
		}

		terminalRef = terminal;
		if (shellProcess) return;

		const webcontainer = getWebcontainer();

		fitAddon = new (await XtermAddon.FitAddon()).FitAddon();
		terminal.loadAddon(fitAddon);
		fitAddon.fit();

		onWindowResize = () => fitAddon?.fit();
		window.addEventListener('resize', onWindowResize);

		shellProcess = await webcontainer.spawn('jsh', {
			terminal: { cols: terminal.cols, rows: terminal.rows }
		});

		shellInput = shellProcess.input.getWriter();
		await setupGitCommandShim();

		shellProcess.output.pipeTo(
			new WritableStream({
				write(data) {
					terminal.write(data);
				}
			})
		);

		terminal.onResize((size) => {
			shellProcess?.resize({ cols: size.cols, rows: size.rows });
		});

		ready = true;
	}

	function sendInput(data: string) {
		if (!isAllowed()) {
			pushCommandChunks(data, false);
			return;
		}

		pushCommandChunks(data, true);
		shellInput?.write(data);
	}

	function clearScreen() {
		terminalRef?.clear();
	}

	async function restart() {
		if (!isAllowed()) {
			audit('restart-shell', false);
			return;
		}

		if (!terminalRef) return;
		kill();
		await attach(terminalRef);
	}

	/** Kill the shell process — call from onDestroy. */
	function kill() {
		if (!isAllowed()) {
			audit('kill-shell', false);
			return;
		}

		shellInput?.close().catch(() => {});
		shellProcess?.kill();
		if (onWindowResize) {
			window.removeEventListener('resize', onWindowResize);
			onWindowResize = undefined;
		}
		fitAddon = undefined;
		shellProcess = undefined;
		shellInput = undefined;
		ready = false;
		commandBuffer = '';
		gitShimInitialized = false;
	}

	return {
		get isReady() {
			return ready;
		},
		attach,
		sendInput,
		clearScreen,
		restart,
		kill
	};
}
