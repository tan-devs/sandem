import type * as Monaco from 'monaco-editor';
import { getLanguage } from '$lib/utils/ide/language.js';
import type { PROJECT } from '$types/projects.js';
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
	project: PROJECT;
	instance: typeof Monaco;
	bindings: Map<string, ModelBinding>;
	toWebPath: EditorRuntimeDependencies['toWebPath'];
};

export function createOfflineModels({ project, instance, bindings, toWebPath }: SeedOfflineParams) {
	const projectFiles = project.files ?? [];
	for (const file of projectFiles) {
		const fullPath = toWebPath(file.name);
		const model = instance.editor.createModel(file.contents ?? '', getLanguage(fullPath));
		bindings.set(fullPath, { model, destroy: () => model.dispose() });
	}
}

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

export function destroyModelBindings(bindings: Map<string, ModelBinding>) {
	bindings.forEach((binding) => binding.destroy());
	bindings.clear();
}
