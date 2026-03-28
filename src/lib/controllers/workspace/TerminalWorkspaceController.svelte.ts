import type { Terminal } from '@battlefieldduck/xterm-svelte';
import { createErrorReporter } from '$lib/sveltekit/index.js';
import {
	getTabPlaceholder,
	isTerminalPanelTab,
	type TerminalPanelTab
} from './TerminalPanelController.svelte.js';
import type { createTerminalPanelController } from './TerminalPanelController.svelte.js';
import type { createTerminalSessionsController } from './TerminalSessionsController.svelte.js';
import type { TerminalSessionMeta } from './TerminalSessionsController.svelte.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ShellProcess = {
	isReady: boolean;
	/** Attach the shell to an xterm instance and begin the jsh process. */
	attach: (terminal: Terminal) => Promise<void>;
	/** Send raw input bytes to the shell's stdin. */
	sendInput: (data: string) => void;
	/** Clear the xterm viewport. */
	clearScreen: () => void;
	/** Kill and re-spawn the shell process. */
	restart: () => Promise<void>;
	/** Terminate the shell process and release its WebContainer resources. */
	kill: () => void;
};

/** The full runtime state for one terminal session. */
type SessionRuntime = {
	id: string;
	label: string;
	shell: ShellProcess;
	/** The live xterm Terminal instance — set after the xterm widget mounts. */
	terminal?: Terminal;
	/** Non-null when the shell failed to start or crashed. */
	error: string | null;
};

type AuditEntry = {
	at: number;
	command: string;
	allowed: boolean;
	roomId: string | null;
};

type ShellFactory = (opts: {
	canExecute: () => boolean;
	onAudit: (entry: { command: string; allowed: boolean; at: number }) => void;
}) => ShellProcess;

type PanelLayout = {
	upPane?: boolean;
	downPane?: boolean;
};

export type TerminalWorkspaceOptions = {
	panel: ReturnType<typeof createTerminalPanelController>;
	sessions: ReturnType<typeof createTerminalSessionsController>;
	createShell: ShellFactory;
	canExecute: () => boolean;
	getRoomId: () => string | null;
	recordAudit: (entry: AuditEntry) => void;
	getLayout: () => PanelLayout | undefined;
};

/** Flattened view of a session passed down to presentation components. */
export type SessionView = {
	id: string;
	label: string;
	isReady: boolean;
	error: string | null;
	terminal?: Terminal;
};

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

export function createTerminalWorkspaceController(opts: TerminalWorkspaceOptions) {
	let runtimes = $state<SessionRuntime[]>([]);
	let themeObserver: MutationObserver | undefined;

	// ── Runtime lifecycle ─────────────────────────────────────────────────────

	function buildRuntime(meta: TerminalSessionMeta): SessionRuntime {
		return {
			id: meta.id,
			label: meta.label,
			shell: opts.createShell({
				canExecute: opts.canExecute,
				onAudit: ({ command, allowed, at }) =>
					opts.recordAudit({ at, command, allowed, roomId: opts.getRoomId() })
			}),
			terminal: undefined,
			error: null
		};
	}

	function findRuntime(sessionId: string): SessionRuntime | undefined {
		return runtimes.find((r) => r.id === sessionId);
	}

	function getActiveRuntime(): SessionRuntime | undefined {
		return findRuntime(opts.sessions.activeSessionId);
	}

	function setError(sessionId: string, message: string | null) {
		runtimes = runtimes.map((r) => (r.id === sessionId ? { ...r, error: message } : r));
	}

	function reportError(sessionId: string, context: string, cause: unknown) {
		const report = createErrorReporter((msg) => setError(sessionId, msg));
		report(context, cause);
	}

	// ── Theme sync ────────────────────────────────────────────────────────────

	function applyThemeToTerminal(terminal: Terminal | undefined) {
		if (!terminal) return;

		const style = getComputedStyle(document.documentElement);
		const mono = style.getPropertyValue('--fonts-mono').trim();
		terminal.options.fontFamily = mono || "'Cascadia Mono', 'Consolas', 'SF Mono', monospace";
		terminal.options.theme = {
			background: style.getPropertyValue('--bg').trim(),
			foreground: style.getPropertyValue('--text').trim(),
			cursor: style.getPropertyValue('--text').trim(),
			selectionBackground: style.getPropertyValue('--border').trim()
		};
	}

	function startThemeWatcher() {
		themeObserver?.disconnect();
		themeObserver = new MutationObserver(() => {
			for (const runtime of runtimes) {
				applyThemeToTerminal(runtime.terminal);
			}
		});
		themeObserver.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ['data-theme', 'data-mode', 'style', 'class']
		});
	}

	// ── Shell init ────────────────────────────────────────────────────────────

	/**
	 * Called by the xterm widget's `onLoad` callback.
	 * Attaches the shell process to the freshly-mounted terminal instance.
	 */
	async function onTerminalMount(sessionId: string) {
		const runtime = findRuntime(sessionId);
		if (!runtime?.terminal) return;

		try {
			setError(sessionId, null);
			applyThemeToTerminal(runtime.terminal);
			startThemeWatcher();
			await runtime.shell.attach(runtime.terminal);
		} catch (err) {
			reportError(sessionId, 'Failed to initialize terminal shell.', err);
		}
	}

	/**
	 * Ensure the shell is running for a given session.
	 * Called when switching sessions or retrying after an error.
	 * No-ops if the shell is already ready.
	 */
	async function ensureShellReady(sessionId: string) {
		const runtime = findRuntime(sessionId);
		if (!runtime?.terminal) return;

		try {
			setError(sessionId, null);
			if (!runtime.shell.isReady) {
				await runtime.shell.attach(runtime.terminal);
			}
		} catch (err) {
			reportError(sessionId, 'Failed to start terminal shell.', err);
		}
	}

	// ── Session runtime sync ──────────────────────────────────────────────────

	/**
	 * Reconcile the runtime list with the current session metadata list.
	 * Creates runtimes for new sessions, removes and kills runtimes for
	 * sessions that have been closed.
	 *
	 * Called reactively via `$effect` in the orchestrator component.
	 */
	function syncRuntimes() {
		const sessionList = opts.sessions.sessions;
		const knownIds = new Set(sessionList.map((s) => s.id));

		// Add new runtimes and update labels on existing ones.
		for (const meta of sessionList) {
			const existing = runtimes.find((r) => r.id === meta.id);
			if (existing) {
				existing.label = meta.label;
			} else {
				runtimes = [...runtimes, buildRuntime(meta)];
			}
		}

		// Kill and remove runtimes for sessions that no longer exist.
		const stale = runtimes.filter((r) => !knownIds.has(r.id));
		if (stale.length > 0) {
			for (const r of stale) r.shell.kill();
			runtimes = runtimes.filter((r) => knownIds.has(r.id));
		}
	}

	// ── Panel tab actions ─────────────────────────────────────────────────────

	async function switchTab(id: string) {
		if (!isTerminalPanelTab(id)) return;

		opts.panel.switchTab(id as TerminalPanelTab);

		if (id === 'TERMINAL') {
			await ensureShellReady(opts.sessions.activeSessionId);
		}
	}

	// ── Session actions ───────────────────────────────────────────────────────

	async function selectSession(sessionId: string) {
		opts.sessions.activateSession(sessionId);
		await ensureShellReady(sessionId);
	}

	async function newSession() {
		const sessionId = opts.sessions.addSession();
		syncRuntimes();
		await ensureShellReady(sessionId);
	}

	function renameSession(sessionId: string, label: string) {
		opts.sessions.renameSession(sessionId, label);
	}

	function reorderSession(sessionId: string, direction: 'left' | 'right') {
		opts.sessions.reorderSession(sessionId, direction);
	}

	function closeSession(sessionId: string) {
		opts.sessions.closeSession(sessionId);
	}

	// ── Active session shell actions ──────────────────────────────────────────

	function clearActiveTerminal() {
		getActiveRuntime()?.shell.clearScreen();
	}

	async function restartActiveShell() {
		const sessionId = opts.sessions.activeSessionId;
		const runtime = findRuntime(sessionId);
		if (!runtime) return;

		try {
			setError(sessionId, null);
			await runtime.shell.restart();
		} catch (err) {
			reportError(sessionId, 'Failed to restart terminal shell.', err);
		}
	}

	function killActiveShell() {
		const sessionId = opts.sessions.activeSessionId;
		const runtime = findRuntime(sessionId);
		if (!runtime) return;

		try {
			runtime.shell.kill();
		} catch (err) {
			reportError(sessionId, 'Failed to stop terminal shell.', err);
		}
	}

	function sendInput(sessionId: string, data: string) {
		const runtime = findRuntime(sessionId);
		if (!runtime) return;

		try {
			runtime.shell.sendInput(data);
		} catch (err) {
			reportError(sessionId, 'Failed to send input to terminal process.', err);
		}
	}

	// ── Panel layout actions ──────────────────────────────────────────────────

	function toggleMaximize() {
		const layout = opts.getLayout();
		if (!layout) return;
		const isMaximized = !layout.upPane && layout.downPane;
		if (isMaximized) {
			layout.upPane = true;
		} else {
			layout.downPane = true;
			layout.upPane = false;
		}
	}

	function closePanel() {
		const layout = opts.getLayout();
		if (!layout) return;
		layout.downPane = false;
	}

	// ── Derived state ─────────────────────────────────────────────────────────

	const placeholderText = $derived.by(() => {
		if (opts.panel.activeTab === 'TERMINAL') return '';
		return getTabPlaceholder(opts.panel.activeTab);
	});

	/** Flattened session views consumed by presentation components. */
	const sessionViews = $derived.by<SessionView[]>(() =>
		runtimes.map((r) => ({
			id: r.id,
			label: r.label,
			isReady: r.shell.isReady,
			error: r.error,
			terminal: r.terminal
		}))
	);

	// ── Cleanup ───────────────────────────────────────────────────────────────

	function destroy() {
		themeObserver?.disconnect();
		for (const r of runtimes) r.shell.kill();
	}

	// ── Public API ────────────────────────────────────────────────────────────

	return {
		// Reactive state
		get sessionViews() {
			return sessionViews;
		},
		get placeholderText() {
			return placeholderText;
		},

		// Lifecycle
		syncRuntimes,
		destroy,

		// xterm callbacks
		onTerminalMount,
		ensureShellReady,

		// Tab
		switchTab,

		// Sessions
		selectSession,
		newSession,
		renameSession,
		reorderSession,
		closeSession,

		// Active shell
		clearActiveTerminal,
		restartActiveShell,
		killActiveShell,
		sendInput,

		// Layout
		toggleMaximize,
		closePanel
	};
}
