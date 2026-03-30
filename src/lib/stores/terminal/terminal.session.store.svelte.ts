export type TerminalSessionMeta = { id: string; label: string };

export function createTerminalSessionStore() {
	let nextOrder = $state(1);
	// Start empty to prevent SSR Hydration mismatches. The hook will populate this.
	let sessions = $state<TerminalSessionMeta[]>([]);
	let activeSessionId = $state<string>('');

	function buildSessionMeta(order: number): TerminalSessionMeta {
		return {
			id: `terminal-${order}-${Math.random().toString(36).slice(2, 8)}`,
			label: `${order}: jsh`
		};
	}

	return {
		get sessions() {
			return sessions;
		},
		get activeSessionId() {
			return activeSessionId;
		},
		get nextOrder() {
			return nextOrder;
		},

		// Injection point for the hook to hydrate state
		hydrate: (data: { sessions: TerminalSessionMeta[]; active: string; next: number }) => {
			sessions = data.sessions;
			activeSessionId = data.active;
			nextOrder = data.next;
		},

		addSession: () => {
			const session = buildSessionMeta(nextOrder);
			nextOrder += 1;
			sessions = [...sessions, session];
			activeSessionId = session.id;
			return session.id;
		},
		activateSession: (id: string) => {
			if (sessions.some((s) => s.id === id)) activeSessionId = id;
		},
		renameSession: (id: string, label: string) => {
			const trimmed = label.trim();
			if (trimmed) sessions = sessions.map((s) => (s.id === id ? { ...s, label: trimmed } : s));
		},
		reorderSession: (id: string, dir: 'left' | 'right') => {
			const idx = sessions.findIndex((s) => s.id === id);
			if (idx < 0) return;
			const next = idx + (dir === 'left' ? -1 : 1);
			if (next >= 0 && next < sessions.length) {
				const reordered = [...sessions];
				const [moved] = reordered.splice(idx, 1);
				reordered.splice(next, 0, moved);
				sessions = reordered;
			}
		},
		closeSession: (id: string) => {
			if (sessions.length <= 1) {
				const replacement = buildSessionMeta(nextOrder++);
				sessions = [replacement];
				activeSessionId = replacement.id;
			} else {
				sessions = sessions.filter((s) => s.id !== id);
				if (activeSessionId === id) activeSessionId = sessions[0].id;
			}
		}
	};
}
