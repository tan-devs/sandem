<script lang="ts">
	import { requireIDEContext } from '$lib/context/ide-context.js';
	import { editorStore, activity } from '$lib/stores';
	import { findNodeByPath } from '$lib/utils/file-tree.js';

	import { createExplorerController } from '$lib/controllers/';
	import { useExplorer } from '$lib/hooks/useExplorer.svelte.js';

	import ExplorerContent from './ExplorerContent.svelte';
	import ActivityPanel from '../activities/ActivityPanel.svelte';

	// ── Wiring ────────────────────────────────────────────────────────────────

	const ide = requireIDEContext();
	const explorer = createExplorerController({ ide, editorStore });

	useExplorer(explorer, () => activity.tab);

	// ── Side effects ──────────────────────────────────────────────────────────

	// Auto-open the project entry file on first boot (before any tabs are open).
	$effect(() => {
		if (explorer.tree.length === 0 || explorer.treeLoading) return;
		if (editorStore.tabs.length > 0) return;

		const entryPath = ide.getEntryPath();
		if (!entryPath) return;

		const node = findNodeByPath(explorer.tree, entryPath);
		if (node?.type === 'file') editorStore.openFile(entryPath);
	});

	// Expand parent folders when a search query is active.
	$effect(() => {
		if (!explorer.hasSearch) return;
		for (const path of explorer.expandOnSearch) {
			if (!explorer.isExpanded(path)) explorer.toggleDir(path);
		}
	});
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
