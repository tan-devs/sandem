<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	import { requireIDEContext } from '$lib/context';
	import { createEditorController } from '$lib/controllers/editor';
	import { Tabs, ErrorPanel } from '$lib/components/primitives';
	import { editorStore } from '$lib/stores/editor';
	import { collaborationPermissionsStore } from '$lib/stores/collaboration';
	import { EditorSaveStatus, EditorBreadcrumbs, EditorEmptyState } from '$lib/components/editor';
	import type { IDEPanelsAdapter } from '$lib/controllers/panels';

	// ── Props ─────────────────────────────────────────────────────────────────

	interface Props {
		getPanels: () => IDEPanelsAdapter | undefined;
	}

	let { getPanels }: Props = $props();

	// ── Permissions ───────────────────────────────────────────────────────────

	let element: HTMLDivElement;
	let canWrite = $state(true);

	const ide = requireIDEContext();

	const unsubscribePermissions = collaborationPermissionsStore.subscribe((value) => {
		canWrite = value.canWrite;
	});

	// ── Wiring ────────────────────────────────────────────────────────────────
	//
	// Wrap getPanels in a closure so the controller always re-reads the live
	// prop value, not the value captured at construction time.

	const editorPane = createEditorController({
		ide,
		store: editorStore,
		getPanels: () => getPanels(),
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

	<EditorBreadcrumbs path={editorStore.activeTabPath} />

	{#if editorPane.showEmptyState}
		<EditorEmptyState quickActions={editorPane.quickActions} />
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
