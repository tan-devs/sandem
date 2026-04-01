import { useConvexClient } from 'convex-svelte';
import type { FunctionReference, FunctionArgs, FunctionReturnType } from 'convex/server';
import type { Doc, Id } from '$convex/_generated/dataModel.js';
import { api } from '$convex/_generated/api.js';
import type { WebContainer } from '@webcontainer/api';
import { getLiveblocksClient } from '$lib/liveblocks.config.js';
import { appendTerminalAudit, collaborationPermissionsStore } from '$lib/stores/collaboration';

// ---------------------------------------------------------------------------
// Types — straight from the generated dataModel, no hand-written duplicates
// ---------------------------------------------------------------------------

type ProjectDoc = Doc<'projects'>;
type NodeDoc = Doc<'nodes'>;

// ---------------------------------------------------------------------------
// Shared Convex client type (re-exported so RepoProjectsController can import it)
// ---------------------------------------------------------------------------

export type ConvexOperations = {
	mutation: <M extends FunctionReference<'mutation'>>(
		ref: M,
		args: FunctionArgs<M>
	) => Promise<FunctionReturnType<M>>;
	query: <Q extends FunctionReference<'query'>>(
		ref: Q,
		args: FunctionArgs<Q>
	) => Promise<FunctionReturnType<Q>>;
};

// ---------------------------------------------------------------------------
// Project manager (CRUD on project cards in the sidebar)
// ---------------------------------------------------------------------------

type ProjectManagerOptions = {
	getProjects: () => ProjectDoc[];
	setProjects: (projects: ProjectDoc[]) => void;
	getActiveProjectId: () => string | null;
	setActiveProjectId: (projectId: string | null) => void;
	ownerId: () => string;
	convexClient: ConvexOperations;
	onError: (err: Error, cause?: unknown) => void;
};

export function createRepoProjectManager(options: ProjectManagerOptions) {
	let creatingProject = false;
	let mutatingProjectId: string | null = null;

	async function createProjectCard() {
		if (creatingProject) return;
		creatingProject = true;
		try {
			const projectId = await options.convexClient.mutation(api.projects.createProject, {
				ownerId: options.ownerId() as Id<'users'>,
				name: 'Untitled Project',
				isPublic: false
			});

			const project = await options.convexClient.query(api.projects.getProject, {
				id: projectId
			});

			if (project) {
				options.setProjects([...options.getProjects(), project]);
				options.setActiveProjectId(projectId);
			}
		} catch (err) {
			options.onError(err instanceof Error ? err : new Error(String(err)), err);
		} finally {
			creatingProject = false;
		}
	}

	async function commitRename(projectId: string, nextName: string) {
		if (mutatingProjectId) return;
		mutatingProjectId = projectId;
		try {
			await options.convexClient.mutation(api.projects.updateProject, {
				id: projectId as Id<'projects'>,
				name: nextName
			});

			options.setProjects(
				options.getProjects().map((p) => (p._id === projectId ? { ...p, name: nextName } : p))
			);
		} catch (err) {
			options.onError(err instanceof Error ? err : new Error(String(err)), err);
		} finally {
			mutatingProjectId = null;
		}
	}

	async function confirmDelete(projectId: string) {
		if (mutatingProjectId) return;
		mutatingProjectId = projectId;
		try {
			await options.convexClient.mutation(api.projects.deleteProject, {
				id: projectId as Id<'projects'>
			});

			const nextProjects = options.getProjects().filter((p) => p._id !== projectId);
			options.setProjects(nextProjects);

			if (options.getActiveProjectId() === projectId) {
				options.setActiveProjectId(nextProjects[0]?._id ?? null);
			}
		} catch (err) {
			options.onError(err instanceof Error ? err : new Error(String(err)), err);
		} finally {
			mutatingProjectId = null;
		}
	}

	return {
		get creatingProject() {
			return creatingProject;
		},
		get mutatingProjectId() {
			return mutatingProjectId;
		},
		createProjectCard,
		commitRename,
		confirmDelete
	};
}

// ---------------------------------------------------------------------------
// Filesystem sync (nodes table ↔ WebContainer ↔ Liveblocks broadcasts)
// ---------------------------------------------------------------------------

type FsEvent = Extract<Liveblocks['RoomEvent'], { type: 'fs-op' }>;

type FileSyncOptions = {
	/** Returns the currently active project. */
	getProject: () => ProjectDoc | undefined;
	/** Optional: resolve a project by WC path prefix (multi-project workspaces). */
	getProjectForPath?: (path: string) => ProjectDoc | undefined;
	getWebcontainer: () => WebContainer;
	onRemoteOperationApplied?: () => Promise<void> | void;
};

export function projectFilesSync(options: FileSyncOptions) {
	// Convex client — unavailable in demo/guest mode (no provider).
	let convexClient: ReturnType<typeof useConvexClient> | null = null;
	try {
		convexClient = useConvexClient();
	} catch {
		// No ConvexProvider — demo or guest session.
	}

	// Collaboration permission state.
	let permissions = { canWrite: true, roomId: null as string | null };
	const unsubPermissions = collaborationPermissionsStore.subscribe((value) => {
		permissions = value;
	});

	// Liveblocks room state.
	let leaveRoom: (() => void) | undefined;
	let roomRef: ReturnType<ReturnType<typeof getLiveblocksClient>['enterRoom']>['room'] | undefined;
	let unsubscribeEvents: (() => void) | undefined;
	let currentRoomId: string | null = null;
	const seenOperationIds = new Set<string>();

	// ── Helpers ──────────────────────────────────────────────────────────────

	function canWrite() {
		return permissions.canWrite;
	}

	function operationId(prefix: string) {
		return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
	}

	function resolveProject(path?: string): ProjectDoc | undefined {
		if (path) {
			const byPath = options.getProjectForPath?.(path);
			if (byPath) return byPath;
		}
		return options.getProject();
	}

	/**
	 * Strip the workspace folder prefix from a WebContainer path to get
	 * the project-relative path to send to upsertFile/renameNode/deleteNode.
	 * The server handles both rooted (/src/App.tsx) and bare (src/App.tsx) forms.
	 */
	function toNodePath(wcPath: string): string {
		const stripped = wcPath.replace(/^\/+/, '');
		const parts = stripped.split('/').filter(Boolean);
		// Drop the leading folder segment (the project folder name).
		return parts.length > 1 ? parts.slice(1).join('/') : stripped;
	}

	// ── Liveblocks room management ────────────────────────────────────────────

	function ensureRoomForProject(project: ProjectDoc | undefined) {
		if (!project?.room) return;
		if (currentRoomId === project.room && roomRef) return;

		unsubscribeEvents?.();
		unsubscribeEvents = undefined;
		leaveRoom?.();
		leaveRoom = undefined;
		roomRef = undefined;

		const client = getLiveblocksClient();
		const entered = client.enterRoom(project.room, {
			initialPresence: { cursor: null, selection: null }
		});

		leaveRoom = entered.leave;
		roomRef = entered.room;
		currentRoomId = project.room;

		unsubscribeEvents = roomRef.subscribe('event', ({ event }) => {
			if (isFsEvent(event)) void applyRemoteFsOperation(event);
		});
	}

	function isFsEvent(value: unknown): value is FsEvent {
		if (!value || typeof value !== 'object') return false;
		const c = value as { type?: unknown; op?: unknown; path?: unknown; opId?: unknown };
		return (
			c.type === 'fs-op' &&
			(c.op === 'create' || c.op === 'rename' || c.op === 'delete') &&
			typeof c.path === 'string' &&
			typeof c.opId === 'string'
		);
	}

	async function broadcastFsOperation(event: FsEvent, project?: ProjectDoc) {
		const targetProject = project ?? options.getProject();
		ensureRoomForProject(targetProject);
		if (!targetProject?.room || !roomRef) return;

		seenOperationIds.add(event.opId);
		roomRef.broadcastEvent(event);
		appendTerminalAudit({
			at: Date.now(),
			command: `fs:${event.op} ${event.path}${event.nextPath ? ` -> ${event.nextPath}` : ''}`,
			allowed: true,
			roomId: targetProject.room
		});
	}

	// ── Node lookup helper ────────────────────────────────────────────────────

	async function findNodeByWcPath(
		projectId: Id<'projects'>,
		wcPath: string
	): Promise<NodeDoc | undefined> {
		const nodes = await convexClient!.query(api.filesystem.listNodes, { projectId });
		const nodePath = toNodePath(wcPath);
		// Nodes are stored with a leading slash: /src/App.tsx
		return nodes.find((n) => n.path === `/${nodePath}` || n.path === nodePath);
	}

	// ── Remote operation handler ──────────────────────────────────────────────

	async function applyRemoteFsOperation(event: FsEvent) {
		if (seenOperationIds.has(event.opId)) return;
		seenOperationIds.add(event.opId);

		const wc = options.getWebcontainer();
		const project = resolveProject(event.path);
		if (!project) return;

		if (event.op === 'create') {
			if (event.isDirectory) {
				await wc.fs.mkdir(event.path, { recursive: true });
			} else {
				const content = event.contents ?? '';
				const parts = event.path.split('/');
				if (parts.length > 1) {
					await wc.fs.mkdir(parts.slice(0, -1).join('/'), { recursive: true });
				}
				await wc.fs.writeFile(event.path, content, 'utf-8');

				if (convexClient) {
					await convexClient.mutation(api.filesystem.upsertFile, {
						projectId: project._id,
						path: toNodePath(event.path),
						content
					});
				}
			}
		}

		if (event.op === 'rename' && event.nextPath) {
			await wc.fs.rename(event.path, event.nextPath);

			if (convexClient) {
				const node = await findNodeByWcPath(project._id, event.path);
				if (node) {
					await convexClient.mutation(api.filesystem.renameNode, {
						id: node._id,
						newName: event.nextPath.split('/').pop() ?? ''
					});
				}
			}
		}

		if (event.op === 'delete') {
			await wc.fs.rm(event.path, { recursive: true, force: true });

			if (convexClient) {
				const node = await findNodeByWcPath(project._id, event.path);
				if (node) {
					await convexClient.mutation(api.filesystem.deleteNode, { id: node._id });
				}
			}
		}

		await options.onRemoteOperationApplied?.();
	}

	// ── Public file operations ────────────────────────────────────────────────

	async function upsertFile(path: string, content: string, project?: ProjectDoc) {
		const targetProject = project ?? resolveProject(path);
		if (!convexClient || !targetProject) return;

		await convexClient.mutation(api.filesystem.upsertFile, {
			projectId: targetProject._id,
			path: toNodePath(path),
			content
		});
	}

	async function createFile(path: string, contents: string) {
		if (!canWrite()) return;
		const project = resolveProject(path);
		if (!project) return;

		await upsertFile(path, contents, project);

		await broadcastFsOperation(
			{
				type: 'fs-op',
				opId: operationId('create-file'),
				actorId: String(project.ownerId),
				op: 'create',
				path,
				contents,
				isDirectory: false,
				ts: Date.now()
			},
			project
		);
	}

	async function createDirectory(path: string) {
		if (!canWrite()) return;
		const project = resolveProject(path);
		if (!project) return;

		await broadcastFsOperation(
			{
				type: 'fs-op',
				opId: operationId('create-dir'),
				actorId: String(project.ownerId),
				op: 'create',
				path,
				isDirectory: true,
				ts: Date.now()
			},
			project
		);
	}

	async function renamePath(path: string, nextPath: string) {
		if (!canWrite()) return;
		const project = resolveProject(path) ?? resolveProject(nextPath);
		if (!project || !convexClient) return;

		const node = await findNodeByWcPath(project._id, path);
		if (node) {
			await convexClient.mutation(api.filesystem.renameNode, {
				id: node._id,
				newName: nextPath.split('/').pop() ?? ''
			});
		}

		await broadcastFsOperation(
			{
				type: 'fs-op',
				opId: operationId('rename'),
				actorId: String(project.ownerId),
				op: 'rename',
				path,
				nextPath,
				ts: Date.now()
			},
			project
		);
	}

	async function deletePath(path: string) {
		if (!canWrite()) return;
		const project = resolveProject(path);
		if (!project || !convexClient) return;

		const node = await findNodeByWcPath(project._id, path);
		if (node) {
			await convexClient.mutation(api.filesystem.deleteNode, { id: node._id });
		}

		await broadcastFsOperation(
			{
				type: 'fs-op',
				opId: operationId('delete'),
				actorId: String(project.ownerId),
				op: 'delete',
				path,
				ts: Date.now()
			},
			project
		);
	}

	// ── Lifecycle ─────────────────────────────────────────────────────────────

	function start() {
		ensureRoomForProject(options.getProject());
	}

	function stop() {
		unsubscribeEvents?.();
		unsubscribeEvents = undefined;
		leaveRoom?.();
		leaveRoom = undefined;
		roomRef = undefined;
		currentRoomId = null;
		unsubPermissions();
	}

	return {
		start,
		stop,
		canWrite,
		upsertFile,
		createFile,
		createDirectory,
		renamePath,
		deletePath
	};
}
