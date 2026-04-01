import * as Y from 'yjs';
import type * as Monaco from 'monaco-editor';
import type { Project } from '$lib/context';
import type { EditorRuntimeDependencies } from '$types/hooks.js';
import { createMonacoInstance, MONACO_OPTIONS } from '$lib/services/editor';
import {
	type ModelBinding,
	createOfflineModels,
	createModelForPath,
	destroyModelBindings
} from '$lib/utils';
import { seedPersistSignatures, diffYDocFiles } from '$lib/utils';
import { startCollaborationSession, type CollaborationSession } from '$lib/services/collaboration';

/**
 * Monaco + Yjs runtime service.
 *
 * Pure runtime concern — no lifecycle state, no error reporting, no
 * reactive state. Owned and wrapped by useEditor (the hook) which adds
 * all the Svelte-reactive error/loading layer on top.
 *
 * File: createEditor.svelte.ts → function: createEditor
 */
export function createEditor(deps: EditorRuntimeDependencies) {
	let editor: Monaco.editor.IStandaloneCodeEditor | undefined;
	let instance: typeof Monaco | undefined;

	let session: CollaborationSession | null | undefined;
	let ydoc: Y.Doc | undefined;
	let persistTimer: ReturnType<typeof setTimeout> | undefined;
	const lastPersistedByFile = new Map<string, string>();
	let persistFlushCount = 0;
	let persistedFileCount = 0;

	let synced = false;
	const seededPaths = new Set<string>();
	const bindings = new Map<string, ModelBinding>();
	const editorDisposables: Monaco.IDisposable[] = [];

	// ── Disposable management ─────────────────────────────────────────────────

	function registerDisposable(disposable: Monaco.IDisposable | undefined) {
		if (!disposable) return;
		editorDisposables.push(disposable);
	}

	function disposeAll() {
		while (editorDisposables.length > 0) {
			try {
				editorDisposables.pop()?.dispose();
			} catch {
				// Ignore teardown errors — editor may already be gone.
			}
		}
	}

	// ── Editor helpers ────────────────────────────────────────────────────────

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

	// ── Yjs seeding ───────────────────────────────────────────────────────────

	function seedYDocFromNodes() {
		if (!ydoc) return;
		const project = deps.getProject() as Project;
		const nodes = project?.nodes ?? [];

		ydoc.transact(() => {
			for (const node of nodes) {
				if (node.type !== 'file') continue;
				if (seededPaths.has(node.path)) continue;
				const ytext = ydoc!.getText(node.path);
				if (ytext.length === 0 && node.content) ytext.insert(0, node.content);
				seededPaths.add(node.path);
			}
		}, 'seed');
	}

	// ── Persistence ───────────────────────────────────────────────────────────

	function schedulePersist(nextYDoc: Y.Doc) {
		clearTimeout(persistTimer);
		persistTimer = setTimeout(() => {
			const project = deps.getProject() as Project;
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

	// ── Collaboration setup ───────────────────────────────────────────────────

	async function setupCollaborativeModels() {
		if (!instance || !editor) return;
		const project = deps.getProject() as Project | undefined;

		if (!project?.room) return;

		session = await startCollaborationSession({
			project,
			editor,
			instance,
			bindings,
			toWebPath: deps.toWebPath,
			seedProjectFromConvex: () => {
				if (synced) return;
				synced = true;
				seedYDocFromNodes();
				seedPersistSignatures(ydoc ?? session!.ydoc, project, lastPersistedByFile);
			},
			onYDocUpdate: (nextYDoc: Y.Doc, origin: unknown) => {
				if (!synced || origin === 'seed') return;
				schedulePersist(nextYDoc);
			}
		});

		if (!session) return;
		ydoc = session.ydoc;
		syncActiveEditorModel();
		deps.onStatusSync();
	}

	// ── Offline setup ─────────────────────────────────────────────────────────

	function setupOfflineModels() {
		if (!instance || !editor) return;
		const project = deps.getProject();
		if (!project) return;

		createOfflineModels({ project, instance, bindings, toWebPath: deps.toWebPath });
		syncActiveEditorModel();
		deps.onStatusSync();

		registerDisposable(
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

	// ── Status listeners ──────────────────────────────────────────────────────

	function setupStatusListeners() {
		if (!editor) return;
		registerDisposable(editor.onDidChangeCursorPosition(() => deps.onStatusSync()));
		registerDisposable(editor.onDidChangeModel(() => deps.onStatusSync()));
	}

	// ── Lifecycle ─────────────────────────────────────────────────────────────

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

	function destroy() {
		clearTimeout(persistTimer);
		lastPersistedByFile.clear();
		persistFlushCount = 0;
		persistedFileCount = 0;
		disposeAll();
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

	return { initialize, getEditor, syncActiveEditorModel, destroy };
}
