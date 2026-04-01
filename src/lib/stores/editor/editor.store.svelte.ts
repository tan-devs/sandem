// src/lib/stores/editorStore.svelte.ts

export interface EditorTab {
	path: string; // full path, e.g. "src/App.tsx"
	label: string; // filename only, e.g. "App.tsx"
}

export interface EditorStatus {
	line: number;
	column: number;
	indentation: string;
	encoding: string;
	eol: 'LF' | 'CRLF';
	language: string;
}

const DEFAULT_EDITOR_STATUS: EditorStatus = {
	line: 1,
	column: 1,
	indentation: 'Spaces: 2',
	encoding: 'UTF-8',
	eol: 'LF',
	language: 'Plain Text'
};

export function createEditorStore() {
	let openTabs = $state<EditorTab[]>([]);
	let activeTabPath = $state<string | null>(null);
	let status = $state<EditorStatus>({ ...DEFAULT_EDITOR_STATUS });

	function openFile(path: string) {
		const label = path.split('/').at(-1) ?? path;

		// If already open, just focus it
		if (!openTabs.find((t) => t.path === path)) {
			openTabs = [...openTabs, { path, label }];
		}

		activeTabPath = path;
	}

	function closeTab(path: string) {
		const idx = openTabs.findIndex((t) => t.path === path);
		openTabs = openTabs.filter((t) => t.path !== path);

		// If we closed the active tab, activate the nearest neighbour
		if (activeTabPath === path) {
			activeTabPath = openTabs[idx]?.path ?? openTabs[idx - 1]?.path ?? null;
		}
	}

	function isActive(path: string) {
		return activeTabPath === path;
	}

	function updateStatus(next: Partial<EditorStatus>) {
		const merged = { ...status, ...next };
		if (
			merged.line === status.line &&
			merged.column === status.column &&
			merged.indentation === status.indentation &&
			merged.encoding === status.encoding &&
			merged.eol === status.eol &&
			merged.language === status.language
		) {
			return;
		}

		status = merged;
	}

	function resetStatus() {
		status = { ...DEFAULT_EDITOR_STATUS };
	}

	return {
		get tabs() {
			return openTabs;
		},
		get activeTabPath() {
			return activeTabPath;
		},
		get status() {
			return status;
		},
		openFile,
		closeTab,
		isActive,
		updateStatus,
		resetStatus
	};
}
export const editorStore = createEditorStore();
export type EditorStore = ReturnType<typeof createEditorStore>;
