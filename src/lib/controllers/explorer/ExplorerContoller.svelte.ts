/**
 * Explorer assembly root.
 *
 * The only file allowed to instantiate FileTree + ProjectSync services
 * and compose them with the state store. Returns a single flat API
 * object consumed by Explorer.svelte.
 *
 * Renamed from `ExplorerContoller.svelte.ts` (typo fixed).
 */

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

import type { IDEContext, ProjectDoc } from '$lib/context/ide-context.js';
import type { EditorStore } from '$lib/stores/editor/editor.store.svelte.js';
import type { FileNode } from '$types/editor.js';
import type {
	ActionButton,
	ContextMenuAction,
	ContextMenuState,
	ExplorerDialogState,
	ExplorerDialogIntent,
	TimelineEvent
} from '$types/explorer';

import { createExplorerStateStore } from '$lib/stores/explorer';
import { createFileTree, createProjectSync } from '$lib/services/explorer';

import {
	findNodeByPath,
	projectFolderName,
	filterNodesByQuery,
	getPathsToExpand,
	handleCreateFile,
	handleCreateFolder,
	handleRenameNode,
	handleDeleteNode,
	handleRefreshTree,
	handleExpandAll,
	handleCollapseAll,
	handleRefreshAndExpandAll,
	type ExplorerActionContext
} from '$lib/utils/explorer';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ExplorerControllerDeps = {
	ide: IDEContext;
	editorStore: EditorStore;
};

export type ExplorerController = ReturnType<typeof createExplorerController>;

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createExplorerController({ ide, editorStore }: ExplorerControllerDeps) {
	// ── Services & state ──────────────────────────────────────────────────────

	const state = createExplorerStateStore();

	const fileTree = createFileTree(ide.getWebcontainer, {
		getWorkspaceRootFolders: () =>
			(ide.getWorkspaceProjects?.() ?? []).map((p) => projectFolderName(p))
	});

	const projectSync = createProjectSync({
		getProject: () => ide.getProject(editorStore.activeTabPath ?? undefined),
		getProjectForPath: (path: string) => ide.getProject(path),
		getWebcontainer: ide.getWebcontainer,
		onRemoteOperationApplied: () => Promise.resolve(fileTree.refresh({ silent: true }))
	});

	// ── UI state ($state) ─────────────────────────────────────────────────────

	let openSections = $state<string[]>(['files']);
	let timelineEvents = $state<TimelineEvent[]>([]);
	let contextMenu = $state<ContextMenuState>({ open: false, x: 0, y: 0, path: null });
	let dialogState = $state<ExplorerDialogState>({
		open: false,
		intent: null,
		value: '',
		targetPath: null
	});
	let actionMessage = $state('');
	let actionError = $state('');

	// ── Derived state ─────────────────────────────────────────────────────────

	const tree = $derived(fileTree.tree);
	const treeLoading = $derived(fileTree.loading);
	const treeError = $derived(fileTree.error);
	const filteredTree = $derived(filterNodesByQuery(tree, state.searchQuery));
	const expandOnSearch = $derived(getPathsToExpand(filteredTree));

	const activeProject = $derived(ide.getProject() ?? null);
	const activeProjectFolder = $derived(activeProject ? projectFolderName(activeProject) : null);
	const activeTabPath = $derived(editorStore.activeTabPath);

	// $derived.by() — not $derived(() => ...) — so nodeCount is number | null,
	// not () => number | null.
	const nodeCount = $derived.by<number | null>(() => {
		if (!activeProject) return null;
		return activeProject.nodes.filter((node) => node.type === 'file').length;
	});

	const isOwner = $derived(activeProject?.isOwner ?? false);
	const tabs = $derived(editorStore.tabs);

	// ── Feedback ──────────────────────────────────────────────────────────────

	function addTimelineEvent(kind: TimelineEvent['kind'], label: string, path?: string): void {
		timelineEvents = [
			{
				id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
				at: Date.now(),
				kind,
				label,
				path
			},
			...timelineEvents
		].slice(0, 40);
	}

	function setActionMessage(msg: string): void {
		actionError = '';
		actionMessage = msg;
		addTimelineEvent('action', msg);
		setTimeout(() => {
			if (actionMessage === msg) actionMessage = '';
		}, 3000);
	}

	function setActionError(msg: string): void {
		actionMessage = '';
		actionError = msg;
		addTimelineEvent('error', msg);
		setTimeout(() => {
			if (actionError === msg) actionError = '';
		}, 5000);
	}

	// ── Action context (DI assembly) ──────────────────────────────────────────

	function buildActionContext(overrides?: Partial<ExplorerActionContext>): ExplorerActionContext {
		return {
			fileTree,
			projectSync,
			editorOpenFile: editorStore.openFile,
			getWebcontainer: ide.getWebcontainer,
			getActiveProject: () => ide.getProject() as ProjectDoc | undefined,
			tree,
			selectedPath: state.selectedPath,
			onMessage: setActionMessage,
			onError: setActionError,
			...overrides
		};
	}

	// ── Dialog helpers ────────────────────────────────────────────────────────

	function getSelectedDirectory(): string | null {
		const { selectedPath } = state;
		if (!selectedPath) return null;
		const node = findNodeByPath(tree, selectedPath);
		if (!node) return null;
		if (node.type === 'directory') return node.path;
		const parts = node.path.split('/');
		parts.pop();
		return parts.join('/') || null;
	}

	function suggestPath(kind: 'file' | 'folder'): string {
		const dir = getSelectedDirectory();
		if (kind === 'file') return dir ? `${dir}/new-file.ts` : 'src/new-file.ts';
		return dir ? `${dir}/new-folder` : 'src/new-folder';
	}

	function openCreateDialog(kind: 'file' | 'folder'): void {
		dialogState = {
			open: true,
			intent: kind === 'file' ? 'create-file' : 'create-folder',
			value: suggestPath(kind),
			targetPath: state.selectedPath
		};
	}

	function openRenameDialog(): void {
		if (!state.selectedPath) {
			setActionError('Please select a file or folder first.');
			return;
		}
		dialogState = {
			open: true,
			intent: 'rename',
			value: state.selectedPath,
			targetPath: state.selectedPath
		};
	}

	function openDeleteDialog(): void {
		if (!state.selectedPath) {
			setActionError('Please select a file or folder first.');
			return;
		}
		dialogState = {
			open: true,
			intent: 'delete',
			value: '',
			targetPath: state.selectedPath
		};
	}

	function closeDialog(): void {
		dialogState = { open: false, intent: null, value: '', targetPath: null };
	}

	function setDialogValue(value: string): void {
		dialogState = { ...dialogState, value };
	}

	async function confirmDialog(): Promise<void> {
		if (!dialogState.open || !dialogState.intent) return;
		const ctx = buildActionContext({
			selectedPath: dialogState.targetPath ?? state.selectedPath
		});
		let success = false;

		const intent: ExplorerDialogIntent = dialogState.intent;
		if (intent === 'create-file') success = await handleCreateFile(ctx, dialogState.value);
		else if (intent === 'create-folder') success = await handleCreateFolder(ctx, dialogState.value);
		else if (intent === 'rename') success = await handleRenameNode(ctx, dialogState.value);
		else if (intent === 'delete') success = await handleDeleteNode(ctx);

		if (success) closeDialog();
	}

	// ── Context menu ──────────────────────────────────────────────────────────

	function closeContextMenu(): void {
		contextMenu = { ...contextMenu, open: false };
	}

	function handleContextMenuAction(action: ContextMenuAction): void {
		closeContextMenu();
		if (action === 'new-file') return void openCreateDialog('file');
		if (action === 'new-folder') return void openCreateDialog('folder');
		if (action === 'rename') return void openRenameDialog();
		if (action === 'delete') return void openDeleteDialog();
		return void handleRefreshTree(buildActionContext());
	}

	// ── Node interaction ──────────────────────────────────────────────────────

	function handleFileClick(node: FileNode): void {
		const clickType = state.handleClick(node.path);
		state.selectNode(node.path);
		addTimelineEvent('file-open', `Opened ${node.name}`, node.path);
		if (clickType === 'double' || node.type === 'file') {
			editorStore.openFile(node.path);
		}
	}

	function handleDirClick(node: FileNode): void {
		state.selectNode(node.path);

		if (node.depth === 0) {
			const rootFolder = node.path.split('/')[0] ?? '';
			const project = (ide.getWorkspaceProjects?.() ?? []).find(
				(p) => projectFolderName(p) === rootFolder
			);
			if (project) ide.selectProject?.(project.id);
		}

		fileTree.toggleDir(node.path);
		addTimelineEvent(
			'folder-toggle',
			`${fileTree.isExpanded(node.path) ? 'Expanded' : 'Collapsed'} ${node.name}`,
			node.path
		);
	}

	function handleNodeContextMenu(node: FileNode, event: MouseEvent): void {
		event.preventDefault();
		state.selectNode(node.path);
		contextMenu = { open: true, x: event.clientX, y: event.clientY, path: node.path };
	}

	// ── Toolbar buttons ───────────────────────────────────────────────────────

	const actionButtons: ActionButton[] = [
		{ id: 'new-file', title: 'New File', icon: FilePlus, handler: () => openCreateDialog('file') },
		{
			id: 'new-folder',
			title: 'New Folder',
			icon: FolderPlus,
			handler: () => openCreateDialog('folder')
		},
		{
			id: 'rename',
			title: 'Rename',
			icon: FilePenLine,
			handler: openRenameDialog,
			disabled: () => !state.selectedPath
		},
		{
			id: 'delete',
			title: 'Delete',
			icon: Trash2,
			handler: openDeleteDialog,
			disabled: () => !state.selectedPath
		},
		{ id: 'spacer', isSpacer: true },
		{
			id: 'expand-all',
			title: 'Expand All',
			icon: ChevronRight,
			handler: () => handleExpandAll(buildActionContext())
		},
		{
			id: 'collapse-all',
			title: 'Collapse All',
			icon: ChevronsUpDown,
			handler: () => handleCollapseAll(buildActionContext())
		},
		{
			id: 'refresh',
			title: 'Refresh',
			icon: RefreshCw,
			handler: () => handleRefreshTree(buildActionContext())
		},
		{
			id: 'more-actions',
			title: 'Sync & Expand',
			icon: Ellipsis,
			handler: () => handleRefreshAndExpandAll(buildActionContext())
		}
	];

	// ── Lifecycle ─────────────────────────────────────────────────────────────

	function reset(): void {
		state.reset();
	}

	// ── Public API ────────────────────────────────────────────────────────────

	return {
		// Sections (bindable)
		get openSections() {
			return openSections;
		},
		set openSections(v: string[]) {
			openSections = v;
		},

		// Tree data
		get tree() {
			return tree;
		},
		get filteredTree() {
			return filteredTree;
		},
		get treeLoading() {
			return treeLoading;
		},
		get treeError() {
			return treeError;
		},
		get expandOnSearch() {
			return expandOnSearch;
		},

		// FileTree passthrough (used by useExplorer + Explorer.svelte $effects)
		fileTree,
		isExpanded: (path: string) => fileTree.isExpanded(path),
		toggleDir: (path: string) => fileTree.toggleDir(path),

		// ProjectSync passthrough (used by useExplorer cleanup)
		projectSync,

		// Project info
		get activeProject() {
			return activeProject;
		},
		get activeProjectFolder() {
			return activeProjectFolder;
		},
		get nodeCount() {
			return nodeCount;
		},
		get isOwner() {
			return isOwner;
		},

		// Editor state
		get activeTabPath() {
			return activeTabPath;
		},
		get tabs() {
			return tabs;
		},
		isFileActive: (path: string) => editorStore.isActive(path),
		openFile: (path: string) => editorStore.openFile(path),
		closeTab: (path: string) => editorStore.closeTab(path),

		// Selection / search
		get selectedPath() {
			return state.selectedPath;
		},
		get searchQuery() {
			return state.searchQuery;
		},
		get hasSearch() {
			return state.hasSearch;
		},
		setSearchQuery: (q: string) => state.setSearchQuery(q),
		clearSearch: () => state.clearSearch(),

		// Feedback
		get actionMessage() {
			return actionMessage;
		},
		get actionError() {
			return actionError;
		},
		get timelineEvents() {
			return timelineEvents;
		},

		// Context menu
		get contextMenu() {
			return contextMenu;
		},
		closeContextMenu,
		handleContextMenuAction,

		// Dialog
		get dialogState() {
			return dialogState;
		},
		openCreateDialog,
		openRenameDialog,
		openDeleteDialog,
		closeDialog,
		setDialogValue,
		confirmDialog,

		// Node handlers
		handleFileClick,
		handleDirClick,
		handleNodeContextMenu,

		// Toolbar
		actionButtons,

		// Lifecycle
		reset
	};
}
