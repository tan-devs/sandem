import type { Terminal } from '@battlefieldduck/xterm-svelte';
import { untrack } from 'svelte';
import { createErrorReporter } from '$lib/sveltekit/index.js';
import { applyTerminalTheme } from '$lib/utils/terminal';
import {
	isTerminalPanelTab,
	getTabPlaceholder,
	type TerminalPanelTab,
	type TerminalStore,
	type TerminalSessionMeta
} from '$lib/stores/terminal';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ShellProcess = {
	isReady: boolean;
	attach: (terminal: Terminal) => Promise<void>;
	sendInput: (data: string) => void;
	clearScreen: () => void;
	restart: () => Promise<void>;
	kill: () => void;
};

type SessionRuntime = {
	id: string;
	label: string;
	shell: ShellProcess;
	terminal: Terminal | undefined;
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
	/** Unified store — owns all panel/session/permissions state. */
	store: TerminalStore;
	createShell: ShellFactory;
	recordAudit: (entry: AuditEntry) => void;
	getLayout: () => PanelLayout | undefined;
};

/**
 * Flattened view of a session passed to presentation components.
 * `terminal` is set by onTerminalMount once xterm signals it is ready.
 */
export type SessionView = {
	id: string;
	label: string;
	isReady: boolean;
	error: string | null;
	terminal: Terminal | undefined;
};

// ---------------------------------------------------------------------------
// Service
//
// Runtime orchestration — reconciles session metadata with live shell
// processes, manages xterm attachment and CSS theme sync.
//
// Reads all panel/session/permissions state from opts.store; never owns
// that state itself.
//
// File: createTerminalWorkspace.svelte.ts → function: createTerminalWorkspace
// ---------------------------------------------------------------------------

export function createTerminalWorkspace(opts: TerminalWorkspaceOptions) {
	let runtimes = $state<SessionRuntime[]>([]);

	// ── Runtime lifecycle ─────────────────────────────────────────────────────

	function buildRuntime(meta: TerminalSessionMeta): SessionRuntime {
		return {
			id: meta.id,
			label: meta.label,
			shell: opts.createShell({
				canExecute: () => opts.store.canExecute,
				onAudit: ({ command, allowed, at }) =>
					opts.recordAudit({ at, command, allowed, roomId: opts.store.roomId })
			}),
			terminal: undefined,
			error: null
		};
	}

	function findRuntime(sessionId: string): SessionRuntime | undefined {
		return runtimes.find((r) => r.id === sessionId);
	}

	function getActiveRuntime(): SessionRuntime | undefined {
		return findRuntime(opts.store.sessions.activeSessionId);
	}

	function setError(sessionId: string, message: string | null) {
		runtimes = runtimes.map((r) => (r.id === sessionId ? { ...r, error: message } : r));
	}

	function reportError(sessionId: string, context: string, cause: unknown) {
		const report = createErrorReporter((msg) => setError(sessionId, msg));
		report(context, cause);
	}

	// ── Theme sync ────────────────────────────────────────────────────────────

	/**
	 * Re-applies CSS theme variables to every live terminal instance.
	 * Called by useTerminal's MutationObserver whenever the document theme changes.
	 */
	function refreshThemes() {
		for (const r of runtimes) {
			applyTerminalTheme(r.terminal);
		}
	}

	// ── Shell init ────────────────────────────────────────────────────────────

	/**
	 * Called by the xterm widget's onLoad callback once the DOM terminal
	 * instance exists. The terminal instance is passed directly as a parameter
	 * — do NOT use bind:terminal to propagate it up through a derived SessionView.
	 * Derived state is read-only; writing to it via bind: is a silent no-op in
	 * Svelte 5, which means shells would never attach.
	 */
	async function onTerminalMount(sessionId: string, terminal: Terminal) {
		const idx = runtimes.findIndex((r) => r.id === sessionId);
		if (idx < 0) return;

		// Write directly to $state — not through a derived object.
		runtimes[idx] = { ...runtimes[idx], terminal };

		try {
			setError(sessionId, null);
			applyTerminalTheme(terminal);
			await runtimes[idx].shell.attach(terminal);
		} catch (err) {
			reportError(sessionId, 'Failed to initialize terminal shell.', err);
		}
	}

	async function ensureShellReady(sessionId: string) {
		const runtime = findRuntime(sessionId);
		if (!runtime?.terminal) return;
		try {
			setError(sessionId, null);
			if (!runtime.shell.isReady) await runtime.shell.attach(runtime.terminal);
		} catch (err) {
			reportError(sessionId, 'Failed to start terminal shell.', err);
		}
	}

	// ── Session runtime sync ──────────────────────────────────────────────────

	/**
	 * Reconciles runtimes[] against the current session metadata list.
	 * Called reactively by useTerminal's $effect whenever sessions change,
	 * and directly after mutations that add sessions.
	 */
	function syncRuntimes(sessionList: TerminalSessionMeta[]) {
		untrack(() => {
			const knownIds = new Set(sessionList.map((s) => s.id));

			for (const meta of sessionList) {
				const existing = runtimes.find((r) => r.id === meta.id);
				if (existing) {
					existing.label = meta.label;
				} else {
					runtimes = [...runtimes, buildRuntime(meta)];
				}
			}

			const stale = runtimes.filter((r) => !knownIds.has(r.id));
			for (const r of stale) r.shell.kill();
			runtimes = runtimes.filter((r) => knownIds.has(r.id));
		});
	}

	// ── Panel tab actions ─────────────────────────────────────────────────────

	async function switchTab(id: string) {
		if (!isTerminalPanelTab(id)) return;
		opts.store.panel.switchTab(id as TerminalPanelTab);
		if (id === 'TERMINAL') await ensureShellReady(opts.store.sessions.activeSessionId);
	}

	// ── Session actions ───────────────────────────────────────────────────────

	async function selectSession(sessionId: string) {
		opts.store.sessions.activateSession(sessionId);
		await ensureShellReady(sessionId);
	}

	async function newSession() {
		const sessionId = opts.store.sessions.addSession();
		// Pass the updated session list explicitly — syncRuntimes is not reactive here.
		syncRuntimes(opts.store.sessions.sessions);
		await ensureShellReady(sessionId);
	}

	function renameSession(sessionId: string, label: string) {
		opts.store.sessions.renameSession(sessionId, label);
	}

	function reorderSession(sessionId: string, direction: 'left' | 'right') {
		opts.store.sessions.reorderSession(sessionId, direction);
	}

	function closeSession(sessionId: string) {
		opts.store.sessions.closeSession(sessionId);
	}

	// ── Active shell actions ──────────────────────────────────────────────────

	function clearActiveTerminal() {
		getActiveRuntime()?.shell.clearScreen();
	}

	async function restartActiveShell() {
		const sessionId = opts.store.sessions.activeSessionId;
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
		const sessionId = opts.store.sessions.activeSessionId;
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

	// ── Layout actions ────────────────────────────────────────────────────────

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
		if (opts.store.panel.activeTab === 'TERMINAL') return '';
		return getTabPlaceholder(opts.store.panel.activeTab);
	});

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
		// Note: the MutationObserver for theme changes lives in useTerminal — not here.
		for (const r of runtimes) r.shell.kill();
	}

	// ── Public API ────────────────────────────────────────────────────────────

	return {
		get sessionViews() {
			return sessionViews;
		},
		get placeholderText() {
			return placeholderText;
		},
		syncRuntimes,
		refreshThemes,
		destroy,
		onTerminalMount,
		ensureShellReady,
		switchTab,
		selectSession,
		newSession,
		renameSession,
		reorderSession,
		closeSession,
		clearActiveTerminal,
		restartActiveShell,
		killActiveShell,
		sendInput,
		toggleMaximize,
		closePanel
	};
}

export type TerminalWorkspace = ReturnType<typeof createTerminalWorkspace>;
