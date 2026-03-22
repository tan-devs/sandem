<script lang="ts">
	import {
		ChevronRight,
		RefreshCw,
		FilePlus,
		FolderPlus,
		FilePenLine,
		Trash2,
		ChevronsUpDown,
		Ellipsis
	} from '@lucide/svelte';

	import { requireIDEContext } from '$lib/context/ide/ide-context.js';
	import { createProjectFilesSync } from '$lib/services/explorer/index.js';
	import {
		createFileTree,
		createExplorerActivity,
		createExplorerPanelController
	} from '$lib/controllers/explorer/index.js';
	import { projectFolderName } from '$lib/utils/project/projects.js';
	import { findNodeByPath } from '$lib/utils/editor/fileTreeOps.js';
	import { onMount } from 'svelte';
	import { editorStore } from '$lib/stores/editor/editorStore.svelte.js';
	import Button from '$lib/components/ui/primitives/Button.svelte';
	import FileTreeView from '$lib/components/ui/editor/FileTreeView.svelte';
	import ActivityPanel from './ActivityPanel.svelte';
	import { Accordion } from 'bits-ui';

	const ide = requireIDEContext();
	const fileTree = createFileTree(ide.getWebcontainer, {
		getWorkspaceRootFolders: () =>
			(ide.getWorkspaceProjects?.() ?? []).map((project) => projectFolderName(project.id))
	});
	const projectSync = createProjectFilesSync({
		getProject: () => ide.getProject(editorStore.activeTabPath ?? undefined),
		getProjectForPath: (path: string) => ide.getProject(path),
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

	const explorerPanel = createExplorerPanelController({
		getWorkspaceProjects: () => ide.getWorkspaceProjects?.() ?? [],
		projectFolderName,
		selectProject: ide.selectProject,
		onProjectSelected: () => {
			projectSync.start();
		},
		createProject: ide.createProject,
		renameProject: ide.commitRenameProject,
		deleteProject: ide.confirmDeleteProject,
		handleFileClick: explorer.handleFileClick,
		handleDirClick: explorer.handleDirClick,
		createFolder: explorer.createFolder,
		renamePath: explorer.renamePath,
		deletePath: explorer.deletePath,
		prompt: (message: string, defaultValue?: string) => window.prompt(message, defaultValue),
		confirm: (message: string) => window.confirm(message)
	});

	const tree = $derived(fileTree.tree);
	const treeLoading = $derived(fileTree.loading);
	const treeError = $derived(fileTree.error);
	const selectedTreePath = $derived(explorerPanel.selectedTreePath);
	const actionMessage = $derived(explorer.actionMessage);
	const actionError = $derived(explorer.actionError);
	let openSections = $state<string[]>(['files']);

	const panelActions = [
		{
			key: 'new-file',
			title: 'New file',
			ariaLabel: 'New file',
			onClick: () => void explorer.createFile(),
			icon: FilePlus
		},
		{
			key: 'new-folder',
			title: 'New folder',
			ariaLabel: 'New folder',
			onClick: () => void explorerPanel.createFolderAction(),
			icon: FolderPlus
		},
		{
			key: 'rename-path',
			title: 'Rename path',
			ariaLabel: 'Rename path',
			onClick: () => void explorerPanel.renameAction(),
			icon: FilePenLine
		},
		{
			key: 'delete-path',
			title: 'Delete path',
			ariaLabel: 'Delete path',
			onClick: () => void explorerPanel.deleteAction(),
			icon: Trash2
		},
		{
			key: 'refresh-explorer',
			title: 'Refresh explorer',
			ariaLabel: 'Refresh explorer',
			onClick: () => void explorer.refreshTree(),
			icon: RefreshCw
		},
		{
			key: 'toggle-all-folders',
			title: 'Expand/Collapse all folders',
			ariaLabel: 'Expand or collapse all folders',
			onClick: explorer.toggleAllFolders,
			icon: ChevronsUpDown
		},
		{
			key: 'refresh-and-expand',
			title: 'Refresh and expand all',
			ariaLabel: 'More actions',
			onClick: () => void explorer.refreshAndExpandAll(),
			icon: Ellipsis
		}
	] as const;

	onMount(() => {
		explorer.start();

		return () => {
			explorer.stop();
		};
	});

	$effect(() => {
		const projectCount = (ide.getWorkspaceProjects?.() ?? []).length;
		if (projectCount <= 0) return;
		if (tree.length > 0) return;
		void fileTree.refresh();
	});

	$effect(() => {
		if (tree.length === 0) return;
		if (treeLoading) return;
		const entryPath = ide.getEntryPath();
		if (!entryPath) return;
		const entryNode = findNodeByPath(tree, entryPath);
		if (entryNode && entryNode.type === 'file') {
			explorerPanel.handleFileRowClick(entryNode);
		}
	});
</script>

<ActivityPanel title="EXPLORER">
	{#snippet actions()}
		{#each panelActions as action (action.key)}
			<Button
				variant="ghost"
				tone="neutral"
				size="icon"
				class="panel-icon-action"
				title={action.title}
				aria-label={action.ariaLabel}
				onclick={action.onClick}
			>
				{@const Icon = action.icon}
				<Icon size={12} strokeWidth={1.75} />
			</Button>
		{/each}
	{/snippet}

	<Accordion.Root type="multiple" bind:value={openSections} class="explorer-accordion">
		{#if actionError}
			<div class="status-msg error">{actionError}</div>
		{:else if actionMessage}
			<div class="status-msg">{actionMessage}</div>
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
				{#if tree.length > 0}
					<FileTreeView
						nodes={tree}
						selectedPath={selectedTreePath}
						isExpanded={fileTree.isExpanded}
						isFileActive={(path) => editorStore.isActive(path)}
						onDirClick={explorerPanel.handleDirRowClick}
						onFileClick={explorerPanel.handleFileRowClick}
					/>
				{:else if treeLoading}
					<div class="status-msg">Loading…</div>
				{:else if treeError}
					<div class="status-msg">{treeError}</div>
				{:else}
					<div class="status-msg">No files found.</div>
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
	</Accordion.Root>
</ActivityPanel>

<style>
	/* ── Accordion sections (VS Code-like) ───────────────────── */
	:global(.explorer-accordion) {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
		overflow: hidden;
	}

	:global(.explorer-section) {
		display: flex;
		flex: 0 0 auto;
		flex-direction: column;
		border-bottom: 1px solid color-mix(in srgb, var(--border) 40%, transparent);
	}

	:global(.explorer-section[data-state='open']) {
		flex: 1 1 0;
		min-height: 104px;
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
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	:global(.explorer-section[data-state='open'] [data-accordion-content]) {
		overflow: auto;
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
</style>
