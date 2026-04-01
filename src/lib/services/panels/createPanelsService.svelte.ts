import type { PanelsStore } from '$lib/stores/panels';

// ---------------------------------------------------------------------------
// Deps
// ---------------------------------------------------------------------------

export interface PanelsServiceDeps {
	store: PanelsStore;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * createPanelsService
 *
 * Pure logic layer over PanelsStore.
 * No $state, no DOM, no PaneAPI — those belong to usePanels.
 *
 * Responsibilities:
 *   - set helpers that write through to the store
 *   - toggle helpers (flip current value)
 *   - resetAll recovery (open all + persist)
 *   - localStorage persistence (read on hydrate, write on every mutation)
 *
 * Persistence key contract:
 *   workspace:panel:left   "true" | "false"
 *   workspace:panel:down   "true" | "false"
 *   workspace:panel:right  "true" | "false"
 */
export function createPanelsService(deps: PanelsServiceDeps) {
	const { store } = deps;

	// ── Persistence ──────────────────────────────────────────────────────────

	const KEYS = {
		left: 'workspace:panel:left',
		down: 'workspace:panel:down',
		right: 'workspace:panel:right'
	} as const;

	function readBool(key: string, fallback: boolean): boolean {
		try {
			const raw = localStorage.getItem(key);
			if (raw === null) return fallback;
			return raw === 'true';
		} catch {
			return fallback;
		}
	}

	function writeBool(key: string, value: boolean): void {
		try {
			localStorage.setItem(key, String(value));
		} catch {
			// localStorage may be unavailable in sandboxed environments — silent fail
		}
	}

	/**
	 * Restore persisted panel state into the store.
	 * Call once during createPanelsController construction.
	 */
	function hydrate(): void {
		store.setLeft(readBool(KEYS.left, true));
		store.setDown(readBool(KEYS.down, true));
		store.setRight(readBool(KEYS.right, false));
	}

	// ── Setters with persistence ──────────────────────────────────────────────

	function setLeft(open: boolean): void {
		store.setLeft(open);
		writeBool(KEYS.left, open);
	}

	function setDown(open: boolean): void {
		store.setDown(open);
		writeBool(KEYS.down, open);
	}

	function setRight(open: boolean): void {
		store.setRight(open);
		writeBool(KEYS.right, open);
	}

	// ── Toggles ───────────────────────────────────────────────────────────────

	function toggleLeft(): void {
		setLeft(!store.leftPane);
	}

	function toggleDown(): void {
		setDown(!store.downPane);
	}

	function toggleRight(): void {
		setRight(!store.rightPane);
	}

	// ── Reset ─────────────────────────────────────────────────────────────────

	/**
	 * Restore all panes to visible and persist.
	 * Used by the ErrorPanel recovery button.
	 */
	function resetAll(): void {
		setLeft(true);
		setDown(true);
		setRight(true);
	}

	return {
		hydrate,
		setLeft,
		setDown,
		setRight,
		toggleLeft,
		toggleDown,
		toggleRight,
		resetAll
	};
}

export type PanelsService = ReturnType<typeof createPanelsService>;
