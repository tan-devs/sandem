<script lang="ts">
	/**
	 * FileTree.svelte
	 *
	 * Orchestrates the file tree for a single project.
	 *
	 * Data flow:
	 *   Convex (listNodes) → flat FileNode[] → FileTreeNode (recursive)
	 *
	 * This component owns:
	 *   - active file selection state (activeNodeId)
	 *   - all mutations (rename, delete, new file/folder)
	 * and passes them down as callback props so FileTreeNode stays pure.
	 */
	import { useConvexClient, useQuery } from 'convex-svelte';
	import { api } from '$convex/_generated/api.js';
	import type { Id } from '$convex/_generated/dataModel.js';
	import FileTreeNode from '$lib/components/ui/primitives/FileTreeNode.svelte';
	import type { FileNode } from '$types/filesystem.js';

	type Props = {
		projectId?: Id<'projects'>;
		isOwner?: boolean;
		onselect?: (node: FileNode) => void;
	};

	let { projectId, isOwner = false, onselect }: Props = $props();

	// -------------------------------------------------------------------------
	// Convex subscriptions & mutations
	// -------------------------------------------------------------------------

	const convexClient = useConvexClient();

	const nodesQuery = $derived(
		projectId
			? useQuery(api.filesystem.listNodes, { projectId })
			: { data: [] as FileNode[], isLoading: false }
	);

	// -------------------------------------------------------------------------
	// Derived: flat list + sorted root nodes
	// -------------------------------------------------------------------------

	const allNodes = $derived((nodesQuery.data ?? []) as FileNode[]);

	const rootNodes = $derived(
		allNodes
			.filter((n) => !n.parentId)
			.sort((a, b) => {
				if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
				return a.name.localeCompare(b.name);
			})
	);

	// -------------------------------------------------------------------------
	// Active selection — owned here, passed down as activeNodeId
	// -------------------------------------------------------------------------

	let activeNodeId = $state<string | null>(null);

	function handleSelect(node: FileNode) {
		activeNodeId = node._id;
		onselect?.(node);
	}

	// -------------------------------------------------------------------------
	// Inline "new node" creation state
	// -------------------------------------------------------------------------

	type CreatingState = {
		parentId: string | undefined;
		parentPath: string;
		type: 'file' | 'folder';
	};

	let creating = $state<CreatingState | null>(null);
	let newNodeName = $state('');
	let newNodeInput = $state<HTMLInputElement | undefined>(undefined);

	function openCreator(parentId: string | undefined, parentPath: string, type: 'file' | 'folder') {
		creating = { parentId, parentPath, type };
		newNodeName = '';
		setTimeout(() => newNodeInput?.focus(), 0);
	}

	async function commitNewNode() {
		if (!projectId || !creating || !newNodeName.trim()) {
			creating = null;
			return;
		}

		const name = newNodeName.trim();
		const path =
			creating.parentPath === '/' || !creating.parentPath
				? `/${name}`
				: `${creating.parentPath}/${name}`;

		await convexClient.mutation(api.filesystem.createNode, {
			projectId,
			path,
			name,
			type: creating.type,
			content: creating.type === 'file' ? '' : undefined,
			parentId: creating.parentId as Id<'nodes'> | undefined
		});

		creating = null;
	}

	function cancelNewNode() {
		creating = null;
	}

	function handleNewNodeKey(e: KeyboardEvent) {
		if (e.key === 'Enter') commitNewNode();
		if (e.key === 'Escape') cancelNewNode();
	}

	// -------------------------------------------------------------------------
	// Mutation handlers — passed as callbacks into FileTreeNode
	// -------------------------------------------------------------------------

	async function handleRename(node: FileNode, newName: string) {
		if (!projectId) return;
		await convexClient.mutation(api.filesystem.renameNode, {
			id: node._id as Id<'nodes'>,
			newName
		});
	}

	async function handleDelete(node: FileNode) {
		if (!projectId) return;
		if (activeNodeId === node._id) activeNodeId = null;
		await convexClient.mutation(api.filesystem.deleteNode, {
			id: node._id as Id<'nodes'>
		});
	}

	function handleNewFile(parentId: string | undefined, parentPath: string) {
		openCreator(parentId, parentPath, 'file');
	}

	function handleNewFolder(parentId: string | undefined, parentPath: string) {
		openCreator(parentId, parentPath, 'folder');
	}
</script>

<aside class="sidebar" aria-label="File Explorer">
	<!-- Header -->
	<header class="sidebar-header">
		<span class="sidebar-title">Explorer</span>
		{#if isOwner}
			<span class="header-actions">
				<button
					class="icon-btn"
					title="New File"
					onclick={() => openCreator(undefined, '/', 'file')}
					aria-label="New file at root"
				>
					<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
						<rect
							x="2"
							y="1"
							width="8"
							height="11"
							rx="1"
							stroke="currentColor"
							stroke-width="1.2"
						/>
						<path d="M6 1v4h4" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" />
						<path
							d="M10 10h4M12 8v4"
							stroke="currentColor"
							stroke-width="1.2"
							stroke-linecap="round"
						/>
					</svg>
				</button>
				<button
					class="icon-btn"
					title="New Folder"
					onclick={() => openCreator(undefined, '/', 'folder')}
					aria-label="New folder at root"
				>
					<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
						<path
							d="M1 4a1 1 0 011-1h4l1.5 2H14a1 1 0 011 1v6a1 1 0 01-1 1H2a1 1 0 01-1-1V4z"
							stroke="currentColor"
							stroke-width="1.2"
						/>
						<path
							d="M10 8h4M12 6v4"
							stroke="currentColor"
							stroke-width="1.2"
							stroke-linecap="round"
						/>
					</svg>
				</button>
			</span>
		{/if}
	</header>

	<!-- Loading state -->
	{#if nodesQuery.data === undefined}
		<div class="loading">
			<span class="loading-bar"></span>
			<span class="loading-bar" style="width: 60%; opacity: 0.5"></span>
			<span class="loading-bar" style="width: 80%; opacity: 0.3"></span>
		</div>

		<!-- Empty state -->
	{:else if rootNodes.length === 0 && !creating}
		<div class="empty">
			<p>No files yet.</p>
			{#if isOwner}
				<button class="empty-cta" onclick={() => openCreator(undefined, '/', 'file')}>
					Create a file
				</button>
			{/if}
		</div>
	{:else}
		<!-- Tree -->
		<ul class="tree" role="tree" aria-label="Project files">
			<!-- Root-level inline creator -->
			{#if creating && !creating.parentId}
				<li class="inline-creator" role="treeitem" aria-selected="false">
					<span class="creator-icon" aria-hidden="true">
						{creating.type === 'folder' ? '📁' : '📄'}
					</span>
					<input
						bind:this={newNodeInput}
						bind:value={newNodeName}
						class="creator-input"
						placeholder={creating.type === 'folder' ? 'folder-name' : 'filename.ts'}
						onblur={cancelNewNode}
						onkeydown={handleNewNodeKey}
					/>
				</li>
			{/if}

			{#each rootNodes as node (node._id)}
				<FileTreeNode
					{node}
					{allNodes}
					{isOwner}
					{activeNodeId}
					depth={0}
					onselect={handleSelect}
					onrename={handleRename}
					ondelete={handleDelete}
					onnewFile={handleNewFile}
					onnewFolder={handleNewFolder}
				/>
			{/each}
		</ul>
	{/if}
</aside>

<style>
	/* ---- Shell ---- */
	.sidebar {
		display: flex;
		flex-direction: column;
		width: 240px;
		min-width: 160px;
		max-width: 360px;
		height: 100%;
		background: var(--sidebar-bg, #0d1117);
		border-right: 1px solid var(--sidebar-border, rgba(255, 255, 255, 0.07));
		overflow: hidden;
		font-family: var(--font-mono, 'JetBrains Mono', monospace);
	}

	/* ---- Header ---- */
	.sidebar-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px 10px 6px;
		border-bottom: 1px solid var(--sidebar-border, rgba(255, 255, 255, 0.07));
		flex-shrink: 0;
	}

	.sidebar-title {
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--sidebar-label, #6e7681);
	}

	.header-actions {
		display: flex;
		gap: 2px;
	}

	.icon-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		padding: 3px;
		background: none;
		border: none;
		border-radius: 4px;
		color: var(--sidebar-label, #6e7681);
		cursor: pointer;
		transition:
			background 80ms ease,
			color 80ms ease;
	}

	.icon-btn:hover {
		background: var(--tree-hover, rgba(255, 255, 255, 0.08));
		color: var(--tree-fg, #c9d1d9);
	}

	.icon-btn svg {
		width: 100%;
		height: 100%;
	}

	/* ---- Tree ---- */
	.tree {
		flex: 1;
		overflow-y: auto;
		overflow-x: hidden;
		padding: 4px 0;
		margin: 0;
		list-style: none;
		scrollbar-width: thin;
		scrollbar-color: var(--tree-scroll, rgba(255, 255, 255, 0.1)) transparent;
	}

	.tree::-webkit-scrollbar {
		width: 4px;
	}
	.tree::-webkit-scrollbar-thumb {
		background: var(--tree-scroll, rgba(255, 255, 255, 0.1));
		border-radius: 2px;
	}

	/* ---- Inline creator ---- */
	.inline-creator {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 3px 8px;
	}

	.creator-icon {
		font-size: 14px;
		line-height: 1;
	}

	.creator-input {
		flex: 1;
		background: var(--tree-input-bg, #161b22);
		border: 1px solid var(--tree-accent, #58a6ff);
		border-radius: 3px;
		color: var(--tree-fg, #c9d1d9);
		font: 13px var(--font-mono, 'JetBrains Mono', monospace);
		padding: 2px 6px;
		outline: none;
	}

	/* ---- Loading skeleton ---- */
	.loading {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 12px 10px;
	}

	.loading-bar {
		display: block;
		height: 12px;
		width: 100%;
		border-radius: 3px;
		background: linear-gradient(
			90deg,
			rgba(255, 255, 255, 0.04) 0%,
			rgba(255, 255, 255, 0.08) 50%,
			rgba(255, 255, 255, 0.04) 100%
		);
		background-size: 200% 100%;
		animation: shimmer 1.4s infinite;
	}

	@keyframes shimmer {
		0% {
			background-position: 200% 0;
		}
		100% {
			background-position: -200% 0;
		}
	}

	/* ---- Empty state ---- */
	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 10px;
		padding: 32px 16px;
		color: var(--sidebar-label, #6e7681);
		font-size: 12.5px;
		text-align: center;
	}

	.empty p {
		margin: 0;
	}

	.empty-cta {
		padding: 5px 12px;
		background: none;
		border: 1px solid var(--tree-accent, #58a6ff);
		border-radius: 4px;
		color: var(--tree-accent, #58a6ff);
		cursor: pointer;
		font: 12px var(--font-mono, 'JetBrains Mono', monospace);
		transition: background 80ms ease;
	}

	.empty-cta:hover {
		background: rgba(88, 166, 255, 0.1);
	}
</style>
