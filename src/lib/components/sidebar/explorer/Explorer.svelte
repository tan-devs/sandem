<script lang="ts">
	import { onMount } from 'svelte';
	import { requireIDEContext } from '$lib/context';
	import { editorStore, activity } from '$lib/stores';
	import { findNodeByPath } from '$lib/utils/explorer/file-tree.js';

	import { createExplorerController } from '$lib/controllers';
	import { useExplorer } from '$lib/hooks';

	import ExplorerContent from './ExplorerContent.svelte';
	import ActivityPanel from '../activities/ActivityPanel.svelte';

	// ── Assembly ──────────────────────────────────────────────────────────────

	const ide = requireIDEContext();
	const explorer = createExplorerController({ ide, editorStore });

	// Register reactive $effects (search expansion) + get mount() for onMount.
	const { mount } = useExplorer(explorer, () => activity.tab);

	// ── Side effects ──────────────────────────────────────────────────────────

	// Auto-open the project entry file on first boot (before any tab is open).
	// Lives here (not in the hook) because it needs both ide context and editorStore,
	// which are scoped to this component.
	$effect(() => {
		if (explorer.tree.length === 0 || explorer.treeLoading) return;
		if (editorStore.tabs.length > 0) return;

		const entryPath = ide.getEntryPath();
		if (!entryPath) return;

		const node = findNodeByPath(explorer.tree, entryPath);
		if (node?.type === 'file') editorStore.openFile(entryPath);
	});

	// ── Lifecycle ─────────────────────────────────────────────────────────────

	// onMount returns the cleanup function directly — Svelte calls it on destroy.
	onMount(mount);
</script>

<ActivityPanel title="EXPLORER" actionButtons={explorer.actionButtons}>
	<ExplorerContent
		bind:openSections={explorer.openSections}
		tree={explorer.tree}
		filteredTree={explorer.filteredTree}
		treeLoading={explorer.treeLoading}
		treeError={explorer.treeError}
		expandOnSearch={explorer.expandOnSearch}
		activeProject={explorer.activeProject}
		activeProjectFolder={explorer.activeProjectFolder}
		nodeCount={explorer.nodeCount}
		isOwner={explorer.isOwner}
		actionMessage={explorer.actionMessage}
		actionError={explorer.actionError}
		selectedPath={explorer.selectedPath}
		searchQuery={explorer.searchQuery}
		hasSearch={explorer.hasSearch}
		activeFilePath={explorer.activeTabPath}
		timelineEvents={explorer.timelineEvents}
		tabs={explorer.tabs}
		isExpanded={explorer.isExpanded}
		isFileActive={explorer.isFileActive}
		onDirClick={explorer.handleDirClick}
		onFileClick={explorer.handleFileClick}
		onNodeContextMenu={explorer.handleNodeContextMenu}
		contextMenu={explorer.contextMenu}
		onContextMenuAction={explorer.handleContextMenuAction}
		onCloseContextMenu={explorer.closeContextMenu}
		dialogState={explorer.dialogState}
		onDialogValueChange={explorer.setDialogValue}
		onDialogCancel={explorer.closeDialog}
		onDialogConfirm={explorer.confirmDialog}
		onTimelineOpenPath={explorer.openFile}
		onSearchChange={explorer.setSearchQuery}
		onSearchClear={explorer.clearSearch}
		onOpenFile={explorer.openFile}
		onCloseTab={explorer.closeTab}
	/>
</ActivityPanel>
