/**
 * Pure reactive state for the Explorer panel.
 *
 * Philosophy: zero IO, zero service knowledge.
 * Every field is $state. Every derived value is $derived.
 * Side effects belong in hooks; mutations belong in services.
 */

const DOUBLE_CLICK_MS = 400;

export function createExplorerStateStore() {
	let selectedPath = $state<string | null>(null);
	let searchQuery = $state('');
	let openSections = $state<string[]>(['files']);

	// Not $state — plain vars are fine for transient click tracking.
	let _lastClickPath: string | null = null;
	let _lastClickTime = 0;

	const hasSearch = $derived(searchQuery.trim().length > 0);

	function selectNode(path: string): void {
		selectedPath = path;
	}

	function setSearchQuery(q: string): void {
		searchQuery = q;
	}

	function clearSearch(): void {
		searchQuery = '';
	}

	/**
	 * Returns 'double' if the same path was clicked within DOUBLE_CLICK_MS,
	 * otherwise 'single'. Caller decides what to do with either outcome.
	 */
	function handleClick(path: string): 'single' | 'double' {
		const now = Date.now();
		const isDouble = _lastClickPath === path && now - _lastClickTime < DOUBLE_CLICK_MS;
		_lastClickPath = path;
		_lastClickTime = now;
		return isDouble ? 'double' : 'single';
	}

	function reset(): void {
		selectedPath = null;
		searchQuery = '';
		openSections = ['files'];
		_lastClickPath = null;
		_lastClickTime = 0;
	}

	return {
		get selectedPath() {
			return selectedPath;
		},
		get searchQuery() {
			return searchQuery;
		},
		get hasSearch() {
			return hasSearch;
		},
		get openSections() {
			return openSections;
		},
		set openSections(v: string[]) {
			openSections = v;
		},
		selectNode,
		setSearchQuery,
		clearSearch,
		handleClick,
		reset
	};
}

export type ExplorerStateStore = ReturnType<typeof createExplorerStateStore>;
