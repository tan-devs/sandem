<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { slide } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import type { FileNode } from '$types/filesystem.js';
	import { activeFilePath, activeFileId } from '$lib/stores';

	export let node: FileNode;
	export let depth: number = 0;

	// Children passed in from the parent — avoids each node re-querying Convex.
	// The root SidebarTree builds the full flat list once and slices it per node.
	export let allNodes: FileNode[] = [];
	export let isOwner: boolean = false;

	const dispatch = createEventDispatcher<{
		select: FileNode;
		rename: { node: FileNode; newName: string };
		delete: FileNode;
		newFile: { parentId: string | undefined; parentPath: string };
		newFolder: { parentId: string | undefined; parentPath: string };
	}>();

	// -------------------------------------------------------------------------
	// State
	// -------------------------------------------------------------------------

	let open = false;
	let renaming = false;
	let renameValue = node.name;
	let renameInput: HTMLInputElement;
	let contextMenuVisible = false;
	let contextMenuX = 0;
	let contextMenuY = 0;

	$: isActive = $activeFileId === node._id;
	$: isFolder = node.type === 'folder';

	// Direct children of this node — O(n) over the flat list, fast enough for
	// typical project sizes (<1000 nodes). For very large trees, pass a Map.
	$: children = allNodes
		.filter((n) => n.parentId === node._id)
		.sort((a, b) => {
			// Folders first, then alphabetical
			if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
			return a.name.localeCompare(b.name);
		});

	// -------------------------------------------------------------------------
	// Handlers
	// -------------------------------------------------------------------------

	function handleClick() {
		if (isFolder) {
			open = !open;
		} else {
			activeFilePath.set(node.path);
			activeFileId.set(node._id);
			dispatch('select', node);
		}
	}

	function handleContextMenu(e: MouseEvent) {
		if (!isOwner) return;
		e.preventDefault();
		contextMenuX = e.clientX;
		contextMenuY = e.clientY;
		contextMenuVisible = true;
	}

	function closeContextMenu() {
		contextMenuVisible = false;
	}

	function startRename() {
		renaming = true;
		renameValue = node.name;
		contextMenuVisible = false;
		// Focus happens after Svelte renders the input
		setTimeout(() => renameInput?.focus(), 0);
	}

	function commitRename() {
		const trimmed = renameValue.trim();
		if (trimmed && trimmed !== node.name) {
			dispatch('rename', { node, newName: trimmed });
		}
		renaming = false;
	}

	function handleRenameKey(e: KeyboardEvent) {
		if (e.key === 'Enter') commitRename();
		if (e.key === 'Escape') renaming = false;
	}

	function handleDelete() {
		contextMenuVisible = false;
		dispatch('delete', node);
	}

	function handleNewFile() {
		contextMenuVisible = false;
		open = true;
		dispatch('newFile', { parentId: node._id, parentPath: node.path });
	}

	function handleNewFolder() {
		contextMenuVisible = false;
		open = true;
		dispatch('newFolder', { parentId: node._id, parentPath: node.path });
	}

	// Bubble events from nested children up to the root
	function relay(e: CustomEvent) {
		dispatch(e.type as any, e.detail);
	}
</script>

<!-- Click-away to close context menu -->
<svelte:window onclick={closeContextMenu} />

<li
	class="tree-node"
	class:is-folder={isFolder}
	class:is-file={!isFolder}
	class:is-active={isActive}
	style="--depth: {depth}"
	aria-selected={isActive}
	role="treeitem"
>
	<!-- Node row -->
	<button
		class="node-row"
		onclick={handleClick}
		on:contextmenu={handleContextMenu}
		tabindex="0"
		aria-expanded={isFolder ? open : undefined}
	>
		<!-- Indentation track lines -->
		{#each Array(depth) as _}
			<span class="indent-guide" aria-hidden="true" />
		{/each}

		<!-- Icon -->
		<span class="icon" aria-hidden="true">
			{#if isFolder}
				<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
					{#if open}
						<!-- Chevron down -->
						<path
							d="M4 6l4 4 4-4"
							stroke="currentColor"
							stroke-width="1.5"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					{:else}
						<!-- Chevron right -->
						<path
							d="M6 4l4 4-4 4"
							stroke="currentColor"
							stroke-width="1.5"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					{/if}
				</svg>
			{:else}
				<!-- File dot -->
				<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
					<rect x="3" y="1" width="8" height="10" rx="1" stroke="currentColor" stroke-width="1.2" />
					<path d="M7 1v4h4" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" />
				</svg>
			{/if}
		</span>

		<!-- Label / rename input -->
		{#if renaming}
			<input
				bind:this={renameInput}
				bind:value={renameValue}
				class="rename-input"
				on:blur={commitRename}
				on:keydown={handleRenameKey}
				onclick|stopPropagation
			/>
		{:else}
			<span class="node-name">{node.name}</span>
		{/if}
	</button>

	<!-- Context menu (owner only) -->
	{#if contextMenuVisible && isOwner}
		<menu class="context-menu" style="top: {contextMenuY}px; left: {contextMenuX}px" role="menu">
			{#if isFolder}
				<li role="menuitem"><button onclick={handleNewFile}>New File</button></li>
				<li role="menuitem"><button onclick={handleNewFolder}>New Folder</button></li>
				<li class="divider" role="separator" />
			{/if}
			<li role="menuitem"><button onclick={startRename}>Rename</button></li>
			<li role="menuitem" class="danger">
				<button onclick={handleDelete}>Delete</button>
			</li>
		</menu>
	{/if}

	<!-- Children -->
	{#if isFolder && open && children.length > 0}
		<ul class="children" role="group" transition:slide={{ duration: 140, easing: quintOut }}>
			{#each children as child (child._id)}
				<svelte:self
					node={child}
					{allNodes}
					{isOwner}
					depth={depth + 1}
					on:select={relay}
					on:rename={relay}
					on:delete={relay}
					on:newFile={relay}
					on:newFolder={relay}
				/>
			{/each}
		</ul>
	{/if}
</li>

<style>
	/* ---- Layout ---- */
	.tree-node {
		list-style: none;
		position: relative;
	}

	.node-row {
		display: flex;
		align-items: center;
		gap: 0;
		width: 100%;
		padding: 3px 8px 3px calc(8px + var(--depth) * 12px);
		background: none;
		border: none;
		cursor: pointer;
		text-align: left;
		border-radius: 4px;
		color: var(--tree-fg, #c9d1d9);
		font-size: 13px;
		font-family: var(--font-mono, 'JetBrains Mono', monospace);
		line-height: 1.5;
		position: relative;
		transition: background 80ms ease;
	}

	.node-row:hover {
		background: var(--tree-hover, rgba(255, 255, 255, 0.06));
	}

	.is-active > .node-row {
		background: var(--tree-active, rgba(88, 166, 255, 0.14));
		color: var(--tree-active-fg, #58a6ff);
	}

	/* ---- Indent guides ---- */
	.indent-guide {
		display: inline-block;
		width: 12px;
		flex-shrink: 0;
		position: relative;
	}

	.indent-guide::before {
		content: '';
		position: absolute;
		left: 5px;
		top: -10px;
		bottom: -10px;
		width: 1px;
		background: var(--tree-guide, rgba(255, 255, 255, 0.08));
	}

	/* ---- Icon ---- */
	.icon {
		display: flex;
		align-items: center;
		width: 16px;
		height: 16px;
		flex-shrink: 0;
		margin-right: 6px;
		color: var(--tree-icon, #8b949e);
	}

	.is-folder > .node-row .icon {
		color: var(--tree-folder-icon, #e3b341);
	}

	.is-active > .node-row .icon {
		color: inherit;
	}

	.icon svg {
		width: 100%;
		height: 100%;
	}

	/* ---- Name ---- */
	.node-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		flex: 1;
	}

	/* ---- Rename input ---- */
	.rename-input {
		flex: 1;
		background: var(--tree-input-bg, #0d1117);
		border: 1px solid var(--tree-accent, #58a6ff);
		border-radius: 3px;
		color: inherit;
		font: inherit;
		padding: 0 4px;
		outline: none;
	}

	/* ---- Children ---- */
	.children {
		padding: 0;
		margin: 0;
	}

	/* ---- Context menu ---- */
	.context-menu {
		position: fixed;
		z-index: 1000;
		background: var(--tree-menu-bg, #161b22);
		border: 1px solid var(--tree-menu-border, rgba(255, 255, 255, 0.12));
		border-radius: 6px;
		padding: 4px;
		list-style: none;
		margin: 0;
		min-width: 140px;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
		font-size: 12.5px;
		font-family: var(--font-mono, 'JetBrains Mono', monospace);
	}

	.context-menu li button {
		display: block;
		width: 100%;
		padding: 5px 10px;
		background: none;
		border: none;
		color: var(--tree-fg, #c9d1d9);
		cursor: pointer;
		text-align: left;
		border-radius: 4px;
		transition: background 60ms ease;
	}

	.context-menu li button:hover {
		background: var(--tree-hover, rgba(255, 255, 255, 0.08));
	}

	.context-menu .danger button {
		color: var(--tree-danger, #f85149);
	}

	.context-menu .divider {
		height: 1px;
		background: var(--tree-menu-border, rgba(255, 255, 255, 0.1));
		margin: 4px 0;
	}
</style>
