import * as Y from 'yjs';
import { LiveblocksYjsProvider } from '@liveblocks/yjs';
import type * as Monaco from 'monaco-editor';
import type { Awareness } from 'y-protocols/awareness.js';
import { getLanguage } from '$lib/utils/ide/language.js';
import type { EditorRuntimeDependencies } from '$types/hooks.js';
import type { ModelBinding } from '$lib/utils';

export type BindingsContext = {
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
 * For each file:
 *   1. Resolves the web path via `toWebPath`.
 *   2. Gets (or creates) the corresponding Yjs text type.
 *   3. Creates a Monaco model with the correct language.
 *   4. Binds them together with `MonacoBinding`.
 *   5. Registers the binding in the shared `bindings` map so the editor
 *      controller can switch models.
 *
 * Injected: `BindingsContext` — all dependencies explicit, no module singletons.
 * Returns `dispose` — destroys all bindings and disposes models.
 *
 * Note: `MonacoBinding` is loaded dynamically because `y-monaco` must run
 * client-side only; this function is therefore async.
 */
export async function createCollaborationBindings(
	ctx: BindingsContext
): Promise<{ dispose: () => void }> {
	const { MonacoBinding } = await import('y-monaco');
	const cleanups: Array<() => void> = [];

	for (const file of ctx.files) {
		const fullPath = ctx.toWebPath(file.name);
		const ytext = ctx.ydoc.getText(file.name);
		const model = ctx.instance.editor.createModel('', getLanguage(fullPath));

		const monacoBinding = new MonacoBinding(
			ytext,
			model,
			new Set([ctx.editor]),
			ctx.provider.awareness as unknown as Awareness
		);

		ctx.bindings.set(fullPath, {
			model,
			destroy: () => {
				monacoBinding.destroy();
				model.dispose();
			}
		});

		cleanups.push(() => {
			const binding = ctx.bindings.get(fullPath);
			if (binding) {
				binding.destroy();
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
