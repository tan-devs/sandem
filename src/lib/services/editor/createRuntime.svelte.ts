import * as Y from 'yjs';
import type * as Monaco from 'monaco-editor';
import type { PROJECT_WITH_FILES } from '$types/projects.js';
import type { EditorRuntimeDependencies } from '$types/hooks.js';
import { createMonacoInstance, MONACO_OPTIONS } from '$lib/services/editor'; // ← or '$lib/services/editor/collaboration' if you prefer explicit
import {
	type ModelBinding,
	createOfflineModels,
	createModelForPath,
	destroyModelBindings
} from '$lib/utils';
import { seedPersistSignatures, diffYDocFiles } from '$lib/utils';

import {
	startCollaborationSession, // ← was createCollaboration
	type CollaborationSession
} from '$lib/services/collaboration';

export function createEditorRuntime(deps: EditorRuntimeDependencies) {
	let editor: Monaco.editor.IStandaloneCodeEditor | undefined;
	let instance: typeof Monaco | undefined;

	let session: CollaborationSession | null | undefined;
	let ydoc: Y.Doc | undefined;
	let persistTimer: ReturnType<typeof setTimeout> | undefined;
	const lastPersistedByFile = new Map<string, string>();
	let persistFlushCount = 0;
	let persistedFileCount = 0;

	let synced = false;
	const seeds = new Set<string>();
	const bindings = new Map<string, ModelBinding>();
	const editorDisposables: Monaco.IDisposable[] = [];

	function registerEditorDisposable(disposable: Monaco.IDisposable | undefined) {
		if (!disposable) return;
		editorDisposables.push(disposable);
	}

	function disposeEditorDisposables() {
		while (editorDisposables.length > 0) {
			const disposable = editorDisposables.pop();
			try {
				disposable?.dispose();
			} catch {
				/* ignore teardown errors */
			}
		}
	}

	function getEditor() {
		return editor;
	}

	function syncActiveEditorModel() {
		if (!editor || !instance) return;
		const activePath = deps.getActivePath();
		if (!activePath) {
			editor.setModel(null);
			return;
		}
		createModelForPath({ path: activePath, instance, editor, bindings, readFile: deps.readFile });
	}

	function seedProjectFromConvex() {
		if (!ydoc) return;
		const project = deps.getProject() as PROJECT_WITH_FILES;
		const projectFiles = project?.files ?? [];

		ydoc.transact(() => {
			for (const file of projectFiles) {
				if (seeds.has(file.name)) continue;
				const ytext = ydoc!.getText(file.name);
				if (ytext.length === 0 && file.contents) ytext.insert(0, file.contents);
				seeds.add(file.name);
			}
		}, 'seed');
	}

	function scheduleChangedFilesPersist(nextYDoc: Y.Doc) {
		clearTimeout(persistTimer);
		persistTimer = setTimeout(() => {
			const project = deps.getProject() as PROJECT_WITH_FILES;
			const metrics = diffYDocFiles(nextYDoc, project, lastPersistedByFile, deps.toWebPath);

			if (metrics.payloads.length > 0) {
				if (deps.onPersistBatch) {
					deps.onPersistBatch(metrics.payloads);
				} else {
					for (const payload of metrics.payloads) deps.onPersist(payload);
				}
			}

			persistFlushCount += 1;
			persistedFileCount += metrics.changedFiles;

			if (
				typeof window !== 'undefined' &&
				window.localStorage.getItem('sandem.debug.editor') === '1'
			) {
				console.debug('[EditorPersist]', {
					flush: persistFlushCount,
					changedFiles: metrics.changedFiles,
					totalFiles: metrics.totalFiles,
					persistedFileCount
				});
			}
		}, 900);
	}

	async function setupCollaborativeModels() {
		if (!instance || !editor) return;
		const project = deps.getProject() as PROJECT_WITH_FILES;
		if (!project?.room) return;

		session = await startCollaborationSession({
			// ← was createCollaboration
			project,
			editor,
			instance,
			bindings,
			toWebPath: deps.toWebPath,
			seedProjectFromConvex: () => {
				if (synced) return;
				synced = true;
				seedProjectFromConvex();
				seedPersistSignatures(ydoc ?? session!.ydoc, project, lastPersistedByFile);
			},
			onYDocUpdate: (nextYDoc: Y.Doc, origin: unknown) => {
				if (!synced || origin === 'seed') return;
				scheduleChangedFilesPersist(nextYDoc);
			}
		});

		if (!session) return;
		ydoc = session.ydoc;
		syncActiveEditorModel();
		deps.onStatusSync();
	}

	function setupOfflineModels() {
		if (!instance || !editor) return;
		const project = deps.getProject() as PROJECT_WITH_FILES;

		createOfflineModels({ project, instance, bindings, toWebPath: deps.toWebPath });
		syncActiveEditorModel();
		deps.onStatusSync();

		registerEditorDisposable(
			editor.onDidChangeModelContent(() => {
				const activePath = deps.getActivePath();
				if (!activePath || !editor) return;
				deps.onStatusSync();
				deps.onPersist({
					activePath,
					projectFileName: deps.toProjectFile(activePath),
					content: editor.getValue()
				});
			})
		);
	}

	function setupStatusListeners() {
		if (!editor) return;
		registerEditorDisposable(editor.onDidChangeCursorPosition(() => deps.onStatusSync()));
		registerEditorDisposable(editor.onDidChangeModel(() => deps.onStatusSync()));
	}

	async function initialize(element: HTMLDivElement) {
		instance = await createMonacoInstance();
		if (!instance) throw new Error('Monaco failed to initialize.');

		editor = instance.editor.create(element, MONACO_OPTIONS);
		setupStatusListeners();

		if (!deps.getProject()?.room) {
			setupOfflineModels();
			deps.onStatusSync();
			return;
		}

		await setupCollaborativeModels();
	}

	function cleanup() {
		clearTimeout(persistTimer);
		lastPersistedByFile.clear();
		persistFlushCount = 0;
		persistedFileCount = 0;
		disposeEditorDisposables();
		destroyModelBindings(bindings);
		session?.dispose();
		session?.provider.destroy();
		session?.leaveRoom();
		session = null;
		ydoc = undefined;
		editor?.dispose();
		editor = undefined;
		instance = undefined;
	}

	return { initialize, getEditor, syncActiveEditorModel, cleanup };
}
