<script lang="ts">
	import { tick } from 'svelte';
	import { ChevronRight, Search, X } from '@lucide/svelte';
	import { Accordion } from 'bits-ui';

	import type { FileNode } from '$types/editor';
	import { editorStore } from '$lib/stores';
	import FileTreeView from '$lib/components/ui/primitives/FileTreeView.svelte';

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
		onDirClick: (node: FileNode) => void;
		onFileClick: (node: FileNode) => void;
		onNodeContextMenu: (node: FileNode, event: MouseEvent) => void;
		contextMenu: {
			open: boolean;
			x: number;
			y: number;
			path: string | null;
		};
		onContextMenuAction: (
			action: 'new-file' | 'new-folder' | 'rename' | 'delete' | 'refresh'
		) => void;
		onCloseContextMenu: () => void;
		onSearchChange: (query: string) => void;
		onSearchClear: () => void;
	}

	type ContextMenuAction = 'new-file' | 'new-folder' | 'rename' | 'delete' | 'refresh';

	type ContextMenuEntry =
		| {
				id: string;
				type: 'item';
				label: string;
				action?: ContextMenuAction;
				danger?: boolean;
				disabled?: boolean;
				close?: boolean;
		  }
		| {
				id: string;
				type: 'separator';
		  };

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
		onDirClick,
		onFileClick,
		onNodeContextMenu,
		contextMenu,
		onContextMenuAction,
		onCloseContextMenu,
		onSearchChange,
		onSearchClear
	}: Props = $props();

	let menuElement: HTMLDivElement | null = $state(null);
	let activeMenuItemIndex = $state(-1);
	let wasContextMenuOpen = false;
	let lastContextMenuPath = $state<string | null>(null);

	const contextMenuEntries = $derived<ContextMenuEntry[]>([
		{ id: 'new-file', type: 'item', label: 'New File', action: 'new-file' },
		{ id: 'new-folder', type: 'item', label: 'New Folder', action: 'new-folder' },
		{ id: 'sep-1', type: 'separator' },
		{ id: 'rename', type: 'item', label: 'Rename', action: 'rename', disabled: !selectedPath },
		{
			id: 'delete',
			type: 'item',
			label: 'Delete',
			action: 'delete',
			danger: true,
			disabled: !selectedPath
		},
		{ id: 'sep-2', type: 'separator' },
		{ id: 'refresh', type: 'item', label: 'Refresh Explorer', action: 'refresh' },
		{ id: 'close', type: 'item', label: 'Close', close: true }
	]);

	const contextMenuItems = $derived(contextMenuEntries.filter((entry) => entry.type === 'item'));

	function getEnabledMenuItemIndexes(): number[] {
		return contextMenuItems
			.map((item, index) => (item.disabled ? -1 : index))
			.filter((index) => index >= 0);
	}

	function getMenuItemIndexById(id: string): number {
		return contextMenuItems.findIndex((item) => item.id === id);
	}

	function getMenuItemElements(): HTMLButtonElement[] {
		if (!menuElement) return [];
		return Array.from(menuElement.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
	}

	async function focusActiveMenuItem() {
		await tick();
		const items = getMenuItemElements();
		if (activeMenuItemIndex >= 0 && activeMenuItemIndex < items.length) {
			items[activeMenuItemIndex]?.focus();
		}
	}

	function moveActiveMenuItem(step: 1 | -1) {
		const enabledIndexes = getEnabledMenuItemIndexes();
		if (enabledIndexes.length === 0) return;

		const currentIndex = enabledIndexes.indexOf(activeMenuItemIndex);
		const nextEnabledIndex =
			currentIndex === -1
				? 0
				: (currentIndex + step + enabledIndexes.length) % enabledIndexes.length;

		activeMenuItemIndex = enabledIndexes[nextEnabledIndex] ?? enabledIndexes[0] ?? -1;
		void focusActiveMenuItem();
	}

	function setFirstEnabledMenuItemActive() {
		const enabledIndexes = getEnabledMenuItemIndexes();
		activeMenuItemIndex = enabledIndexes[0] ?? -1;
	}

	function restoreFocusToTreeItem(path: string | null) {
		if (!path) return;

		const treeRows = document.querySelectorAll<HTMLElement>('[data-tree-path]');
		for (const row of treeRows) {
			if (row.dataset.treePath === path) {
				row.focus();
				return;
			}
		}
	}

	function activateMenuItemById(id: string) {
		const item = contextMenuItems.find((entry) => entry.id === id);
		if (!item || item.disabled) return;

		if (item.close) {
			onCloseContextMenu();
			return;
		}

		if (item.action) {
			onContextMenuAction(item.action);
		}
	}

	function handleContextMenuKeydown(event: KeyboardEvent) {
		if (!contextMenu.open) return;

		if (event.key === 'ArrowDown') {
			event.preventDefault();
			moveActiveMenuItem(1);
			return;
		}

		if (event.key === 'ArrowUp') {
			event.preventDefault();
			moveActiveMenuItem(-1);
			return;
		}

		if (event.key === 'Home') {
			event.preventDefault();
			setFirstEnabledMenuItemActive();
			void focusActiveMenuItem();
			return;
		}

		if (event.key === 'End') {
			event.preventDefault();
			const enabledIndexes = getEnabledMenuItemIndexes();
			activeMenuItemIndex = enabledIndexes[enabledIndexes.length - 1] ?? -1;
			void focusActiveMenuItem();
			return;
		}

		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			const item = contextMenuItems[activeMenuItemIndex];
			if (item) {
				activateMenuItemById(item.id);
			}
			return;
		}

		if (event.key === 'Escape') {
			event.preventDefault();
			onCloseContextMenu();
		}
	}

	$effect(() => {
		if (contextMenu.open && contextMenu.path) {
			lastContextMenuPath = contextMenu.path;
		}

		if (contextMenu.open && !wasContextMenuOpen) {
			setFirstEnabledMenuItemActive();
			void focusActiveMenuItem();
		}

		if (!contextMenu.open && wasContextMenuOpen) {
			restoreFocusToTreeItem(lastContextMenuPath);
			activeMenuItemIndex = -1;
		}

		wasContextMenuOpen = contextMenu.open;
	});
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
		<!-- Search Box -->
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
				<button class="search-clear" onclick={() => onSearchClear()} title="Clear search">
					<X size={10} strokeWidth={2} />
				</button>
			{/if}
		</div>

		<!-- Tree View -->
		{#if tree.length > 0}
			<FileTreeView
				nodes={filteredTree}
				{selectedPath}
				isExpanded={(path) => (hasSearch ? expandOnSearch.has(path) : isExpanded(path))}
				isFileActive={(path) => editorStore.isActive(path)}
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

		{#if contextMenu.open}
			<div
				bind:this={menuElement}
				id="explorer-context-menu"
				class="context-menu"
				style={`left: ${contextMenu.x}px; top: ${contextMenu.y}px;`}
				role="menu"
				aria-label="Explorer context menu"
				tabindex="-1"
				onpointerdown={(event) => event.stopPropagation()}
				onkeydown={handleContextMenuKeydown}
			>
				{#each contextMenuEntries as entry (entry.id)}
					{#if entry.type === 'separator'}
						<div class="menu-divider" role="separator"></div>
					{:else}
						{@const itemIndex = getMenuItemIndexById(entry.id)}
						<button
							type="button"
							class="menu-item"
							class:danger={entry.danger}
							role="menuitem"
							aria-disabled={entry.disabled ? 'true' : undefined}
							tabindex={activeMenuItemIndex === itemIndex ? 0 : -1}
							disabled={entry.disabled}
							onfocus={() => {
								activeMenuItemIndex = itemIndex;
							}}
							onpointerenter={() => {
								if (!entry.disabled) {
									activeMenuItemIndex = itemIndex;
								}
							}}
							onclick={() => activateMenuItemById(entry.id)}
						>
							{entry.label}
						</button>
					{/if}
				{/each}
			</div>
		{/if}
	</Accordion.Content>
</Accordion.Item>

<style>
	/* ── Search bar ────────────────────────────────────────── */
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

	.context-menu {
		position: fixed;
		z-index: 30;
		width: 180px;
		padding: 4px;
		border-radius: 4px;
		border: 1px solid color-mix(in srgb, var(--border) 75%, transparent);
		background: color-mix(in srgb, var(--mg) 92%, var(--bg));
		box-shadow:
			0 8px 22px color-mix(in srgb, var(--text) 16%, transparent),
			0 0 0 1px color-mix(in srgb, var(--border) 30%, transparent);
	}

	.menu-item {
		display: flex;
		align-items: center;
		width: 100%;
		height: 24px;
		padding: 0 8px;
		border: 0;
		border-radius: 4px;
		background: transparent;
		color: var(--text);
		font-size: 11px;
		text-align: left;
		cursor: pointer;
	}

	.menu-item:hover:not(:disabled) {
		background: color-mix(in srgb, var(--fg) 70%, transparent);
	}

	.menu-item:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.menu-item.danger:hover:not(:disabled) {
		background: color-mix(in srgb, var(--error) 18%, transparent);
		color: var(--error);
	}

	.menu-divider {
		height: 1px;
		margin: 4px 0;
		background: color-mix(in srgb, var(--border) 60%, transparent);
	}
</style>
