import type * as Monaco from 'monaco-editor';
import { getLanguage } from '$lib/utils/ide/language.js';
import type { Project } from '$lib/context/webcontainer/ide-context.js';
import type { EditorRuntimeDependencies } from '$types/hooks.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ModelBinding {
	model: Monaco.editor.ITextModel;
	destroy: () => void;
}

type CreateOfflineModelsParams = {
	project: Project;
	instance: typeof Monaco;
	bindings: Map<string, ModelBinding>;
	toWebPath: EditorRuntimeDependencies['toWebPath'];
};

type CreateModelForPathParams = {
	path: string;
	instance: typeof Monaco;
	editor: Monaco.editor.IStandaloneCodeEditor;
	bindings: Map<string, ModelBinding>;
	readFile: EditorRuntimeDependencies['readFile'];
};

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Populates the bindings map with one Monaco model per file node.
 * Used in offline (non-collaborative) mode where Yjs is not involved.
 * Models are seeded with node content immediately.
 *
 * Only file-type nodes are processed — folder nodes carry no content.
 * Node paths (e.g. "/src/App.tsx") are resolved to WebContainer paths
 * via `toWebPath` before being used as binding keys.
 */
export function createOfflineModels({
	project,
	instance,
	bindings,
	toWebPath
}: CreateOfflineModelsParams) {
	for (const node of project.nodes) {
		if (node.type !== 'file') continue;
		const wcPath = toWebPath(node.path);
		const model = instance.editor.createModel(node.content ?? '', getLanguage(wcPath));
		bindings.set(wcPath, { model, destroy: () => model.dispose() });
	}
}

/**
 * Ensures a Monaco model exists for `path` and sets it as the active editor
 * model. If the model is new, file content is loaded asynchronously via
 * `readFile` and applied once available.
 */
export function createModelForPath({
	path,
	instance,
	editor,
	bindings,
	readFile
}: CreateModelForPathParams) {
	let binding = bindings.get(path);

	if (!binding) {
		const model = instance.editor.createModel('', getLanguage(path));
		binding = { model, destroy: () => model.dispose() };
		bindings.set(path, binding);

		void readFile(path).then((content) => {
			binding!.model.setValue(content);
		});
	}

	if (editor.getModel() !== binding.model) {
		editor.setModel(binding.model);
	}
}

/**
 * Destroys every binding in the map and clears it.
 * Called during editor cleanup / session teardown.
 */
export function destroyModelBindings(bindings: Map<string, ModelBinding>) {
	bindings.forEach((b) => b.destroy());
	bindings.clear();
}
