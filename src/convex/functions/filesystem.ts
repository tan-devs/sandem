import { mutation, query } from '../_generated/server.js';
import type { MutationCtx } from '../_generated/server.js';
import { v } from 'convex/values';
import type { Id } from '../_generated/dataModel.js';
import { normalizeNodePath, getParentNodePath } from '../utils/paths.js';
import { folderNameFromProject } from '../utils/project.js';
import { buildWebContainerTree } from '../utils/vfs.js';

// ─── Write-access guard ───────────────────────────────────────────────────────

async function assertProjectWriteAccess(
	ctx: MutationCtx,
	project: { _id: Id<'projects'>; ownerId: Id<'users'> }
): Promise<void> {
	const identity = await ctx.auth.getUserIdentity();
	if (!identity) throw new Error('Guest users cannot modify project files.');

	const user = await ctx.db
		.query('users')
		.withIndex('by_tokenIdentifier', (q) => q.eq('tokenIdentifier', identity.tokenIdentifier))
		.first();

	if (!user) throw new Error('Authenticated user not found.');
	if (user._id !== project.ownerId)
		throw new Error('Read-only: only the project owner can modify files.');
}

// ─── Folder-path creator (shared by upsertFile) ───────────────────────────────

/**
 * Walk `parentPath` segments and ensure every ancestor folder node exists.
 * Returns the deepest folder's node ID (used as parentId for the file node).
 */
async function ensureFolderPath(
	ctx: MutationCtx,
	projectId: Id<'projects'>,
	parentPath: string,
	now: number
): Promise<Id<'nodes'> | undefined> {
	// Fast path: parent folder already exists
	const existingParent = await ctx.db
		.query('nodes')
		.withIndex('by_project_path', (q) => q.eq('projectId', projectId).eq('path', parentPath))
		.first();

	if (existingParent) return existingParent._id;

	// Slow path: walk the segments and create any missing folders
	let lastId: Id<'nodes'> | undefined;
	let accumPath = '';

	for (const segment of parentPath.replace(/^\//, '').split('/')) {
		accumPath += `/${segment}`;

		let folderNode = await ctx.db
			.query('nodes')
			.withIndex('by_project_path', (q) => q.eq('projectId', projectId).eq('path', accumPath))
			.first();

		if (!folderNode) {
			const insertedId = await ctx.db.insert('nodes', {
				projectId,
				path: accumPath,
				name: segment,
				type: 'folder',
				parentId: lastId,
				createdAt: now,
				updatedAt: now
			});
			folderNode = await ctx.db.get(insertedId);
		}

		if (!folderNode) throw new Error(`Failed to create parent folder "${accumPath}".`);
		lastId = folderNode._id;
	}

	return lastId;
}

// ─── Node CRUD ────────────────────────────────────────────────────────────────

/** Create a file or folder node inside a project. Throws on duplicate path. */
export const createNode = mutation({
	args: {
		projectId: v.id('projects'),
		path: v.string(),
		name: v.string(),
		type: v.union(v.literal('file'), v.literal('folder')),
		content: v.optional(v.string()),
		parentId: v.optional(v.id('nodes'))
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query('nodes')
			.withIndex('by_project_path', (q) => q.eq('projectId', args.projectId).eq('path', args.path))
			.first();

		if (existing) throw new Error(`A node already exists at "${args.path}".`);

		const now = Date.now();
		return ctx.db.insert('nodes', {
			projectId: args.projectId,
			path: args.path,
			name: args.name,
			type: args.type,
			content: args.type === 'file' ? (args.content ?? '') : undefined,
			parentId: args.parentId,
			createdAt: now,
			updatedAt: now
		});
	}
});

/** Update a file node's content. Throws if the node is a folder. */
export const updateNodeContent = mutation({
	args: { id: v.id('nodes'), content: v.string() },
	handler: async (ctx, args) => {
		const node = await ctx.db.get(args.id);
		if (!node) throw new Error('Node not found.');
		if (node.type !== 'file') throw new Error('Cannot set content on a folder node.');

		await ctx.db.patch(args.id, { content: args.content, updatedAt: Date.now() });
		return true;
	}
});

/**
 * Upsert a file by workspace-relative path.
 *
 * Path format: `<project-folder>/<file-path>` e.g. `my-app-abc123/src/App.tsx`
 *
 * Prefer passing `projectId` when the caller already has it — this skips the
 * folder-name lookup entirely and is significantly faster.
 *
 * Called by createLiveblocksEditorSync on every lazy Convex persist (3 s debounce).
 */
export const upsertFile = mutation({
	args: {
		path: v.string(),
		content: v.string(),
		/** Skip the folder-name scan by passing the project ID directly. */
		projectId: v.optional(v.id('projects'))
	},
	handler: async (ctx, args) => {
		const now = Date.now();

		// ── Resolve project ───────────────────────────────────────────────────
		type ProjectReference = { _id: Id<'projects'>; ownerId: Id<'users'>; name?: string };
		let project: ProjectReference | null = null;
		let projectRelativePath: string;

		if (args.projectId) {
			// Fast path: caller supplied the projectId — no scan needed.
			const fetched = await ctx.db.get(args.projectId);
			if (!fetched) throw new Error(`Project "${args.projectId}" not found.`);
			project = fetched as ProjectReference;

			// Strip the leading folder segment if it was included in the path.
			const normalized = args.path.replace(/^\/+/g, '');
			const parts = normalized.split('/').filter(Boolean);
			const expectedFolder = folderNameFromProject(project);
			projectRelativePath = parts[0] === expectedFolder ? parts.slice(1).join('/') : normalized;
		} else {
			// Slow path: derive project from the folder-name prefix in the path.
			// Avoid this in hot paths — pass projectId instead.
			const normalized = args.path.replace(/^\/+/, '');
			const parts = normalized.split('/').filter(Boolean);

			if (parts.length < 2) {
				throw new Error('upsertFile: path must include a project folder prefix and a file path.');
			}

			const folderName = parts[0];
			const allProjects = await ctx.db
				.query('projects')
				.withIndex('by_owner', (q) => q.gte('ownerId', '' as Id<'users'>))
				.collect();

			const match = allProjects.find((p) => folderNameFromProject(p) === folderName);
			if (!match) throw new Error(`No project found for folder "${folderName}".`);

			project = match as ProjectReference;
			projectRelativePath = parts.slice(1).join('/');
		}

		if (!projectRelativePath) throw new Error('upsertFile: empty file path after project prefix.');
		if (!project) throw new Error('upsertFile: project resolution failed.');

		// ── Auth check ────────────────────────────────────────────────────────
		await assertProjectWriteAccess(ctx, project);

		// ── Ensure ancestor folders ───────────────────────────────────────────
		const nodePath = normalizeNodePath(projectRelativePath);
		const parentPath = getParentNodePath(nodePath);
		const parentId = parentPath
			? await ensureFolderPath(ctx, project._id, parentPath, now)
			: undefined;

		// ── Upsert the file node ──────────────────────────────────────────────
		const existingFile = await ctx.db
			.query('nodes')
			.withIndex('by_project_path', (q) => q.eq('projectId', project!._id).eq('path', nodePath))
			.first();

		if (existingFile) {
			if (existingFile.type !== 'file')
				throw new Error('Cannot overwrite a folder with file content.');
			await ctx.db.patch(existingFile._id, { content: args.content, updatedAt: now });
		} else {
			await ctx.db.insert('nodes', {
				projectId: project._id,
				path: nodePath,
				name: nodePath.split('/').pop() ?? '',
				type: 'file',
				content: args.content,
				parentId,
				createdAt: now,
				updatedAt: now
			});
		}

		return true;
	}
});

/** Rename a node and cascade the path update to all descendants. */
export const renameNode = mutation({
	args: { id: v.id('nodes'), newName: v.string() },
	handler: async (ctx, args) => {
		const node = await ctx.db.get(args.id);
		if (!node) throw new Error('Node not found.');

		const parentPath = node.path.substring(0, node.path.lastIndexOf('/'));
		const newPath = `${parentPath}/${args.newName}`;
		const now = Date.now();

		await ctx.db.patch(args.id, { name: args.newName, path: newPath, updatedAt: now });

		if (node.type === 'folder') {
			const allNodes = await ctx.db
				.query('nodes')
				.withIndex('by_project_path', (q) => q.eq('projectId', node.projectId))
				.collect();

			const oldPrefix = node.path + '/';
			for (const child of allNodes) {
				if (child.path.startsWith(oldPrefix)) {
					await ctx.db.patch(child._id, {
						path: newPath + '/' + child.path.slice(oldPrefix.length),
						updatedAt: now
					});
				}
			}
		}

		return true;
	}
});

/** Delete a node and cascade to all descendants if it is a folder. */
export const deleteNode = mutation({
	args: { id: v.id('nodes') },
	handler: async (ctx, args) => {
		const node = await ctx.db.get(args.id);
		if (!node) throw new Error('Node not found.');

		await ctx.db.delete(args.id);

		if (node.type === 'folder') {
			const allNodes = await ctx.db
				.query('nodes')
				.withIndex('by_project_path', (q) => q.eq('projectId', node.projectId))
				.collect();

			const prefix = node.path + '/';
			for (const child of allNodes) {
				if (child.path.startsWith(prefix)) await ctx.db.delete(child._id);
			}
		}

		return true;
	}
});

// ─── Queries ──────────────────────────────────────────────────────────────────

/** All nodes for a project — used to build the sidebar file tree. */
export const listNodes = query({
	args: { projectId: v.id('projects') },
	handler: async (ctx, args) =>
		ctx.db
			.query('nodes')
			.withIndex('by_project_path', (q) => q.eq('projectId', args.projectId))
			.collect()
});

/** Direct children of a folder (root-level nodes if parentId is omitted). */
export const listChildren = query({
	args: {
		projectId: v.id('projects'),
		parentId: v.optional(v.id('nodes'))
	},
	handler: async (ctx, args) =>
		ctx.db
			.query('nodes')
			.withIndex('by_parent', (q) =>
				q.eq('projectId', args.projectId).eq('parentId', args.parentId)
			)
			.collect()
});

/**
 * All nodes for a project formatted as the nested tree WebContainer's
 * `mount()` expects.
 */
export const getWebContainerTree = query({
	args: { projectId: v.id('projects') },
	handler: async (ctx, args) => {
		const nodes = await ctx.db
			.query('nodes')
			.withIndex('by_project_path', (q) => q.eq('projectId', args.projectId))
			.collect();

		return buildWebContainerTree(
			nodes.map((n) => ({ path: n.path, type: n.type, content: n.content }))
		);
	}
});

/**
 * Root workspace tree for all projects owned by a user.
 * Mount this directly at `/` in WebContainer to get the multi-project layout.
 */
export const getWorkspaceTree = query({
	args: { ownerId: v.id('users') },
	handler: async (ctx, args) => {
		if (!args.ownerId) return {};

		const projects = await ctx.db
			.query('projects')
			.withIndex('by_owner', (q) => q.eq('ownerId', args.ownerId))
			.collect();

		const workspaceTree: Record<string, unknown> = {
			'package.json': {
				file: {
					contents: JSON.stringify(
						{ name: 'sandem-workspace', private: true, version: '0.0.0', workspaces: ['*'] },
						null,
						2
					)
				}
			}
		};

		for (const project of projects) {
			const nodes = await ctx.db
				.query('nodes')
				.withIndex('by_project_path', (q) => q.eq('projectId', project._id))
				.collect();

			workspaceTree[folderNameFromProject(project)] = {
				directory: buildWebContainerTree(
					nodes.map((n) => ({ path: n.path, type: n.type, content: n.content }))
				)
			};
		}

		return workspaceTree;
	}
});
