import * as Y from 'yjs';
import { LiveblocksYjsProvider } from '@liveblocks/yjs';
import type * as Monaco from 'monaco-editor';
import type { Awareness } from 'y-protocols/awareness.js';
import { getLanguage } from '$lib/utils/ide/language.js';
import type { EditorRuntimeDependencies } from '$types/hooks.js';
import type { ModelBinding } from '$lib/utils';

export type ModelBindingsContext = {
	files: Array<{ name: string; contents: string }>;
	ydoc: Y.Doc;
	provider: LiveblocksYjsProvider;
	editor: Monaco.editor.IStandaloneCodeEditor;
	instance: typeof Monaco;
	bindings: Map<string, ModelBinding>;
	toWebPath: EditorRuntimeDependencies['toWebPath'];
};

/**
 * Creates Monaco ↔ Yjs bindings for every file in the project.
 *
 * For each file: resolves the web path, gets the Yjs text type, creates a
 * Monaco model, and binds them with MonacoBinding. Registers each binding in
 * the shared `bindings` map so the editor can switch active models.
 *
 * `MonacoBinding` is loaded dynamically — `y-monaco` must run client-side only.
 * Returns `dispose` — destroys all bindings and clears the map entries.
 */
export async function bindEditorModels(
	ctx: ModelBindingsContext
): Promise<{ dispose: () => void }> {
	const { MonacoBinding } = await import('y-monaco');
	const cleanups: Array<() => void> = [];

	for (const file of ctx.files) {
		const fullPath = ctx.toWebPath(file.name);
		const ytext = ctx.ydoc.getText(file.name);
		const model = ctx.instance.editor.createModel('', getLanguage(fullPath));

		const binding = new MonacoBinding(
			ytext,
			model,
			new Set([ctx.editor]),
			ctx.provider.awareness as unknown as Awareness
		);

		ctx.bindings.set(fullPath, {
			model,
			destroy: () => {
				binding.destroy();
				model.dispose();
			}
		});

		cleanups.push(() => {
			const b = ctx.bindings.get(fullPath);
			if (b) {
				b.destroy();
				ctx.bindings.delete(fullPath);
			}
		});
	}

	return {
		dispose() {
			for (const cleanup of cleanups) cleanup();
		}
	};
}
