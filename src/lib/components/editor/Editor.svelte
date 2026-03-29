<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	import { requireIDEContext } from '$lib/context';
	import { createEditorPaneController } from '$lib/controllers';
	import Tabs from '$lib/components/ui/primitives/Tabs.svelte';
	import { editorStore } from '$lib/stores';
	import { activity } from '$lib/stores';
	import EmptyEditorState from '$lib/components/editor/Empty.svelte';
	import EditorBreadcrumb from '$lib/components/editor/Breadcrumbs.svelte';
	import EditorSaveStatus from '$lib/components/editor/SaveStatus.svelte';
	import ErrorPanel from '$lib/components/ui/primitives/ErrorPanel.svelte';
	import { getPanelsContext } from '$lib/stores';
	import { collaborationPermissionsStore } from '$lib/stores';

	const ide = requireIDEContext();
	const panels = getPanelsContext();

	let element: HTMLDivElement;
	let canWrite = $state(true);

	const unsubscribePermissions = collaborationPermissionsStore.subscribe((value) => {
		canWrite = value.canWrite;
	});

	const editorPane = createEditorPaneController({
		ide,
		editorStore,
		activity,
		getPanels: () => panels,
		getCanWrite: () => canWrite
	});

	onMount(() => {
		const removeShortcuts = editorPane.mountShortcuts();

		const handlePageHide = () => void editorPane.shutdown();
		window.addEventListener('pagehide', handlePageHide);

		void editorPane.initializeEditor(element);

		return () => {
			removeShortcuts();
			window.removeEventListener('pagehide', handlePageHide);
		};
	});

	$effect(() => {
		void editorStore.activeTabPath;
		editorPane.syncAfterActivePathChange();
	});

	onDestroy(() => {
		unsubscribePermissions();
		void editorPane.shutdown();
	});
</script>

<div class="editor-layout">
	<Tabs
		variant="editor"
		tabs={editorPane.tabs}
		onSelect={editorStore.openFile}
		onClose={editorStore.closeTab}
	>
		{#snippet actions()}
			<EditorSaveStatus
				status={editorPane.autoSaver.status ?? ''}
				variant={editorPane.saveStatusVariant}
			/>
		{/snippet}
	</Tabs>

	<EditorBreadcrumb path={editorStore.activeTabPath} />

	{#if editorPane.showEmptyState}
		<EmptyEditorState quickActions={editorPane.quickActions} />
	{:else if editorPane.editorRuntimeError}
		<ErrorPanel
			title="Editor failed to start"
			description="The editor runtime encountered an error. You can retry without refreshing."
			message={editorPane.editorRuntimeError}
			testId="editor-runtime-error"
			retryLabel={editorPane.initializingEditor ? 'Retrying…' : 'Retry editor'}
			retryDisabled={editorPane.initializingEditor}
			onRetry={() => void editorPane.initializeEditor(element)}
		/>
	{/if}

	<!-- Monaco editor mount point -->
	<div
		class="editor-container"
		class:hidden={editorPane.showEmptyState || !!editorPane.editorRuntimeError}
		bind:this={element}
	></div>
</div>

<style>
	.editor-layout {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--bg);
		border-left: 1px solid var(--border);
		overflow: hidden;
	}

	.editor-container {
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	.editor-container.hidden {
		display: none;
	}
</style>
