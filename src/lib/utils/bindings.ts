import type * as Monaco from 'monaco-editor';
import { getLanguage } from '$lib/utils/ide/language.js';
import type { PROJECT_WITH_FILES } from '$types/projects.js';
import type { EditorRuntimeDependencies } from '$types/hooks.js';

export interface ModelBinding {
	model: Monaco.editor.ITextModel;
	destroy: () => void;
}

type SwapModelParams = {
	path: string;
	instance: typeof Monaco;
	editor: Monaco.editor.IStandaloneCodeEditor;
	bindings: Map<string, ModelBinding>;
	readFile: EditorRuntimeDependencies['readFile'];
};

type SeedOfflineParams = {
	project: PROJECT_WITH_FILES;
	instance: typeof Monaco;
	bindings: Map<string, ModelBinding>;
	toWebPath: EditorRuntimeDependencies['toWebPath'];
};

/**
 * Populates the bindings map with one Monaco model per project file.
 * Used in offline (non-collaborative) mode where Yjs is not involved.
 * Models are seeded with file contents immediately.
 */
export function createOfflineModels({ project, instance, bindings, toWebPath }: SeedOfflineParams) {
	const projectFiles = project.files ?? [];
	for (const file of projectFiles) {
		const fullPath = toWebPath(file.name);
		const model = instance.editor.createModel(file.contents ?? '', getLanguage(fullPath));
		bindings.set(fullPath, { model, destroy: () => model.dispose() });
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
}: SwapModelParams) {
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
	bindings.forEach((binding) => binding.destroy());
	bindings.clear();
}
