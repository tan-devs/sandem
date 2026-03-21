<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	import { requireIDEContext } from '$lib/context/ide/ide-context.js';
	import {
		createAutoSaver,
		createFileWriter,
		createEditorShortcuts,
		createEditorStatus,
		createEditorRuntime
	} from '$lib/hooks/editor/index.js';
	import {
		getRootFolder,
		resolveProjectFileName,
		toWebContainerPath
	} from '$lib/utils/project/filesystem.js';
	import Tabs from '$lib/components/ui/primitives/Tabs.svelte';
	import { editorStore } from '$lib/stores/editor/editorStore.svelte.js';
	import { activity } from '$lib/stores/activity/activityStore.svelte.js';
	import EmptyEditorState from '$lib/components/ui/editor/Empty.svelte';
	import EditorBreadcrumb from '$lib/components/ui/editor/Breadcrumbs.svelte';
	import EditorSaveStatus from '$lib/components/ui/editor/SaveStatus.svelte';
	import { getPanelsContext } from '$lib/stores/panel/panelStore.svelte.js';
	import { collaborationPermissionsStore } from '$lib/stores/collaboration/collaborationStore.svelte.js';

	const ide = requireIDEContext();
	const panels = getPanelsContext();

	let project = $derived(ide.getProject(editorStore.activeTabPath ?? undefined));
	const rootFolder = $derived(getRootFolder(editorStore.activeTabPath ?? ide.getEntryPath()));

	let element: HTMLDivElement;
	let canWrite = $state(true);
	const unsubscribePermissions = collaborationPermissionsStore.subscribe((value) => {
		canWrite = value.canWrite;
	});

	const autoSaver = createAutoSaver(() => project);
	const { writeFile } = createFileWriter(ide.getWebcontainer);
	const status = createEditorStatus(editorStore);
	const shortcuts = createEditorShortcuts({
		getPanels: () => panels,
		onOpenSearch: () => {
			activity.tab = 'search';
		},
		onToggleCommandPalette: () => {
			window.dispatchEvent(new CustomEvent('app:command-palette:toggle'));
		}
	});
	const runtime = createEditorRuntime({
		getProject: () => project,
		getActivePath: () => editorStore.activeTabPath,
		toProjectFile: (path) => toProjectFile(path),
		toWebPath: (projectFileName) => toWebPath(projectFileName),
		readFile: (path) => ide.getWebcontainer().fs.readFile(path, 'utf-8'),
		onPersist: ({ activePath, projectFileName, content }) => {
			if (!canWrite) return;
			autoSaver.triggerAutoSave(projectFileName, content);
			writeFile(activePath, content);
		},
		onStatusSync: () => syncEditorStatusFromModel()
	});

	function toProjectFile(path: string): string {
		return resolveProjectFileName(path, project.files);
	}

	function toWebPath(projectFileName: string): string {
		return toWebContainerPath(rootFolder, projectFileName);
	}

	function syncActiveEditorModel() {
		runtime.syncActiveEditorModel();
	}

	function syncEditorStatusFromModel() {
		status.syncFromEditor(runtime.getEditor());
	}

	onMount(() => {
		return shortcuts.mount();
	});

	onMount(async () => {
		await runtime.initialize(element);
		syncEditorStatusFromModel();
	});

	$effect(() => {
		// Reactive dependency on activeTabPath to trigger sync when it changes
		void editorStore.activeTabPath;
		syncActiveEditorModel();
		syncEditorStatusFromModel();
	});

	onDestroy(() => {
		unsubscribePermissions();
		autoSaver.cleanup();
		runtime.cleanup();
	});

	// Derive a nice save status label + variant
	const saveStatusVariant = $derived(
		autoSaver.status?.toLowerCase().includes('error')
			? 'error'
			: autoSaver.status?.toLowerCase().includes('saving')
				? 'saving'
				: autoSaver.status
					? 'saved'
					: ''
	);

	const showEmptyState = $derived(editorStore.tabs.length === 0 || !editorStore.activeTabPath);

	const tabs = $derived(
		editorStore.tabs.map((tab) => ({
			id: tab.path,
			label: tab.label,
			active: editorStore.isActive(tab.path),
			closable: true
		}))
	);

	const quickActions = [
		{ label: 'Focus Search', hint: 'Search files and symbols', keys: ['Ctrl', 'Alt', 'I'] },
		{ label: 'Show All Commands', hint: 'Open command palette', keys: ['Ctrl', 'Shift', 'P'] },
		{ label: 'Toggle Terminal', hint: 'Show or hide terminal panel', keys: ['Ctrl', '`'] }
	] as const;
</script>

<div class="editor-layout">
	<Tabs variant="editor" {tabs} onSelect={editorStore.openFile} onClose={editorStore.closeTab}>
		{#snippet actions()}
			<EditorSaveStatus status={autoSaver.status ?? ''} variant={saveStatusVariant} />
		{/snippet}
	</Tabs>

	<EditorBreadcrumb path={editorStore.activeTabPath} />

	{#if showEmptyState}
		<EmptyEditorState {quickActions} />
	{/if}

	<!-- Monaco editor mount point -->
	<div class="editor-container" class:hidden={showEmptyState} bind:this={element}></div>
</div>

<style>
	/* ── Layout shell ───────────────────────────────────────── */
	.editor-layout {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: color-mix(in srgb, var(--bg) 90%, black);
		border-left: 1px solid color-mix(in srgb, var(--border) 52%, transparent);
		overflow: hidden;
	}

	/* ── Monaco mount ───────────────────────────────────────── */
	.editor-container {
		flex: 1;
		min-height: 0;
		overflow: hidden;
		background: color-mix(in srgb, var(--bg) 94%, black);
	}

	.editor-container.hidden {
		display: none;
	}
</style>
