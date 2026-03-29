// src/lib/controllers/editor/EditorController.svelte.ts

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

export type CreateEditorPaneControllerOptions = {
	ide: IDEContext;
	editorStore: ReturnType<typeof createEditorStore>;
	activity: unknown;
	getPanels: () => IDEPanels | undefined;
	getCanWrite: () => boolean;
};

export function createEditorPaneController(options: CreateEditorPaneControllerOptions) {
	// 1. Initialize Services
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
		onPersist: ({ projectFileName, content }) => {
			autoSaver.triggerAutoSave(projectFileName, content);
			fileWriter.writeFile(projectFileName, content);
		}
	});

	const lifecycle = useEditor({ runtime, status });

	// 2. Setup Context & Handlers
	const context: EditorActionContext = {
		ide: options.ide,
		editorStore: options.editorStore,
		services: { autoSaver, fileWriter, runtime, lifecycle },
		getPanels: options.getPanels
	};

	const actions = createEditorActionHandlers(context);

	// 3. Derived State (UI-only)
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

	const quickActions: readonly QuickAction[] = [
		{ label: 'Open a file', keys: ['Ctrl', 'O'] },
		{ label: 'Switch tab', keys: ['Ctrl', 'Tab'] },
		{ label: 'Save file', keys: ['Ctrl', 'S'] }
	];

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

	return {
		...actions,
		initializeEditor: actions.initialize,
		...state,
		quickActions,
		autoSaver,
		fileWriter,
		lifecycle,
		mountShortcuts
	};
}
