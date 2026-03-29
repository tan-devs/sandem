// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TerminalSessionMeta = {
	id: string;
	label: string;
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'sandem.terminal.sessions.v1';

function buildSessionMeta(order: number): TerminalSessionMeta {
	return {
		id: `terminal-${order}-${Math.random().toString(36).slice(2, 8)}`,
		label: `${order}: jsh`
	};
}

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

export function createTerminalSessionsController() {
	let nextOrder = $state(2);
	let sessions = $state<TerminalSessionMeta[]>([buildSessionMeta(1)]);
	let activeSessionId = $state<string>(sessions[0].id);

	// ── Persistence ──────────────────────────────────────────────────────────

	function persist() {
		if (typeof window === 'undefined') return;
		window.localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({ nextOrder, sessions, activeSessionId })
		);
	}

	/**
	 * Restore session list from localStorage on mount.
	 * Silently ignores malformed or empty data.
	 */
	function restoreFromStorage() {
		if (typeof window === 'undefined') return;

		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (!raw) return;

		try {
			const parsed = JSON.parse(raw) as {
				nextOrder?: number;
				sessions?: TerminalSessionMeta[];
				activeSessionId?: string;
			};

			const valid = parsed.sessions?.filter((s) => s.id && s.label) ?? [];
			if (valid.length === 0) return;

			sessions = valid;
			nextOrder = Math.max(parsed.nextOrder ?? valid.length + 1, valid.length + 1);

			const activeExists = parsed.activeSessionId
				? valid.some((s) => s.id === parsed.activeSessionId)
				: false;
			activeSessionId = activeExists ? (parsed.activeSessionId as string) : valid[0].id;
		} catch {
			// Ignore malformed storage — state stays at defaults.
		}
	}

	// ── Session mutations ─────────────────────────────────────────────────────

	/** Make a session the active one. No-ops if the id is unknown. */
	function activateSession(id: string) {
		if (!sessions.some((s) => s.id === id)) return;
		activeSessionId = id;
		persist();
	}

	/** Create a new session, make it active, and return its id. */
	function addSession(): string {
		const session = buildSessionMeta(nextOrder);
		nextOrder += 1;
		sessions = [...sessions, session];
		activeSessionId = session.id;
		persist();
		return session.id;
	}

	/** Rename a session. Trims the label; no-ops on empty string or unknown id. */
	function renameSession(id: string, label: string) {
		const trimmed = label.trim();
		if (!trimmed || !sessions.some((s) => s.id === id)) return;
		sessions = sessions.map((s) => (s.id === id ? { ...s, label: trimmed } : s));
		persist();
	}

	/** Reorder a session one slot left or right. */
	function reorderSession(id: string, direction: 'left' | 'right') {
		const index = sessions.findIndex((s) => s.id === id);
		if (index < 0) return;

		const next = index + (direction === 'left' ? -1 : 1);
		if (next < 0 || next >= sessions.length) return;

		const reordered = sessions.slice();
		const [moved] = reordered.splice(index, 1);
		reordered.splice(next, 0, moved);
		sessions = reordered;
		persist();
	}

	/**
	 * Close a session by id.
	 * If it was the last session, a fresh replacement is created automatically
	 * so the terminal panel is never left in an empty state.
	 */
	function closeSession(id: string) {
		if (!sessions.some((s) => s.id === id)) return;

		if (sessions.length === 1) {
			const replacement = buildSessionMeta(nextOrder);
			nextOrder += 1;
			sessions = [replacement];
			activeSessionId = replacement.id;
			persist();
			return;
		}

		sessions = sessions.filter((s) => s.id !== id);

		if (activeSessionId === id) {
			activeSessionId = sessions[0].id;
		}

		persist();
	}

	// ── Public API ────────────────────────────────────────────────────────────

	return {
		restoreFromStorage,
		get sessions() {
			return sessions;
		},
		get activeSessionId() {
			return activeSessionId;
		},
		activateSession,
		addSession,
		renameSession,
		reorderSession,
		closeSession
	};
}
