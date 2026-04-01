import { collaborationPermissionsStore } from '$lib/stores/collaboration';
import type { TerminalStore } from '$lib/stores/terminal/terminal.store.svelte';
import type { TerminalWorkspace } from '$lib/services/terminal/createTerminalWorkspace.svelte.js';

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Svelte 5 hook — reactive lifecycle wrapper for the terminal.
 *
 * Contract:
 *   - Registers two $effects that MUST run during component initialization,
 *     which is why this lives in a hook rather than being called ad-hoc.
 *   - Effect 1: tracks store.sessions and re-runs workspace.syncRuntimes.
 *   - Effect 2: auto-persists session state to localStorage whenever sessions,
 *     activeSessionId, or nextOrder change.
 *   - Holds no $state of its own. All reactive state lives in TerminalStore
 *     (data) and TerminalWorkspace (shell runtimes / sessionViews).
 *   - Receives all dependencies via injection — imports no module singletons
 *     except collaborationPermissionsStore, which is a legitimate cross-cutting
 *     concern of the terminal lifecycle.
 *
 * Usage (inside Terminal.svelte, called after createTerminalController):
 *
 *   const { mount } = useTerminal({ store, workspace });
 *   onMount(() => {
 *     const cleanup = mount();
 *     return cleanup;   // returned fn becomes onDestroy automatically
 *   });
 *
 * File: useTerminal.svelte.ts → function: useTerminal
 */

const STORAGE_KEY = 'sandem.terminal.sessions.v1';

export function useTerminal(deps: { store: TerminalStore; workspace: TerminalWorkspace }) {
	const { store, workspace } = deps;

	// ── Effect 1: Sync State to Runtime ──────────────────────────────────────
	// Tracks sessions array; syncRuntimes uses untrack internally to avoid
	// re-entrancy with the $state it manages.
	$effect(() => {
		const sessions = store.sessions.sessions;
		workspace.syncRuntimes(sessions);
	});

	// ── Effect 2: Auto-Persistence ────────────────────────────────────────────
	// Tracks all session state fields. Writes to localStorage outside the store
	// so the store itself stays pure (no IO).
	$effect(() => {
		const dataToSave = {
			next: store.sessions.nextOrder,
			sessions: store.sessions.sessions,
			active: store.sessions.activeSessionId
		};
		if (typeof window !== 'undefined' && dataToSave.sessions.length > 0) {
			window.localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
		}
	});

	// ── Mount / cleanup ───────────────────────────────────────────────────────

	function mount(): () => void {
		// 1. Hydrate state client-side only (avoids SSR mismatch)
		if (typeof window !== 'undefined') {
			const raw = window.localStorage.getItem(STORAGE_KEY);
			let hydrated = false;

			if (raw) {
				try {
					const parsed = JSON.parse(raw);
					if (parsed.sessions?.length > 0) {
						store.sessions.hydrate(parsed);
						hydrated = true;
					}
				} catch {
					/* ignore malformed storage */
				}
			}

			// No valid save — create the default first session
			if (!hydrated) store.sessions.addSession();
		}

		// 2. Watch for theme changes and re-apply to all terminals
		const themeObserver = new MutationObserver(() => workspace.refreshThemes());
		themeObserver.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ['data-theme', 'data-mode', 'style', 'class']
		});

		// 3. React to external collaboration permission changes
		const unsubscribe = collaborationPermissionsStore.subscribe((value) => {
			store.applyPermissions(value.canWrite, value.roomId);
		});

		return function cleanup() {
			unsubscribe();
			themeObserver.disconnect();
			workspace.destroy();
		};
	}

	return { mount };
}
