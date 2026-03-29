import {
	createAutoSaver,
	createFileWriter,
	createEditorStatus,
	createEditorRuntime,
	createEditorActionHandlers,
	type EditorActionContext
} from '$lib/services';

import { useEditor } from '$lib/hooks';

import {
	deriveEditorSaveStatusVariant,
	deriveEditorTabItems,
	shouldShowEmptyEditorState
} from '$lib/utils/ide';

import type { IDEContext } from '$lib/context';
import type { createEditorStore, IDEPanels } from '$lib/stores';
import type { QuickAction } from '$types/editor.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CreateEditorPaneControllerOptions = {
	ide: IDEContext;
	editorStore: ReturnType<typeof createEditorStore>;
	activity: unknown;
	getPanels: () => IDEPanels | undefined;
	getCanWrite: () => boolean;
};

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

export function createEditorPaneController(options: CreateEditorPaneControllerOptions) {
	// ── Services ──────────────────────────────────────────────────────────────

	const autoSaver = createAutoSaver(() => options.ide.getProject());
	const fileWriter = createFileWriter(() => options.ide.getWebcontainer());
	const status = createEditorStatus(options.editorStore);

	const runtime = createEditorRuntime({
		getProject: () => options.ide.getProject(),
		getActivePath: () => options.editorStore.activeTabPath,
		toProjectFile: (path) => path,
		toWebPath: (path) => path,

		readFile: async (path) => {
			const wc = options.ide.getWebcontainer();
			if (!wc) return '';
			try {
				return await wc.fs.readFile(path, 'utf-8');
			} catch (error) {
				console.error(`[EditorController] Failed to read file at ${path}:`, error);
				return '';
			}
		},

		onStatusSync: () => status.syncFromEditor(runtime.getEditor()),

		// PersistPayload.nodePath is the absolute project-relative node path
		// (e.g. "/src/App.tsx"). Pass it directly to autoSaver and fileWriter.
		onPersist: ({ nodePath, content }) => {
			autoSaver.triggerAutoSave(nodePath, content);
			fileWriter.writeFile(nodePath, content);
		}
	});

	const lifecycle = useEditor({ runtime, status });

	// ── Action handlers ───────────────────────────────────────────────────────

	const context: EditorActionContext = {
		ide: options.ide,
		editorStore: options.editorStore,
		services: { autoSaver, fileWriter, runtime, lifecycle },
		getPanels: options.getPanels
	};

	const actions = createEditorActionHandlers(context);

	// ── Derived UI state ──────────────────────────────────────────────────────

	const state = {
		get saveStatusVariant() {
			return deriveEditorSaveStatusVariant(autoSaver.status);
		},
		get showEmptyState() {
			return shouldShowEmptyEditorState(
				options.editorStore.tabs,
				options.editorStore.activeTabPath
			);
		},
		get tabs() {
			return deriveEditorTabItems(options.editorStore.tabs, options.editorStore.isActive);
		}
	};

	// ── Keyboard shortcuts ────────────────────────────────────────────────────

	function mountShortcuts() {
		function onKeyDown(event: KeyboardEvent) {
			if (event.defaultPrevented) return;
			if (!(event.target instanceof HTMLElement)) return;
			if (
				event.target.tagName === 'INPUT' ||
				event.target.tagName === 'TEXTAREA' ||
				event.target.isContentEditable
			)
				return;

			if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
				event.preventDefault();
			}
		}

		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}

	// ── Public API ────────────────────────────────────────────────────────────

	const quickActions: readonly QuickAction[] = [
		{ label: 'Open a file', keys: ['Ctrl', 'O'] },
		{ label: 'Switch tab', keys: ['Ctrl', 'Tab'] },
		{ label: 'Save file', keys: ['Ctrl', 'S'] }
	];

	return {
		// Action handlers (openFile, closeTab, initialize, etc.)
		...actions,

		// Lifecycle — hoisted so callers don't need to go through .lifecycle
		initializeEditor: lifecycle.initializeEditor,
		syncAfterActivePathChange: lifecycle.syncAfterActivePathChange,
		/** Tears down the editor and releases all Monaco / Yjs resources. */
		shutdown: lifecycle.destroy,

		// Editor state
		get editorRuntimeError() {
			return lifecycle.editorRuntimeError;
		},
		get initializingEditor() {
			return lifecycle.initializingEditor;
		},

		// UI derived state
		...state,
		quickActions,

		// Services exposed for template bindings
		autoSaver,
		fileWriter,
		mountShortcuts
	};
}
