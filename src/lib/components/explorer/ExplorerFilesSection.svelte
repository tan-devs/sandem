<script lang="ts">
	import { ChevronRight, Search, X } from '@lucide/svelte';
	import { Accordion } from 'bits-ui';

	import type { FileNode } from '$types/editor';
	import type { ContextMenuState, ContextMenuAction } from '$types/explorer';
	import FileTreeView from '$lib/components/primitives/FileTreeView.svelte';
	import ExplorerContextMenu from './ExploerContextMenu.svelte';

	interface Props {
		tree: FileNode[];
		filteredTree: FileNode[];
		treeLoading: boolean;
		treeError: string | null;
		searchQuery: string;
		hasSearch: boolean;
		expandOnSearch: Set<string>;
		selectedPath: string | null;
		isExpanded: (path: string) => boolean;
		isFileActive: (path: string) => boolean;
		onDirClick: (node: FileNode) => void;
		onFileClick: (node: FileNode) => void;
		onNodeContextMenu: (node: FileNode, event: MouseEvent) => void;
		contextMenu: ContextMenuState;
		onContextMenuAction: (action: ContextMenuAction) => void;
		onCloseContextMenu: () => void;
		onSearchChange: (query: string) => void;
		onSearchClear: () => void;
	}

	let {
		tree,
		filteredTree,
		treeLoading,
		treeError,
		searchQuery,
		hasSearch,
		expandOnSearch,
		selectedPath,
		isExpanded,
		isFileActive,
		onDirClick,
		onFileClick,
		onNodeContextMenu,
		contextMenu,
		onContextMenuAction,
		onCloseContextMenu,
		onSearchChange,
		onSearchClear
	}: Props = $props();
</script>

<Accordion.Item value="files" class="explorer-section">
	<Accordion.Header>
		<Accordion.Trigger class="section-trigger">
			<span class="section-chevron" aria-hidden="true">
				<ChevronRight size={11} strokeWidth={2} />
			</span>
			<span class="section-title">FOLDERS</span>
		</Accordion.Trigger>
	</Accordion.Header>

	<Accordion.Content>
		<div class="search-container">
			<Search size={10} strokeWidth={2} />
			<input
				type="text"
				class="search-input"
				placeholder="Search files..."
				value={searchQuery}
				onchange={(e) => onSearchChange((e.target as HTMLInputElement).value)}
				oninput={(e) => onSearchChange((e.target as HTMLInputElement).value)}
			/>
			{#if hasSearch}
				<button class="search-clear" onclick={onSearchClear} title="Clear search">
					<X size={10} strokeWidth={2} />
				</button>
			{/if}
		</div>

		{#if tree.length > 0}
			<FileTreeView
				nodes={filteredTree}
				{selectedPath}
				isExpanded={(path) => (hasSearch ? expandOnSearch.has(path) : isExpanded(path))}
				{isFileActive}
				{onDirClick}
				{onFileClick}
				{onNodeContextMenu}
			/>
		{:else if treeLoading}
			<div class="status-msg">Loading…</div>
		{:else if treeError}
			<div class="status-msg error">{treeError}</div>
		{:else}
			<div class="status-msg">No files found.</div>
		{/if}

		<ExplorerContextMenu
			{contextMenu}
			{selectedPath}
			onAction={onContextMenuAction}
			onClose={onCloseContextMenu}
		/>
	</Accordion.Content>
</Accordion.Item>

<style>
	.search-container {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 8px;
		border-bottom: 1px solid color-mix(in srgb, var(--border) 55%, transparent);
		background: color-mix(in srgb, var(--mg) 90%, var(--bg));
		color: var(--muted);
		flex-shrink: 0;
	}

	.search-input {
		flex: 1;
		min-width: 0;
		border: 1px solid color-mix(in srgb, var(--border) 78%, transparent);
		border-radius: 3px;
		padding: 4px 6px;
		font-size: 11px;
		background: color-mix(in srgb, var(--bg) 88%, var(--fg));
		color: var(--text);
		font-family: inherit;
	}

	.search-input::placeholder {
		color: var(--muted);
	}

	.search-input:focus {
		outline: none;
		border-color: var(--accent);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 28%, transparent);
	}

	.search-clear {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 16px;
		height: 16px;
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--muted);
		cursor: pointer;
		transition: color var(--time) var(--ease);
		flex-shrink: 0;
	}

	.search-clear:hover {
		color: var(--text);
	}

	.status-msg {
		padding: 6px 12px;
		font-size: 11px;
		color: var(--muted);
		font-style: italic;
	}

	.status-msg.error {
		color: var(--error);
	}
</style>
