import type * as Monaco from 'monaco-editor';
import { createErrorReporter } from '$lib/sveltekit/index.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EditorRuntime = {
	initialize: (element: HTMLDivElement) => Promise<void>;
	/** Tears down the editor instance and releases all resources. */
	destroy: () => void;
	syncActiveEditorModel: () => void;
	getEditor: () => Monaco.editor.IStandaloneCodeEditor | undefined;
};

type EditorStatus = {
	syncFromEditor: (editor: Monaco.editor.IStandaloneCodeEditor | undefined) => void;
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Composes the editor initialization + teardown lifecycle.
 * Lives in hooks/ because it is pure lifecycle composition with no
 * runtime or persistence concerns.
 */
export function useEditor(options: { runtime: EditorRuntime; status: EditorStatus }) {
	let editorRuntimeError = $state<string | null>(null);
	let editorReady = $state(false);
	let initializingEditor = $state(false);

	const reportEditorError = createErrorReporter((next) => {
		editorRuntimeError = next;
	});

	function syncEditorStatusFromModel() {
		options.status.syncFromEditor(options.runtime.getEditor());
	}

	function syncActiveEditorModel() {
		options.runtime.syncActiveEditorModel();
	}

	async function initializeEditor(element: HTMLDivElement | undefined) {
		if (!element || initializingEditor) return;
		initializingEditor = true;
		editorRuntimeError = null;

		try {
			options.runtime.destroy();
			await options.runtime.initialize(element);
			syncEditorStatusFromModel();
			editorReady = true;
		} catch (error) {
			reportEditorError('Failed to initialize the editor runtime.', error);
			editorReady = false;
		} finally {
			initializingEditor = false;
		}
	}

	function syncAfterActivePathChange() {
		if (!editorReady || editorRuntimeError) return;

		try {
			syncActiveEditorModel();
			syncEditorStatusFromModel();
		} catch (error) {
			reportEditorError('Failed to synchronize the active editor model.', error);
			editorReady = false;
		}
	}

	function destroy() {
		try {
			options.runtime.destroy();
		} catch {
			// Ignore cleanup errors during unmount.
		}
	}

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
		syncEditorStatusFromModel,
		initializeEditor,
		syncAfterActivePathChange,
		destroy
	};
}
