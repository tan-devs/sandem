import type * as Monaco from 'monaco-editor';
import { createErrorReporter } from '$lib/sveltekit/index.js';

// ---------------------------------------------------------------------------
// Dependency types — structural so no circular imports are needed.
// ---------------------------------------------------------------------------

type EditorRuntime = {
	initialize: (element: HTMLDivElement) => Promise<void>;
	destroy: () => void;
	syncActiveEditorModel: () => void;
	getEditor: () => Monaco.editor.IStandaloneCodeEditor | undefined;
};

type EditorStatus = {
	syncFromEditor: (editor: Monaco.editor.IStandaloneCodeEditor | undefined) => void;
};

/**
 * Svelte 5 hook that wraps the editor runtime with reactive lifecycle state.
 *
 * Analogous to a React hook:
 *   - Holds $state (editorRuntimeError, editorReady, initializingEditor)
 *   - Receives injected dependencies — never imports singletons
 *   - Returns a reactive API via getters
 *
 * Layer contract:
 *   - ABOVE this: EditorController wires dependencies and exposes the result
 *   - BELOW this: createEditor (the runtime service) — no reactive state
 *
 * Usage:
 *   const editor = useEditor({ runtime: createEditor(deps), status: createEditorStatus(store) });
 *   await editor.initializeEditor(element);   // call from onMount
 *   editor.syncAfterActivePathChange();        // call from $effect on activeTabPath
 *   editor.destroy();                          // call from onDestroy
 */
export function useEditor(deps: { runtime: EditorRuntime; status: EditorStatus }) {
	// ── Reactive state ────────────────────────────────────────────────────────
	// These are the hook's owned state — analogous to React's useState calls.

	let editorRuntimeError = $state<string | null>(null);
	let editorReady = $state(false);
	let initializingEditor = $state(false);

	const reportEditorError = createErrorReporter((next) => {
		editorRuntimeError = next;
	});

	// ── Internal helpers ──────────────────────────────────────────────────────

	function syncStatus() {
		deps.status.syncFromEditor(deps.runtime.getEditor());
	}

	// ── Public methods ────────────────────────────────────────────────────────

	/**
	 * Boot or re-boot the editor into `element`.
	 *
	 * Guards against concurrent calls — safe to call from retry buttons.
	 * Always calls runtime.destroy() first so re-initialisation is clean.
	 */
	async function initializeEditor(element: HTMLDivElement | undefined) {
		if (!element || initializingEditor) return;
		initializingEditor = true;
		editorRuntimeError = null;

		try {
			deps.runtime.destroy();
			await deps.runtime.initialize(element);
			syncStatus();
			editorReady = true;
		} catch (error) {
			reportEditorError('Failed to initialize the editor runtime.', error);
			editorReady = false;
		} finally {
			initializingEditor = false;
		}
	}

	/**
	 * Swap the active Monaco model to match the newly active tab path.
	 *
	 * Called by Editor.svelte's $effect whenever activeTabPath changes.
	 * No-ops silently when the editor is not ready or has an error.
	 */
	function syncAfterActivePathChange() {
		if (!editorReady || editorRuntimeError) return;
		try {
			deps.runtime.syncActiveEditorModel();
			syncStatus();
		} catch (error) {
			reportEditorError('Failed to synchronize the active editor model.', error);
			editorReady = false;
		}
	}

	/**
	 * Tear down the Monaco instance. Called by EditorController.shutdown()
	 * after saves have been drained — do not call directly from components.
	 */
	function destroy() {
		try {
			deps.runtime.destroy();
		} catch {
			// Ignore cleanup errors during unmount.
		}
	}

	// ── Reactive API ──────────────────────────────────────────────────────────

	return {
		get editorRuntimeError() {
			return editorRuntimeError;
		},
		get editorReady() {
			return editorReady;
		},
		get initializingEditor() {
			return initializingEditor;
		},
		initializeEditor,
		syncAfterActivePathChange,
		destroy
	};
}
