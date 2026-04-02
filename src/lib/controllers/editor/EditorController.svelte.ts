import {
	createEditorAutoSaver,
	createEditorFileWriter,
	createEditorStatus,
	createEditor,
	createEditorActions,
	type EditorActionContext
} from '$lib/services/editor';

import { useEditor } from '$lib/hooks';

import {
	deriveEditorSaveStatusVariant,
	deriveEditorTabItems,
	shouldShowEmptyEditorState
} from '$lib/utils/ide';

import type { IDEContext } from '$lib/context/webcontainer';
import type { createEditorStore } from '$lib/stores/editor';
import type { IDEPanelsAdapter } from '$lib/controllers/panels';
import type { QuickAction } from '$types/editor.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EditorControllerOptions = {
	ide: IDEContext;
	store: ReturnType<typeof createEditorStore>;
	getPanels: () => IDEPanelsAdapter | undefined;
	getCanWrite: () => boolean;
};

// ---------------------------------------------------------------------------
// Controller
//
// Assembly layer. Instantiates services and the hook, wires them together,
// computes derived UI state, and returns the flat API Editor.svelte consumes.
//
// Layer contract:
//   Services (createEditor, createEditorAutoSaver, ...) — no reactive state
//   Hook (useEditor) — owns reactive error/loading state for the runtime
//   Controller (this) — assembles both, owns keyboard shortcut registration
// ---------------------------------------------------------------------------

export function createEditorController(options: EditorControllerOptions) {
	// ── Services ──────────────────────────────────────────────────────────────

	const autoSaver = createEditorAutoSaver(() => options.ide.getProject());
	const fileWriter = createEditorFileWriter(() => options.ide.getWebcontainer());
	const status = createEditorStatus(options.store);

	const runtime = createEditor({
		getProject: () => options.ide.getProject(),
		getActivePath: () => options.store.activeTabPath,
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

		onPersist: ({ nodePath, content }) => {
			autoSaver.triggerAutoSave(nodePath, content);
			fileWriter.writeFile(nodePath, content);
		}
	});

	// ── Hook ──────────────────────────────────────────────────────────────────
	//
	// useEditor wraps the runtime with Svelte-reactive state:
	// editorRuntimeError, editorReady, initializingEditor.
	// It also owns the safe initialize/destroy sequence.

	const editor = useEditor({ runtime, status });

	// ── Action handlers ───────────────────────────────────────────────────────

	const context: EditorActionContext = {
		ide: options.ide,
		editorStore: options.store,
		services: { autoSaver, fileWriter, runtime, lifecycle: editor },
		getPanels: options.getPanels
	};

	const actions = createEditorActions(context);

	// ── Derived UI state ──────────────────────────────────────────────────────

	const derived = {
		get saveStatusVariant() {
			return deriveEditorSaveStatusVariant(autoSaver.status);
		},
		get showEmptyState() {
			return shouldShowEmptyEditorState(options.store.tabs, options.store.activeTabPath);
		},
		get tabs() {
			return deriveEditorTabItems(options.store.tabs, options.store.isActive);
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

	// ── Quick actions ─────────────────────────────────────────────────────────

	const quickActions: readonly QuickAction[] = [
		{ label: 'Open a file', keys: ['Ctrl', 'O'] },
		{ label: 'Switch tab', keys: ['Ctrl', 'Tab'] },
		{ label: 'Save file', keys: ['Ctrl', 'S'] }
	];

	// ── Public API ────────────────────────────────────────────────────────────
	//
	// `actions` is spread first. All named properties below that have the same
	// key as an action entry take precedence — this is intentional.
	//
	// `actions.shutdown` is the authoritative shutdown: it drains autoSaver,
	// then drains fileWriter, then calls editor.destroy() (the runtime).
	// Do NOT expose editor.destroy() as shutdown — that skips the drain.

	return {
		// All editor actions (openFile, closeTab, shutdown, etc.)
		...actions,

		// Hook surface — hoisted so Editor.svelte doesn't need to know about the hook
		initializeEditor: editor.initializeEditor,
		syncAfterActivePathChange: editor.syncAfterActivePathChange,

		// Reactive error/loading state from the hook
		get editorRuntimeError() {
			return editor.editorRuntimeError;
		},
		get initializingEditor() {
			return editor.initializingEditor;
		},

		// Derived UI state
		...derived,
		quickActions,

		// Services exposed for template bindings
		autoSaver,
		fileWriter,
		mountShortcuts
	};
}
