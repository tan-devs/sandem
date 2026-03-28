<script lang="ts">
	import { tick } from 'svelte';
	import { Accordion } from 'bits-ui';

	import type { FileNode } from '$types/editor';
	import type { PROJECT } from '$types/projects';
	import { projectFolderName } from '$lib/utils/projects.js';

	import ExplorerOpenEditors from './ExplorerOpenEditors.svelte';
	import ExplorerFilesSection from './ExplorerFilesSection.svelte';
	import ExplorerProjectInfo from './ExplorerProjectInfo.svelte';
	import ExplorerOutline from './ExplorerOutline.svelte';
	import ExplorerTimeline from './ExplorerTimeline.svelte';

	type ExplorerDialogIntent = 'create-file' | 'create-folder' | 'rename' | 'delete';

	type ExplorerDialogState = {
		open: boolean;
		intent: ExplorerDialogIntent | null;
		value: string;
		targetPath: string | null;
	};

	interface Props {
		openSections: string[];
		tree: FileNode[];
		filteredTree: FileNode[];
		expandOnSearch: Set<string>;
		treeLoading: boolean;
		treeError: string | null;
		activeProject: PROJECT | null;
		actionMessage: string;
		actionError: string;
		selectedPath: string | null;
		activeFilePath: string | null;
		timelineEvents: Array<{
			id: string;
			at: number;
			kind: 'action' | 'error' | 'file-open' | 'folder-toggle';
			label: string;
			path?: string;
		}>;
		searchQuery: string;
		hasSearch: boolean;
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
		onTimelineOpenPath: (path: string) => void;
		onSearchChange: (query: string) => void;
		onSearchClear: () => void;
		dialogState: ExplorerDialogState;
		onDialogValueChange: (value: string) => void;
		onDialogCancel: () => void;
		onDialogConfirm: () => void;
	}

	let {
		openSections = $bindable(),
		tree,
		filteredTree,
		expandOnSearch,
		treeLoading,
		treeError,
		activeProject,
		actionMessage,
		actionError,
		selectedPath,
		activeFilePath,
		timelineEvents,
		searchQuery,
		hasSearch,
		isExpanded,
		onDirClick,
		onFileClick,
		onNodeContextMenu,
		contextMenu,
		onContextMenuAction,
		onCloseContextMenu,
		onTimelineOpenPath,
		onSearchChange,
		onSearchClear,
		dialogState,
		onDialogValueChange,
		onDialogCancel,
		onDialogConfirm
	}: Props = $props();

	let dialogInput: HTMLInputElement | null = $state(null);

	const dialogMeta = $derived.by(() => {
		switch (dialogState.intent) {
			case 'create-file':
				return {
					title: 'Create file',
					description: 'Enter a project-relative file path.',
					confirmLabel: 'Create',
					showInput: true,
					inputLabel: 'File path'
				};
			case 'create-folder':
				return {
					title: 'Create folder',
					description: 'Enter a project-relative folder path.',
					confirmLabel: 'Create',
					showInput: true,
					inputLabel: 'Folder path'
				};
			case 'rename':
				return {
					title: 'Rename path',
					description: 'Enter the new project-relative path.',
					confirmLabel: 'Rename',
					showInput: true,
					inputLabel: 'New path'
				};
			case 'delete':
				return {
					title: 'Delete path',
					description: dialogState.targetPath
						? `Delete ${dialogState.targetPath}? This cannot be undone.`
						: 'Delete selected path? This cannot be undone.',
					confirmLabel: 'Delete',
					showInput: false,
					inputLabel: ''
				};
			default:
				return {
					title: '',
					description: '',
					confirmLabel: 'Confirm',
					showInput: false,
					inputLabel: ''
				};
		}
	});

	$effect(() => {
		if (!dialogState.open || !dialogMeta.showInput) {
			return;
		}

		void tick().then(() => {
			dialogInput?.focus();
			dialogInput?.select();
		});
	});

	function handleDialogKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			onDialogCancel();
		}
	}

	function handleDialogSubmit(event: SubmitEvent) {
		event.preventDefault();
		onDialogConfirm();
	}

	// Compute folder name for project info (supports both workspace summaries with `id`
	// and full project objects with `_id`).
	const folderName = $derived.by(() => {
		if (!activeProject) return null;
		const projectMeta = activeProject as { _id?: string; id?: string; title?: string };
		const projectId = projectMeta._id ?? projectMeta.id;
		if (!projectId) return null;
		return projectFolderName(projectId, projectMeta.title);
	});
</script>

<Accordion.Root type="multiple" bind:value={openSections} class="explorer-content">
	<!-- Status Messages -->
	{#if actionError}
		<div class="status-msg error">{actionError}</div>
	{:else if actionMessage}
		<div class="status-msg success">{actionMessage}</div>
	{/if}

	<!-- Open Editors Child Component -->
	<ExplorerOpenEditors />

	<!-- Files & Folders Child Component -->
	<ExplorerFilesSection
		{tree}
		{filteredTree}
		{treeLoading}
		{treeError}
		{searchQuery}
		{hasSearch}
		{expandOnSearch}
		{selectedPath}
		{isExpanded}
		{onDirClick}
		{onFileClick}
		{onNodeContextMenu}
		{contextMenu}
		{onContextMenuAction}
		{onCloseContextMenu}
		{onSearchChange}
		{onSearchClear}
	/>

	<!-- Project Info Child Component -->
	{#if activeProject}
		<ExplorerProjectInfo {activeProject} projectFolderName={folderName} />
	{/if}

	<!-- Outline Child Component -->
	<ExplorerOutline {activeFilePath} />

	<!-- Timeline Child Component -->
	<ExplorerTimeline events={timelineEvents} onOpenPath={onTimelineOpenPath} />
</Accordion.Root>

{#if dialogState.open && dialogState.intent}
	<div class="explorer-dialog-backdrop" role="presentation" onclick={onDialogCancel}></div>
	<div
		class="explorer-dialog"
		role="dialog"
		aria-modal="true"
		aria-label={dialogMeta.title}
		tabindex="-1"
		onkeydown={handleDialogKeydown}
	>
		<form onsubmit={handleDialogSubmit}>
			<header class="explorer-dialog-header">{dialogMeta.title}</header>
			<p class="explorer-dialog-description">{dialogMeta.description}</p>

			{#if dialogMeta.showInput}
				<label class="explorer-dialog-label" for="explorer-dialog-path"
					>{dialogMeta.inputLabel}</label
				>
				<input
					bind:this={dialogInput}
					id="explorer-dialog-path"
					type="text"
					value={dialogState.value}
					oninput={(event) => onDialogValueChange((event.currentTarget as HTMLInputElement).value)}
					required
				/>
			{/if}

			<div class="explorer-dialog-actions">
				<button type="button" class="dialog-btn secondary" onclick={onDialogCancel}>Cancel</button>
				<button
					type="submit"
					class="dialog-btn"
					class:danger={dialogState.intent === 'delete'}
					disabled={dialogMeta.showInput && !dialogState.value.trim()}
				>
					{dialogMeta.confirmLabel}
				</button>
			</div>
		</form>
	</div>
{/if}

<style>
	/* ── Accordion sections (VS Code-like) ────────────────────── */
	:global(.explorer-content) {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
		overflow: hidden;
		background: color-mix(in srgb, var(--mg) 92%, var(--bg));
	}

	:global(.explorer-content .explorer-section) {
		display: flex;
		flex: 0 0 auto;
		flex-direction: column;
		border-bottom: 1px solid color-mix(in srgb, var(--border) 52%, transparent);
	}

	:global(.explorer-content .explorer-section[data-state='open']) {
		flex: 1 1 0;
		min-height: 104px;
	}

	:global(.explorer-content .explorer-section:last-child) {
		border-bottom: 0;
	}

	:global(.explorer-content .section-trigger) {
		display: flex;
		align-items: center;
		gap: 3px;
		width: 100%;
		height: 28px;
		padding: 0 10px;
		border: 0;
		background: color-mix(in srgb, var(--mg) 90%, var(--bg));
		color: var(--muted);
		cursor: pointer;
		text-align: left;
	}

	:global(.explorer-content .section-trigger:hover) {
		background: color-mix(in srgb, var(--fg) 68%, transparent);
	}

	:global(.explorer-content .section-title) {
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.1em;
		color: var(--muted);
		text-transform: uppercase;
		line-height: 1;
	}

	:global(.explorer-content .section-chevron) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 12px;
		height: 12px;
		color: var(--muted);
		transition: transform var(--time) var(--ease);
	}

	:global(.explorer-content .explorer-section[data-state='open'] .section-chevron) {
		transform: rotate(90deg);
	}

	:global(.explorer-content .explorer-section [data-accordion-content]) {
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	:global(.explorer-content .explorer-section[data-state='open'] [data-accordion-content]) {
		overflow: auto;
	}

	/* ── Status messages ────────────────────────────────────– */
	.status-msg {
		padding: 6px 12px;
		font-size: 11px;
		color: var(--muted);
		font-style: italic;
	}

	.status-msg.error {
		color: var(--error);
	}

	.status-msg.success {
		color: var(--success);
	}

	.explorer-dialog-backdrop {
		position: fixed;
		inset: 0;
		z-index: 40;
		background: color-mix(in srgb, black 24%, transparent);
	}

	.explorer-dialog {
		position: fixed;
		top: 50%;
		left: 50%;
		z-index: 41;
		transform: translate(-50%, -50%);
		width: min(420px, calc(100vw - 28px));
		padding: 14px;
		border-radius: 8px;
		border: 1px solid color-mix(in srgb, var(--border) 76%, transparent);
		background: color-mix(in srgb, var(--mg) 92%, var(--bg));
		display: grid;
		gap: 10px;
		box-shadow:
			0 16px 30px color-mix(in srgb, var(--text) 20%, transparent),
			0 0 0 1px color-mix(in srgb, var(--border) 32%, transparent);
	}

	.explorer-dialog form {
		display: grid;
		gap: 10px;
	}

	.explorer-dialog-header {
		font-size: 13px;
		font-weight: 700;
		color: var(--text);
	}

	.explorer-dialog-description {
		margin: 0;
		font-size: 11px;
		color: var(--muted);
	}

	.explorer-dialog-label {
		font-size: 11px;
		font-weight: 600;
		color: var(--muted);
	}

	.explorer-dialog input {
		width: 100%;
		border: 1px solid color-mix(in srgb, var(--border) 74%, transparent);
		border-radius: 4px;
		padding: 7px 8px;
		font-size: 12px;
		font-family: inherit;
		background: color-mix(in srgb, var(--bg) 88%, var(--fg));
		color: var(--text);
	}

	.explorer-dialog input:focus {
		outline: none;
		border-color: var(--accent);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 28%, transparent);
	}

	.explorer-dialog-actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
	}

	.dialog-btn {
		height: 28px;
		padding: 0 12px;
		border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
		border-radius: 4px;
		background: color-mix(in srgb, var(--accent) 18%, transparent);
		color: var(--text);
		font-size: 11px;
		font-weight: 600;
		cursor: pointer;
	}

	.dialog-btn.secondary {
		background: color-mix(in srgb, var(--fg) 76%, transparent);
	}

	.dialog-btn.danger {
		background: color-mix(in srgb, var(--error) 20%, transparent);
		border-color: color-mix(in srgb, var(--error) 48%, transparent);
		color: var(--error);
	}

	.dialog-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
