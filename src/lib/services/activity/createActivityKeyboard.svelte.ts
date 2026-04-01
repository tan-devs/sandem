import type { TabId, ActivityTab } from '$lib/stores/activity/index.js';

// ---------------------------------------------------------------------------
// Deps interface
// ---------------------------------------------------------------------------

export interface ActivityKeyboardServiceDeps {
	/**
	 * The tab registry to build shortcut maps from.
	 * Driven by ActivityTab.shortcutLetter and ActivityTab.shortcutNumber.
	 */
	tabs: ActivityTab[];
	/**
	 * Callback fired when a keyboard shortcut resolves to a tab.
	 * Typically bound to createActivityTabService.selectTab.
	 */
	onSelect: (id: TabId) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isTypingTarget(target: EventTarget | null): boolean {
	const el = target as HTMLElement | null;
	if (!el) return false;
	return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * createActivityKeyboardService
 *
 * Registers global keyboard shortcuts that switch activity bar tabs.
 *
 * Shortcut map (built from ActivityTab registry, no hardcoded keys):
 *   Ctrl / Cmd + Shift + E  →  explorer
 *   Ctrl / Cmd + Shift + F  →  search
 *   Ctrl / Cmd + Shift + G  →  git
 *   Ctrl / Cmd + Shift + D  →  run
 *
 *   Alt + 1  →  explorer
 *   Alt + 2  →  search
 *   Alt + 3  →  git
 *   Alt + 4  →  run
 *
 * Shortcuts are suppressed when focus is inside an INPUT, TEXTAREA, or
 * contentEditable element to avoid hijacking user typing.
 *
 * Call mount() inside onMount in the owning component. The returned cleanup
 * function removes the listener — pass it as the return value of onMount.
 */
export function createActivityKeyboardService(deps: ActivityKeyboardServiceDeps) {
	// Build lookup maps from the tab registry so shortcut definitions live
	// only in the store, not scattered across the codebase.
	const letterMap = Object.fromEntries(
		deps.tabs.map((t) => [t.shortcutLetter.toLowerCase(), t.id])
	) as Record<string, TabId>;

	const numberMap = Object.fromEntries(deps.tabs.map((t) => [t.shortcutNumber, t.id])) as Record<
		string,
		TabId
	>;

	function onKeyDown(event: KeyboardEvent): void {
		if (event.defaultPrevented) return;
		if (isTypingTarget(event.target)) return;

		const mod = event.ctrlKey || event.metaKey;

		// Ctrl/Cmd + Shift + letter
		if (mod && event.shiftKey) {
			const tab = letterMap[event.key.toLowerCase()];
			if (!tab) return;
			event.preventDefault();
			deps.onSelect(tab);
			return;
		}

		// Alt + number
		if (!event.altKey) return;
		const tab = numberMap[event.key];
		if (!tab) return;
		event.preventDefault();
		deps.onSelect(tab);
	}

	/**
	 * Attaches the keydown listener to window.
	 * Returns a cleanup function — pass it as the onMount return value.
	 */
	function mount(): () => void {
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}

	return { mount };
}
