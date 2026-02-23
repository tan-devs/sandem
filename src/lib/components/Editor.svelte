<script lang="ts">
	import { Awareness } from 'y-protocols/awareness';
	import { onMount } from 'svelte';
	import { createClient } from '@liveblocks/client';
	import { getYjsProviderForRoom } from '@liveblocks/yjs';

	// Convex imports
	import { useConvexClient } from 'convex-svelte';
	import { api } from '$convex/_generated/api.js';

	// Monaco Workers
	import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
	import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';
	import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
	import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';

	// --- Import Template and Types ---
	import { VITE_REACT_TEMPLATE, type CodeFile } from '$lib/templates.js';
	import type { Id } from '$convex/_generated/dataModel.js';

	const convexClient = useConvexClient();
	const client = createClient({
		authEndpoint: '/api/liveblocks-auth'
	});

	// --- 2. Svelte 5 Reactive State ---
	let element: HTMLDivElement | undefined = $state();
	let activeFile: string = $state(VITE_REACT_TEMPLATE.entry);
	let editor: import('monaco-editor').editor.IStandaloneCodeEditor | null = $state(null);
	let models: Record<string, import('monaco-editor').editor.ITextModel> = {};
	let isSaving: boolean = $state(false);

	// webcontainer prop
	let { webcontainer }: { webcontainer: import('@webcontainer/api').WebContainer } = $props();

	const roomId = 'my-room';

	function getLanguage(fileName: string): string {
		if (fileName.endsWith('.jsx') || fileName.endsWith('.js')) return 'javascript';
		if (fileName.endsWith('.html')) return 'html';
		if (fileName.endsWith('.json')) return 'json';
		return 'plaintext';
	}

	// Handle saving the current template to the Convex database
	async function handleSaveToConvex() {
		isSaving = true;
		try {
			const filesArray = Object.entries(VITE_REACT_TEMPLATE.files).map(([name, file]) => ({
				name: name,
				contents: (file as CodeFile).contents
			}));

			// FIXED: Changed reactTemplate to VITE_REACT_TEMPLATE
			const newProjectId = await convexClient.mutation(api.projects.createProject, {
				title: 'React Vite Starter',
				entry: VITE_REACT_TEMPLATE.entry,
				visibleFiles: VITE_REACT_TEMPLATE.visibleFiles,
				files: filesArray
			});

			alert(`Success! Project saved with ID: ${newProjectId}`);
		} catch (error) {
			console.error('Failed to save to Convex:', error);
			alert('Failed to save. Check your console!');
		} finally {
			isSaving = false;
		}
	}

	// --- WebContainer helpers ---
	async function mountFiles() {
		// Map templates.ts files to WebContainer format
		const wcFiles = Object.fromEntries(
			Object.entries(VITE_REACT_TEMPLATE.files).map(([name, file]) => [
				name,
				{ file: { contents: (file as CodeFile).contents } }
			])
		);
		await webcontainer.mount(wcFiles);
	}

	onMount(() => {
		let isDestroyed = false;
		let bindings: import('y-monaco').MonacoBinding[] = [];
		let leaveRoom: () => void;

		// boot the webcontainer by mounting files only
		mountFiles();

		self.MonacoEnvironment = {
			getWorker: function (_moduleId: Id, label: string) {
				if (label === 'typescript' || label === 'javascript') return new tsWorker();
				if (label === 'json') return new jsonWorker();
				if (label === 'html') return new htmlWorker();
				return new editorWorker();
			}
		};

		const initEditor = async () => {
			if (!element) return;

			const monaco = await import('monaco-editor');
			const { MonacoBinding } = await import('y-monaco');

			if (isDestroyed) return;

			const { room, leave } = client.enterRoom(roomId);
			leaveRoom = leave;

			const yProvider = getYjsProviderForRoom(room);
			const yDoc = yProvider.getYDoc();

			editor = monaco.editor.create(element, {
				theme: 'vs-dark',
				automaticLayout: true
			});

			// --- 3. Setup Multiple Models ---
			for (const fileName of VITE_REACT_TEMPLATE.visibleFiles) {
				const language = getLanguage(fileName);

				// Create Monaco model as EMPTY initially! Let Yjs act as the source of truth.
				const model = monaco.editor.createModel(
					'',
					language,
					monaco.Uri.parse(`file:///${fileName}`)
				);
				models[fileName] = model;

				const yText = yDoc.getText(fileName);

				const binding = new MonacoBinding(
					yText,
					model,
					new Set([editor]),
					yProvider.awareness as unknown as Awareness
				);
				bindings.push(binding);
			}

			// Mount the default entry file to start
			editor.setModel(models[activeFile]);

			// --- 4. Safely populate Default Data ---
			yProvider.on('sync', (isSynced: boolean) => {
				if (isSynced) {
					for (const fileName of VITE_REACT_TEMPLATE.visibleFiles) {
						const yText = yDoc.getText(fileName);

						// If the Yjs text is completely empty, it means this room is brand new.
						if (yText.length === 0) {
							yText.insert(0, VITE_REACT_TEMPLATE.files[fileName].contents);
						}
					}
				}
			});
		};

		initEditor();

		return () => {
			isDestroyed = true;
			bindings.forEach((b) => b.destroy());
			Object.values(models).forEach((m) => m.dispose());
			if (editor) editor.dispose();
			if (leaveRoom) leaveRoom();
		};
	});

	$effect(() => {
		if (editor && models[activeFile]) {
			editor.setModel(models[activeFile]);
		}
	});
</script>

<div class="layout-container">
	<div class="editor-shell">
		<div class="tabs">
			{#each VITE_REACT_TEMPLATE.visibleFiles as fileName}
				<button
					class="tab"
					class:active={activeFile === fileName}
					onclick={() => (activeFile = fileName)}
				>
					{fileName}
				</button>
			{/each}

			<button class="save-btn" onclick={handleSaveToConvex} disabled={isSaving}>
				{isSaving ? 'Saving...' : '💾 Save to Convex'}
			</button>
		</div>

		<div bind:this={element} class="monaco-container"></div>
	</div>
</div>

<style>
	/* Basic VS Code-like styling */
	.editor-shell {
		display: flex;
		flex-direction: column;
		height: 100vh;
		width: 100%;
		background-color: #1e1e1e;
		position: relative;
	}
	.tabs {
		display: flex;
		background-color: #2d2d2d;
		overflow-x: auto;
	}
	.tab {
		padding: 10px 16px;
		background: transparent;
		border: none;
		color: #969696;
		cursor: pointer;
		font-family:
			system-ui,
			-apple-system,
			sans-serif;
		font-size: 13px;
		border-right: 1px solid #1e1e1e;
		border-top: 2px solid transparent;
		transition: background-color 0.1s;
	}
	.tab:hover {
		background-color: #1e1e1e;
	}
	.tab.active {
		background-color: #1e1e1e;
		color: #ffffff;
		border-top: 2px solid #007acc; /* VS Code blue accent */
	}
	.save-btn {
		margin-left: auto;
		background-color: #007acc;
		color: white;
		border: none;
		padding: 0 16px;
		cursor: pointer;
		font-family:
			system-ui,
			-apple-system,
			sans-serif;
		font-size: 13px;
		font-weight: 500;
		transition: background-color 0.2s;
	}
	.save-btn:hover:not(:disabled) {
		background-color: #005f9e;
	}
	.save-btn:disabled {
		background-color: #555;
		cursor: not-allowed;
	}
	.monaco-container {
		flex: 1;
		width: 100%;
	}
</style>
