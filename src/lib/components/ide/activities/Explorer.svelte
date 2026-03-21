<script lang="ts">
	import {
		ChevronRight,
		ChevronDown,
		File,
		Folder,
		FolderOpen,
		RefreshCw,
		FilePlus,
		FolderPlus,
		FilePenLine,
		Trash2,
		ChevronsUpDown,
		Ellipsis
	} from '@lucide/svelte';

	import { requireIDEContext } from '$lib/context/ide/ide-context.js';
	import {
		createFileTree,
		type FileNode,
		createProjectFilesSync,
		createExplorerActivity
	} from '$lib/hooks/explorer/index.js';
	import { onMount } from 'svelte';
	import { editorStore } from '$lib/stores/editor/editorStore.svelte.js';
	import Button from '$lib/components/ui/primitives/Button.svelte';
	import ActivityPanel from './ActivityPanel.svelte';
	import { Accordion } from 'bits-ui';

	const ide = requireIDEContext();
	const fileTree = createFileTree(ide.getWebcontainer);
	const projectSync = createProjectFilesSync({
		getProject: () => ide.getProject(editorStore.activeTabPath ?? undefined),
		getWebcontainer: ide.getWebcontainer,
		onRemoteOperationApplied: async () => {
			await fileTree.refresh({ silent: true });
		}
	});
	const explorer = createExplorerActivity({
		getWebcontainer: ide.getWebcontainer,
		getEntryPath: ide.getEntryPath,
		getActiveTabPath: () => editorStore.activeTabPath,
		openFile: editorStore.openFile,
		fileTree,
		projectSync
	});

	onMount(() => {
		explorer.start();

		return () => {
			explorer.stop();
		};
	});
</script>

<ActivityPanel title="EXPLORER">
	{#snippet actions()}
		<Button
			variant="ghost"
			tone="neutral"
			size="icon"
			class="panel-icon-action"
			title="New file"
			aria-label="New file"
			onclick={() => void explorer.createFile()}
		>
			<FilePlus size={12} strokeWidth={1.75} />
		</Button>
		<Button
			variant="ghost"
			tone="neutral"
			size="icon"
			class="panel-icon-action"
			title="New folder"
			aria-label="New folder"
			onclick={() => void explorer.createFolder()}
		>
			<FolderPlus size={12} strokeWidth={1.75} />
		</Button>
		<Button
			variant="ghost"
			tone="neutral"
			size="icon"
			class="panel-icon-action"
			title="Rename path"
			aria-label="Rename path"
			onclick={() => void explorer.renamePath()}
		>
			<FilePenLine size={12} strokeWidth={1.75} />
		</Button>
		<Button
			variant="ghost"
			tone="neutral"
			size="icon"
			class="panel-icon-action"
			title="Delete path"
			aria-label="Delete path"
			onclick={() => void explorer.deletePath()}
		>
			<Trash2 size={12} strokeWidth={1.75} />
		</Button>
		<Button
			variant="ghost"
			tone="neutral"
			size="icon"
			class="panel-icon-action"
			title="Refresh explorer"
			aria-label="Refresh explorer"
			onclick={() => void explorer.refreshTree()}
		>
			<RefreshCw size={12} strokeWidth={1.75} />
		</Button>
		<Button
			variant="ghost"
			tone="neutral"
			size="icon"
			class="panel-icon-action"
			title="Expand/Collapse all folders"
			aria-label="Expand or collapse all folders"
			onclick={explorer.toggleAllFolders}
		>
			<ChevronsUpDown size={12} strokeWidth={1.75} />
		</Button>
		<Button
			variant="ghost"
			tone="neutral"
			size="icon"
			class="panel-icon-action"
			title="Refresh and expand all"
			aria-label="More actions"
			onclick={() => void explorer.refreshAndExpandAll()}
		>
			<Ellipsis size={12} strokeWidth={1.75} />
		</Button>
	{/snippet}

	<Accordion.Root type="multiple" class="explorer-accordion">
		<div class="explorer-content">
			{#if explorer.actionError}
				<div class="status-msg error">{explorer.actionError}</div>
			{:else if explorer.actionMessage}
				<div class="status-msg">{explorer.actionMessage}</div>
			{/if}

			{#if editorStore.tabs.length > 0}
				<Accordion.Item value="open-editors" class="explorer-section">
					<Accordion.Header>
						<Accordion.Trigger class="section-trigger">
							<span class="section-chevron" aria-hidden="true">
								<ChevronRight size={11} strokeWidth={2} />
							</span>
							<span class="section-title">OPEN EDITORS</span>
						</Accordion.Trigger>
					</Accordion.Header>
					<Accordion.Content>
						{#each editorStore.tabs as tab (tab.path)}
							{@const activeTab = editorStore.isActive(tab.path)}
							<Button
								variant={activeTab ? 'default' : 'ghost'}
								tone={activeTab ? 'accent' : 'neutral'}
								size="sm"
								justify="start"
								class="open-editor-btn"
								onclick={() => editorStore.openFile(tab.path)}
							>
								<span class="open-editor-dot" class:active={activeTab}></span>
								<span>{tab.label}</span>
							</Button>
						{/each}
					</Accordion.Content>
				</Accordion.Item>
			{/if}

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
					{#if fileTree.loading}
						<div class="status-msg">Loading…</div>
					{:else if fileTree.error}
						<div class="status-msg">{fileTree.error}</div>
					{:else if fileTree.tree.length === 0}
						<div class="status-msg">No files found.</div>
					{:else}
						<div class="tree" role="tree">
							{#each fileTree.tree as node (node.path)}
								{@render treeNode(node)}
							{/each}
						</div>
					{/if}
				</Accordion.Content>
			</Accordion.Item>

			<Accordion.Item value="outline" class="explorer-section">
				<Accordion.Header>
					<Accordion.Trigger class="section-trigger">
						<span class="section-chevron" aria-hidden="true">
							<ChevronRight size={11} strokeWidth={2} />
						</span>
						<span class="section-title">OUTLINE</span>
					</Accordion.Trigger>
				</Accordion.Header>

				<Accordion.Content>
					<div class="section-placeholder">No symbols found in the active editor.</div>
				</Accordion.Content>
			</Accordion.Item>

			<Accordion.Item value="timeline" class="explorer-section">
				<Accordion.Header>
					<Accordion.Trigger class="section-trigger">
						<span class="section-chevron" aria-hidden="true">
							<ChevronRight size={11} strokeWidth={2} />
						</span>
						<span class="section-title">TIMELINE</span>
					</Accordion.Trigger>
				</Accordion.Header>

				<Accordion.Content>
					<div class="section-placeholder">No timeline provider available for this resource.</div>
				</Accordion.Content>
			</Accordion.Item>

			<Accordion.Item value="npm-scripts" class="explorer-section">
				<Accordion.Header>
					<Accordion.Trigger class="section-trigger">
						<span class="section-chevron" aria-hidden="true">
							<ChevronRight size={11} strokeWidth={2} />
						</span>
						<span class="section-title">NPM SCRIPTS</span>
					</Accordion.Trigger>
				</Accordion.Header>

				<Accordion.Content>
					<div class="section-placeholder">No scripts are currently detected.</div>
				</Accordion.Content>
			</Accordion.Item>

			<Accordion.Item value="testing" class="explorer-section">
				<Accordion.Header>
					<Accordion.Trigger class="section-trigger">
						<span class="section-chevron" aria-hidden="true">
							<ChevronRight size={11} strokeWidth={2} />
						</span>
						<span class="section-title">TESTING</span>
					</Accordion.Trigger>
				</Accordion.Header>

				<Accordion.Content>
					<div class="section-placeholder">No test tasks have been configured yet.</div>
				</Accordion.Content>
			</Accordion.Item>

			<Accordion.Item value="ports" class="explorer-section">
				<Accordion.Header>
					<Accordion.Trigger class="section-trigger">
						<span class="section-chevron" aria-hidden="true">
							<ChevronRight size={11} strokeWidth={2} />
						</span>
						<span class="section-title">PORTS</span>
					</Accordion.Trigger>
				</Accordion.Header>

				<Accordion.Content>
					<div class="section-placeholder">No forwarded ports are currently active.</div>
				</Accordion.Content>
			</Accordion.Item>
		</div>
	</Accordion.Root>
</ActivityPanel>

{#snippet treeNode(node: FileNode)}
	{#if node.type === 'directory'}
		{@const open = fileTree.isExpanded(node.path)}

		<Button
			variant="ghost"
			tone="neutral"
			size="sm"
			justify="start"
			class={`tree-row ${node.depth === 0 ? 'root' : ''} ${open ? 'open' : ''}`}
			style={`--depth: ${node.depth};`}
			onclick={() => explorer.handleDirClick(node)}
			role="treeitem"
			aria-expanded={open}
		>
			<span class="caret" aria-hidden="true">
				{#if open}
					<ChevronDown size={12} strokeWidth={1.9} />
				{:else}
					<ChevronRight size={12} strokeWidth={1.9} />
				{/if}
			</span>
			<span class="node-icon folder-icon" aria-hidden="true">
				{#if open}
					<FolderOpen size={12} strokeWidth={1.9} />
				{:else}
					<Folder size={12} strokeWidth={1.9} />
				{/if}
			</span>
			<span class="node-label">{node.name}</span>
		</Button>

		{#if open && node.children}
			{#each node.children as child (child.path)}
				{@render treeNode(child)}
			{/each}
		{/if}
	{:else}
		{@const active = editorStore.isActive(node.path)}

		<Button
			variant={active ? 'default' : 'ghost'}
			tone={active ? 'accent' : 'neutral'}
			size="sm"
			justify="start"
			class={`tree-row ${active ? 'active' : ''}`}
			style={`--depth: ${node.depth};`}
			onclick={() => explorer.handleFileClick(node)}
			role="treeitem"
			aria-current={active ? 'true' : undefined}
		>
			<span class="caret" aria-hidden="true"></span>
			<span class="node-icon file-icon" aria-hidden="true">
				<File size={12} strokeWidth={1.9} />
			</span>
			<span class="node-label">{node.name}</span>
		</Button>
	{/if}
{/snippet}

<style>
	/* ── Explorer shell ─────────────────────────────────────── */
	.explorer-content {
		display: flex;
		flex-direction: column;
		height: 100%;
		/* No extra gap/padding — sections handle their own spacing */
	}

	/* ── Accordion sections (VS Code-like) ───────────────────── */
	:global(.explorer-accordion) {
		display: flex;
		flex-direction: column;
		min-height: 0;
	}

	:global(.explorer-section) {
		border-bottom: 1px solid color-mix(in srgb, var(--border) 40%, transparent);
	}

	:global(.explorer-section:last-child) {
		border-bottom: 0;
	}

	:global(.section-trigger) {
		display: flex;
		align-items: center;
		gap: 3px;
		width: 100%;
		height: 28px;
		padding: 0 10px;
		border: 0;
		background: var(--mg);
		cursor: pointer;
		text-align: left;
	}

	:global(.section-trigger:hover) {
		background: color-mix(in srgb, var(--fg) 50%, transparent);
	}

	.section-title {
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.1em;
		color: var(--muted);
		text-transform: uppercase;
		line-height: 1;
	}

	.section-chevron {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 12px;
		height: 12px;
		color: var(--muted);
		transition: transform var(--time) var(--ease);
	}

	:global(.explorer-section[data-state='open'] .section-chevron) {
		transform: rotate(90deg);
	}

	:global(.explorer-section [data-accordion-content]) {
		overflow: hidden;
	}

	.section-placeholder {
		padding: 6px 12px 8px;
		font-size: 11px;
		line-height: 1.4;
		color: var(--muted);
		font-style: italic;
	}

	/* ── Open editors list ──────────────────────────────────── */
	:global([data-button-root].open-editor-btn) {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		height: 22px;
		padding: 0 12px;
		font-size: 11px;
		font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', monospace;
		border-radius: 0;
	}

	:global([data-button-root][data-size='sm'][data-variant='ghost'].open-editor-btn),
	:global([data-button-root][data-size='sm'][data-variant='default'].open-editor-btn) {
		padding: 0 12px;
	}

	.open-editor-dot {
		width: 6px;
		height: 6px;
		border-radius: 999px;
		background: transparent;
		border: 1px solid var(--border);
		flex-shrink: 0;
		transition:
			background var(--time) var(--ease),
			border-color var(--time) var(--ease);
	}

	.open-editor-dot.active {
		background: var(--accent);
		border-color: var(--accent);
	}

	/* ── Status / empty messages ────────────────────────────── */
	.status-msg {
		padding: 6px 12px;
		font-size: 11px;
		color: var(--muted);
		font-style: italic;
	}

	.status-msg.error {
		color: var(--error);
	}

	/* ── File tree ──────────────────────────────────────────── */
	.tree {
		flex: 1;
		overflow-y: auto;
		overflow-x: hidden;
		scrollbar-width: thin;
		scrollbar-color: var(--border) transparent;
		padding: 2px 0;
	}

	.tree::-webkit-scrollbar {
		width: 4px;
	}

	.tree::-webkit-scrollbar-thumb {
		background: var(--border);
		border-radius: 2px;
	}

	/* Tree row buttons */
	:global([data-button-root].tree-row) {
		display: flex;
		align-items: center;
		gap: 3px;
		padding-left: calc(8px + var(--depth, 0) * 14px);
		padding-right: 8px;
		height: 22px;
		white-space: nowrap;
		overflow: hidden;
		width: 100%;
		border-radius: 0;
		font-size: 12px;
		font-family: 'Segoe UI', system-ui, sans-serif;
	}

	:global([data-button-root][data-size='sm'][data-variant='ghost'].tree-row),
	:global([data-button-root][data-size='sm'][data-variant='default'].tree-row) {
		padding-left: calc(8px + var(--depth, 0) * 14px);
		padding-right: 8px;
	}

	:global(.tree-row.root) {
		color: var(--text);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		font-size: 11px;
		height: 26px;
	}

	/* Hover highlight — full-width bar like VSCode */
	:global(.tree-row:hover) {
		background: color-mix(in srgb, var(--fg) 70%, transparent);
	}

	:global(.tree-row.active) {
		background: color-mix(in srgb, var(--accent) 15%, transparent);
	}

	/* ── Caret / icon / label ───────────────────────────────── */
	.caret {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 14px;
		height: 14px;
		flex-shrink: 0;
		color: var(--muted);
		opacity: 0.7;
	}

	.node-icon {
		display: flex;
		align-items: center;
		flex-shrink: 0;
		color: var(--muted);
		transition: color var(--time) var(--ease);
	}

	/* Folder icon turns accent on hover / when open / at root */
	:global(.tree-row:hover) .folder-icon,
	:global(.tree-row.open) .folder-icon,
	:global(.tree-row.root) .folder-icon {
		color: var(--accent);
	}

	/* File icon brightens when hovered or active */
	:global(.tree-row:hover) .file-icon,
	:global(.tree-row.active) .file-icon {
		color: var(--highlight);
	}

	.node-label {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		line-height: 1;
		font-size: 12px;
	}

	:global(.tree-row.root) .node-label {
		font-size: 11px;
	}
</style>
