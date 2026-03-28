import type { IDEContext } from '$lib/context/ide/ide-context.js';

import {
	createAutoSaver,
	createFileWriter,
	createEditorStatus,
	createEditorRuntime,
	createEditorShortcuts
} from '$lib/services';

// Lifecycle lives in hooks — pure composition, not a service
import { useEditorLifecycle } from '$lib/hooks';

import {
	getRootFolder,
	resolveProjectFileName,
	toWebContainerPath
} from '$lib/utils/file-system.js';
import {
	EDITOR_QUICK_ACTIONS,
	deriveEditorSaveStatusVariant,
	deriveEditorTabItems,
	shouldShowEmptyEditorState
} from '$lib/utils';
import type { IDEPanels } from '$lib/stores/panelStore.svelte';

type CreateEditorPaneControllerOptions = {
	ide: IDEContext;
	editorStore: {
		activeTabPath: string | null;
		tabs: Array<{ path: string; label: string }>;
		isActive: (path: string) => boolean;
		openFile: (path: string) => void;
		closeTab: (path: string) => void;
		updateStatus: (next: {
			line?: number;
			column?: number;
			indentation?: string;
			encoding?: string;
			eol?: 'LF' | 'CRLF';
			language?: string;
		}) => void;
		resetStatus: () => void;
	};
	activity: { tab: string };
	getPanels: () => IDEPanels | undefined;
	getCanWrite: () => boolean;
};

/**
 * Orchestrates the editor pane: Monaco lifecycle, auto-save, WebContainer
 * writes, keyboard shortcuts, and derived UI state.
 *
 * ⚠️  Must be instantiated inside a Svelte 5 rune context (component body
 * or $effect.root). The $derived calls will produce stale values or throw
 * if called outside one.
 */
export function createEditorPaneController(options: CreateEditorPaneControllerOptions) {
	const project = $derived(options.ide.getProject(options.editorStore.activeTabPath ?? undefined));
	const rootFolder = $derived(
		getRootFolder(options.editorStore.activeTabPath ?? options.ide.getEntryPath())
	);

	const autoSaver = createAutoSaver(() => project);
	const fileWriter = createFileWriter(options.ide.getWebcontainer);
	const status = createEditorStatus(options.editorStore);
	const shortcuts = createEditorShortcuts({
		getPanels: options.getPanels,
		onOpenSearch: () => {
			options.activity.tab = 'search';
		},
		onToggleCommandPalette: () => {
			window.dispatchEvent(new CustomEvent('app:command-palette:toggle'));
		}
	});

	const runtime = createEditorRuntime({
		getProject: () => project,
		getActivePath: () => options.editorStore.activeTabPath,
		toProjectFile: (path) => toProjectFile(path),
		toWebPath: (projectFileName) => toWebPath(projectFileName),
		readFile: (path) => options.ide.getWebcontainer().fs.readFile(path, 'utf-8'),
		onPersist: ({ activePath, projectFileName, content }) => {
			if (!options.getCanWrite()) return;
			autoSaver.triggerAutoSave(projectFileName, content);
			fileWriter.writeFile(activePath, content);
		},
		onPersistBatch: (payloads) => {
			if (!options.getCanWrite() || payloads.length === 0) return;

			autoSaver.triggerAutoSaveBatch(
				payloads.map((payload) => ({
					path: payload.projectFileName,
					content: payload.content
				}))
			);

			for (const payload of payloads) {
				fileWriter.writeFile(payload.activePath, payload.content);
			}
		},
		onStatusSync: () => lifecycle.syncEditorStatusFromModel()
	});

	const lifecycle = useEditorLifecycle({ runtime, status });

	// Shutdown is one-way: once started it cannot be re-used. The component
	// that owns this controller must be fully remounted to get a fresh instance.
	let shutdownPromise: Promise<void> | null = null;

	function toProjectFile(path: string): string {
		const projectFiles = project?.files ?? [];
		return resolveProjectFileName(path, projectFiles);
	}

	function toWebPath(projectFileName: string): string {
		return toWebContainerPath(rootFolder, projectFileName);
	}

	function mountShortcuts() {
		return shortcuts.mount();
	}

	async function initializeEditor(element: HTMLDivElement) {
		await lifecycle.initializeEditor(element);
	}

	function syncAfterActivePathChange() {
		lifecycle.syncAfterActivePathChange();
	}

	async function shutdown() {
		if (shutdownPromise) {
			await shutdownPromise;
			return;
		}

		shutdownPromise = (async () => {
			await autoSaver.drainAndCleanup();
			await fileWriter.drainAndDispose();
			lifecycle.cleanup();
		})();

		await shutdownPromise;
	}

	const saveStatusVariant = $derived(deriveEditorSaveStatusVariant(autoSaver.status));
	const showEmptyState = $derived(
		shouldShowEmptyEditorState(options.editorStore.tabs, options.editorStore.activeTabPath)
	);
	const tabs = $derived(
		deriveEditorTabItems(options.editorStore.tabs, options.editorStore.isActive)
	);

	return {
		get project() {
			return project;
		},
		get rootFolder() {
			return rootFolder;
		},
		autoSaver,
		fileWriter,
		lifecycle,
		mountShortcuts,
		initializeEditor,
		syncAfterActivePathChange,
		shutdown,
		get saveStatusVariant() {
			return saveStatusVariant;
		},
		get showEmptyState() {
			return showEmptyState;
		},
		get tabs() {
			return tabs;
		},
		quickActions: EDITOR_QUICK_ACTIONS
	};
}
