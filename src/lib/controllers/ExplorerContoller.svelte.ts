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
import type { EditorStore } from '$lib/stores/editor.store.svelte.js';
import type { FileNode } from '$types/editor.js';
import type {
	ActionButton,
	ContextMenuAction,
	ContextMenuState,
	ExplorerDialogState,
	ExplorerDialogIntent,
	TimelineEvent
} from '$types/explorer';

import { createFileTree } from '$lib/controllers/index.js';
import { projectFilesSync } from '$lib/services/index.js';
import { createExplorerStateController } from '$lib/controllers/StateController.svelte.js';
import { projectFolderName } from '$lib/utils/projects.js';
import { findNodeByPath } from '$lib/utils/file-tree.js';
import { filterNodesByQuery, getPathsToExpand } from '$lib/utils/ide/explorerTreeOps.js';
import {
	handleCreateFile,
	handleCreateFolder,
	handleRenameNode,
	handleDeleteNode,
	handleRefreshTree,
	handleExpandAll,
	handleCollapseAll,
	handleRefreshAndExpandAll,
	type ExplorerActionContext
} from '$lib/services/explorer/createExplorer.svelte.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ExplorerControllerDeps = {
	ide: IDEContext;
	editorStore: EditorStore;
};

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

export function createExplorerController({ ide, editorStore }: ExplorerControllerDeps) {
	// ── Inner controllers ─────────────────────────────────────────────────────

	const explorerState = createExplorerStateController();

	const fileTree = createFileTree(ide.getWebcontainer, {
		getWorkspaceRootFolders: () =>
			(ide.getWorkspaceProjects?.() ?? []).map((p) => projectFolderName(p))
	});

	const projectSync = projectFilesSync({
		getProject: () => ide.getProject(editorStore.activeTabPath ?? undefined),
		getProjectForPath: (path: string) => ide.getProject(path),
		getWebcontainer: ide.getWebcontainer,
		onRemoteOperationApplied: async () => {
			await fileTree.refresh({ silent: true });
		}
	});

	// ── UI state ──────────────────────────────────────────────────────────────

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

	const filteredTree = $derived(filterNodesByQuery(tree, explorerState.searchQuery));
	const expandOnSearch = $derived(getPathsToExpand(filteredTree, explorerState.searchQuery));

	// ide.getProject() returns Project (extends ProjectDoc) — ._id and .name are safe.
	const activeProject = $derived(ide.getProject() ?? null);
	const activeProjectFolder = $derived(activeProject ? projectFolderName(activeProject) : null);
	const activeTabPath = $derived(editorStore.activeTabPath);
	const nodeCount = $derived(activeProject?.nodes.length ?? null);
	const isOwner = $derived(activeProject?.isOwner ?? false);
	const tabs = $derived(editorStore.tabs);

	// ── Feedback ──────────────────────────────────────────────────────────────

	function addTimelineEvent(kind: TimelineEvent['kind'], label: string, path?: string) {
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

	function setActionMessage(msg: string) {
		actionError = '';
		actionMessage = msg;
		addTimelineEvent('action', msg);
		setTimeout(() => {
			if (actionMessage === msg) actionMessage = '';
		}, 3000);
	}

	function setActionError(msg: string) {
		actionMessage = '';
		actionError = msg;
		addTimelineEvent('error', msg);
		setTimeout(() => {
			if (actionError === msg) actionError = '';
		}, 5000);
	}

	// ── Action context ────────────────────────────────────────────────────────

	function buildActionContext(overrides?: Partial<ExplorerActionContext>): ExplorerActionContext {
		return {
			fileTree,
			projectSync,
			editorOpenFile: editorStore.openFile,
			getWebcontainer: ide.getWebcontainer,
			getActiveProject: () => ide.getProject() as ProjectDoc | undefined,
			tree,
			selectedPath: explorerState.selectedPath,
			onMessage: setActionMessage,
			onError: setActionError,
			...overrides
		};
	}

	// ── Dialog helpers ────────────────────────────────────────────────────────

	function getSelectedDirectory(): string | null {
		const { selectedPath } = explorerState;
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

	function openCreateDialog(kind: 'file' | 'folder') {
		dialogState = {
			open: true,
			intent: kind === 'file' ? 'create-file' : 'create-folder',
			value: suggestPath(kind),
			targetPath: explorerState.selectedPath
		};
	}

	function openRenameDialog() {
		if (!explorerState.selectedPath) {
			setActionError('Please select a file or folder first.');
			return;
		}
		dialogState = {
			open: true,
			intent: 'rename',
			value: explorerState.selectedPath,
			targetPath: explorerState.selectedPath
		};
	}

	function openDeleteDialog() {
		if (!explorerState.selectedPath) {
			setActionError('Please select a file or folder first.');
			return;
		}
		dialogState = {
			open: true,
			intent: 'delete',
			value: '',
			targetPath: explorerState.selectedPath
		};
	}

	function closeDialog() {
		dialogState = { open: false, intent: null, value: '', targetPath: null };
	}

	function setDialogValue(value: string) {
		dialogState = { ...dialogState, value };
	}

	async function confirmDialog() {
		if (!dialogState.open || !dialogState.intent) return;
		const ctx = buildActionContext({
			selectedPath: dialogState.targetPath ?? explorerState.selectedPath
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

	function closeContextMenu() {
		contextMenu = { ...contextMenu, open: false };
	}

	function handleContextMenuAction(action: ContextMenuAction) {
		closeContextMenu();
		if (action === 'new-file') return void openCreateDialog('file');
		if (action === 'new-folder') return void openCreateDialog('folder');
		if (action === 'rename') return void openRenameDialog();
		if (action === 'delete') return void openDeleteDialog();
		return void handleRefreshTree(buildActionContext());
	}

	// ── Node interaction ──────────────────────────────────────────────────────

	function handleFileClick(node: FileNode) {
		const clickType = explorerState.handleClick(node.path);
		explorerState.selectNode(node.path);
		addTimelineEvent('file-open', `Opened ${node.name}`, node.path);
		if (clickType === 'double' || node.type === 'file') {
			editorStore.openFile(node.path);
		}
	}

	function handleDirClick(node: FileNode) {
		explorerState.selectNode(node.path);

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

	function handleNodeContextMenu(node: FileNode, event: MouseEvent) {
		event.preventDefault();
		explorerState.selectNode(node.path);
		contextMenu = { open: true, x: event.clientX, y: event.clientY, path: node.path };
	}

	// ── Toolbar action buttons ────────────────────────────────────────────────

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
			disabled: () => !explorerState.selectedPath
		},
		{
			id: 'delete',
			title: 'Delete',
			icon: Trash2,
			handler: openDeleteDialog,
			disabled: () => !explorerState.selectedPath
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

	function reset() {
		explorerState.reset();
	}

	// ── Public API ────────────────────────────────────────────────────────────

	return {
		// Bindable display state
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

		// File tree passthrough (used by Explorer.svelte $effects)
		isExpanded: (path: string) => fileTree.isExpanded(path),
		toggleDir: (path: string) => fileTree.toggleDir(path),

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

		// Editor state passthrough
		get activeTabPath() {
			return activeTabPath;
		},
		get tabs() {
			return tabs;
		},
		isFileActive: (path: string) => editorStore.isActive(path),
		openFile: (path: string) => editorStore.openFile(path),
		closeTab: (path: string) => editorStore.closeTab(path),

		// Explorer selection / search
		get selectedPath() {
			return explorerState.selectedPath;
		},
		get searchQuery() {
			return explorerState.searchQuery;
		},
		get hasSearch() {
			return explorerState.hasSearch;
		},
		setSearchQuery: (q: string) => explorerState.setSearchQuery(q),
		clearSearch: () => explorerState.clearSearch(),

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

		// Services exposed for useExplorerLifecycle
		fileTree,
		projectSync,

		// Lifecycle
		reset
	};
}

export type ExplorerController = ReturnType<typeof createExplorerController>;
