<script lang="ts">
	import loader from '@monaco-editor/loader';
	import { client } from '$lib/liveblocks.config.js';
	import { onMount, onDestroy, untrack } from 'svelte';
	import * as Y from 'yjs';
	import { MonacoBinding } from 'y-monaco';
	import { LiveblocksYjsProvider } from '@liveblocks/yjs';
	import type * as Monaco from 'monaco-editor';

	import { requireIDEContext } from '$lib/context/ide-context.js';
	import { createAutoSaver } from '$lib/hooks/createAutoSaver.svelte.js';
	import { createFileWriter } from '$lib/hooks/createFileWriter.svelte.js';
	import { getLanguage } from '$lib/utils/language.js';
	import type { Awareness } from 'y-protocols/awareness.js';

	interface MONACO {
		model: Monaco.editor.ITextModel;
		destroy: () => void;
	}

	// requireIDEContext throws immediately if context is missing,
	// giving a clear error rather than a silent null-access crash.
	const ide = requireIDEContext();
	let project = $derived(ide.getProject());
	let files = $derived(project.files.map((f) => f.name));

	let element: HTMLDivElement;
	let editor: Monaco.editor.IStandaloneCodeEditor;
	let instance: typeof Monaco;

	let activeFile = $state(untrack(() => project.files[0].name));

	const autoSaver = createAutoSaver(() => project);
	const { writeFile } = createFileWriter(ide.getWebcontainer);

	let provider: LiveblocksYjsProvider;
	let ydoc: Y.Doc;
	let bindings: Map<string, MONACO> = new Map();
	let leaveRoom: () => void;

	// Track whether the Yjs provider has finished its initial sync so we
	// don't trigger auto-saves from the initial hydration writes.
	let synced = false;

	// Per-file flag: has this file been seeded into Yjs yet this session?
	const seeds = new Set<string>();

	onMount(async () => {
		const rawLoader = loader as unknown as { init: () => Promise<typeof Monaco> };
		instance = await rawLoader.init();

		editor = instance.editor.create(element, {
			theme: 'vs-dark',
			automaticLayout: true,
			minimap: { enabled: true },
			fontSize: 14,
			padding: { top: 10 }
		});

		if (!project.room) {
			offlineModel();
			return;
		}

		const { room, leave } = client.enterRoom(project.room, {
			initialPresence: { cursor: null }
		});
		leaveRoom = leave;

		ydoc = new Y.Doc();
		provider = new LiveblocksYjsProvider(room, ydoc);

		provider.on('sync', (isSynced: boolean) => {
			if (!isSynced || synced) return;
			synced = true;
			semination();
		});

		for (const file of project.files) {
			const ytext = ydoc.getText(file.name);
			const model = instance.editor.createModel('', getLanguage(file.name));
			const binding = new MonacoBinding(
				ytext,
				model,
				new Set([editor]),
				provider.awareness as unknown as Awareness
			);
			bindings.set(file.name, {
				model: model,
				destroy: () => binding.destroy()
			});
		}

		swap(activeFile);

		ydoc.on('update', (_update: Uint8Array, origin: unknown) => {
			if (!synced) return;
			if (origin !== null) return; // remote change — skip
			const content = ydoc.getText(activeFile).toString();
			autoSaver.triggerAutoSave(activeFile, content);
			writeFile(activeFile, content);
		});
	});

	function semination() {
		ydoc.transact(() => {
			for (const file of project.files) {
				if (seeds.has(file.name)) continue;
				const ytext = ydoc.getText(file.name);
				if (ytext.length === 0 && file.contents) {
					ytext.insert(0, file.contents);
				}
				seeds.add(file.name);
			}
		}, 'seed'); // 'seed' origin is ignored by the update listener
	}

	function offlineModel() {
		for (const file of project.files) {
			const model = instance.editor.createModel(file.contents ?? '', getLanguage(file.name));
			bindings.set(file.name, { model: model, destroy: () => model.dispose() });
		}
		swap(activeFile);

		editor.onDidChangeModelContent(() => {
			const content = editor.getValue();
			autoSaver.triggerAutoSave(activeFile, content);
			writeFile(activeFile, content);
		});
	}

	function swap(fileName: string) {
		if (!editor) return;
		const binding = bindings.get(fileName);
		if (!binding) return;
		if (editor.getModel() !== binding.model) {
			editor.setModel(binding.model);
		}
	}

	$effect(() => {
		swap(activeFile);
	});

	onDestroy(() => {
		autoSaver.cleanup();
		bindings.forEach((b) => b.destroy?.());
		provider?.destroy();
		leaveRoom?.();
		editor?.dispose();
	});
</script>

<div class="editor-layout">
	<div class="tabs-header">
		<div class="tabs">
			{#each files as file}
				<button class="tab" class:active={activeFile === file} onclick={() => (activeFile = file)}>
					{file}
				</button>
			{/each}
		</div>
		<div class="actions">
			<span class="save-status">{autoSaver.status}</span>
		</div>
	</div>
	<div class="editor-container" bind:this={element}></div>
</div>

<style>
	.editor-layout {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--bg);
	}
	.tabs-header {
		display: flex;
		justify-content: space-between;
		background: var(--fg);
		border-bottom: 1px solid var(--border);
	}
	.tabs {
		display: flex;
	}
	.tab {
		padding: 8px 16px;
		border: none;
		background: transparent;
		color: var(--muted);
		cursor: pointer;
		font-size: 12px;
		font-family: var(--fonts-mono);
		border-right: 1px solid var(--border);
		transition:
			background-color var(--time) var(--ease),
			color var(--time) var(--ease);
	}
	.tab:hover:not(.active) {
		background: var(--mg);
		color: var(--text);
	}
	.tab.active {
		background: var(--bg);
		color: var(--text);
		border-top: 2px solid var(--accent);
	}
	.save-status {
		font-size: 11px;
		color: var(--muted);
		padding-right: 12px;
		align-self: center;
	}
	.editor-container {
		flex: 1;
	}
</style>
