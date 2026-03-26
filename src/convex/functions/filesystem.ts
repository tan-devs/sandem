import { mutation, query } from '../_generated/server.js';
import { v } from 'convex/values';
import type { Id } from '../_generated/dataModel.js';
import { seedStarterProjectForOwner } from './projects.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Fallback UUID for environments where crypto.randomUUID is unavailable. */
function generateId(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Build the nested object format WebContainers expects to boot:
 *   { "src": { directory: { "utils.js": { file: { contents: "..." } } } } }
 */
function buildWebContainerTree(
	nodes: Array<{
		path: string;
		type: 'file' | 'folder';
		content?: string;
	}>
): Record<string, unknown> {
	const root: Record<string, unknown> = {};

	// Sort so folders are processed before their children
	const sorted = [...nodes].sort((a, b) => a.path.localeCompare(b.path));

	for (const node of sorted) {
		// Strip leading slash, split into segments: "/src/utils.js" → ["src", "utils.js"]
		const segments = node.path.replace(/^\//, '').split('/').filter(Boolean);
		if (segments.length === 0) continue;

		let cursor = root;

		for (let i = 0; i < segments.length - 1; i++) {
			const seg = segments[i];
			if (!cursor[seg]) {
				cursor[seg] = { directory: {} };
			}
			cursor = (cursor[seg] as { directory: Record<string, unknown> }).directory;
		}

		const leaf = segments[segments.length - 1];
		if (node.type === 'folder') {
			cursor[leaf] = cursor[leaf] ?? { directory: {} };
		} else {
			cursor[leaf] = { file: { contents: node.content ?? '' } };
		}
	}

	return root;
}

// ---------------------------------------------------------------------------
// Helpers for project + node write access
// ---------------------------------------------------------------------------

function normalizeNodePath(path: string): string {
	if (!path) return '/';
	return path.startsWith('/') ? path : `/${path}`;
}

function getParentNodePath(path: string): string {
	const normalized = normalizeNodePath(path);
	if (normalized === '/' || normalized === '') return '';
	const lastSlash = normalized.lastIndexOf('/');
	if (lastSlash <= 0) return '';
	return normalized.substring(0, lastSlash);
}

function folderNameFromProject(project: { name?: string; title?: string; _id: string }): string {
	const raw = project.name || project.title || project._id;
	const slug = String(raw)
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
	return slug || String(project._id);
}

async function findProjectByFolderName(ctx: { db: any; auth: any }, folderName: string) {
	const projects = await ctx.db.query('projects').collect();
	for (const project of projects) {
		if (folderNameFromProject(project) === folderName) {
			return project;
		}
	}
	return null;
}

async function assertProjectWriteAccess(
	ctx: { db: any; auth: any },
	project: { ownerId: string; isPublic?: boolean }
) {
	const identity = await ctx.auth.getUserIdentity();
	if (!identity) {
		throw new Error('Guest users cannot modify project files.');
	}
	const user = await ctx.db
		.query('users')
		.withIndex('by_tokenIdentifier', (q: any) => q.eq('tokenIdentifier', identity.tokenIdentifier))
		.first();
	if (!user) {
		throw new Error('Authenticated user not found.');
	}
	if (String(user._id) !== String(project.ownerId)) {
		throw new Error('Read-only: only project owner can modify files.');
	}
}

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

export const ensureUserIdentity = mutation({
	args: {
		/** Pass only for guest sessions — authenticated users are resolved via ctx.auth. */
		guestId: v.optional(v.string())
	},
	handler: async (ctx, args) => {
		const now = Date.now();

		// --- Authenticated user path ---
		const identity = await ctx.auth.getUserIdentity();
		if (identity) {
			const tokenIdentifier = identity.tokenIdentifier;

			const existing = await ctx.db
				.query('users')
				.withIndex('by_tokenIdentifier', (q: any) => q.eq('tokenIdentifier', tokenIdentifier))
				.first();

			if (existing) {
				await ctx.db.patch(existing._id, { lastSeen: now });
				return { convexUserId: existing._id, isGuest: false };
			}

			const id = await ctx.db.insert('users', {
				tokenIdentifier,
				username: identity.name ?? identity.email ?? tokenIdentifier,
				isGuest: false,
				createdAt: now,
				lastSeen: now
			});

			// Seed starter project immediately at account creation for authenticated users.
			await seedStarterProjectForOwner(ctx, id);

			return { convexUserId: id, isGuest: false };
		}

		// --- Guest user path ---
		const guestToken = args.guestId?.trim() || generateId();

		const existingGuest = await ctx.db
			.query('users')
			.withIndex('by_tokenIdentifier', (q: any) => q.eq('tokenIdentifier', guestToken))
			.first();

		if (existingGuest) {
			await ctx.db.patch(existingGuest._id, { lastSeen: now });
			return { convexUserId: existingGuest._id, isGuest: true };
		}

		const guestDbId = await ctx.db.insert('users', {
			tokenIdentifier: guestToken,
			username: `guest-${guestToken.slice(0, 6)}`,
			isGuest: true,
			createdAt: now,
			lastSeen: now
		});

		return { convexUserId: guestDbId, isGuest: true };
	}
});

// ---------------------------------------------------------------------------
// Node CRUD  (replaces createFolder / createFile / updateFileContents)
// ---------------------------------------------------------------------------

/**
 * Create a file or folder node inside a project.
 *
 * The caller is responsible for:
 *   - passing a path that starts with "/" and is unique within the project
 *   - passing content only for files
 *   - resolving parentId (optional; used for fast UI tree rendering)
 */
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
		// Prevent duplicate paths within the same project
		const existing = await ctx.db
			.query('nodes')
			.withIndex('by_project_path', (q) => q.eq('projectId', args.projectId).eq('path', args.path))
			.first();

		if (existing) {
			throw new Error(`A node already exists at path "${args.path}" in this project.`);
		}

		const now = Date.now();
		return await ctx.db.insert('nodes', {
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
	args: {
		id: v.id('nodes'),
		content: v.string()
	},
	handler: async (ctx, args) => {
		const node = await ctx.db.get(args.id);
		if (!node) throw new Error('Node not found.');
		if (node.type !== 'file') throw new Error('Cannot set content on a folder node.');

		await ctx.db.patch(args.id, { content: args.content, updatedAt: Date.now() });
		return true;
	}
});

export const upsertFile = mutation({
	args: {
		path: v.string(),
		content: v.string()
	},
	handler: async (ctx, args) => {
		const normalized = args.path.replace(/^\/+/, '');
		const parts = normalized.split('/').filter(Boolean);
		if (parts.length < 2) {
			throw new Error('Invalid upsertFile path: must include project folder and file path.');
		}

		const projectFolder = parts[0];
		const project = await findProjectByFolderName(ctx, projectFolder);
		if (!project) {
			throw new Error(`Project "${projectFolder}" not found.`);
		}

		await assertProjectWriteAccess(ctx, project);

		const projectRelativePath = parts.slice(1).join('/');
		if (!projectRelativePath) {
			throw new Error('Invalid file path after project prefix.');
		}

		const nodePath = normalizeNodePath(projectRelativePath);
		const now = Date.now();

		// Ensure folder structure exists and locate parentId for the inserted file.
		let parentId: Id<'nodes'> | undefined;
		const parentPath = getParentNodePath(nodePath);
		if (parentPath) {
			const existingParent = await ctx.db
				.query('nodes')
				.withIndex('by_project_path', (q: any) =>
					q.eq('projectId', project._id).eq('path', parentPath)
				)
				.first();

			if (existingParent) {
				parentId = existingParent._id;
			} else {
				let accumPath = '';
				for (const segment of parentPath.replace(/^\//, '').split('/')) {
					accumPath += `/${segment}`;
					let folderNode = await ctx.db
						.query('nodes')
						.withIndex('by_project_path', (q: any) =>
							q.eq('projectId', project._id).eq('path', accumPath)
						)
						.first();

					if (!folderNode) {
						const parentFolderPath = getParentNodePath(accumPath);
						const parentFolder = parentFolderPath
							? await ctx.db
									.query('nodes')
									.withIndex('by_project_path', (q: any) =>
										q.eq('projectId', project._id).eq('path', parentFolderPath)
									)
									.first()
							: undefined;

						const insertedParent = await ctx.db.insert('nodes', {
							projectId: project._id,
							path: accumPath,
							name: segment,
							type: 'folder',
							parentId: parentFolder?._id,
							createdAt: now,
							updatedAt: now
						});

						folderNode = await ctx.db.get(insertedParent);
					}

					if (!folderNode) {
						throw new Error(`Failed to create parent folder '${accumPath}'`);
					}

					parentId = folderNode._id;
				}
			}
		}

		const existingFile = await ctx.db
			.query('nodes')
			.withIndex('by_project_path', (q: any) => q.eq('projectId', project._id).eq('path', nodePath))
			.first();

		if (existingFile) {
			if (existingFile.type !== 'file') {
				throw new Error('Cannot overwrite a folder with file content.');
			}

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

/** Rename a node. Also updates the path and all descendant paths. */
export const renameNode = mutation({
	args: {
		id: v.id('nodes'),
		newName: v.string()
	},
	handler: async (ctx, args) => {
		const node = await ctx.db.get(args.id);
		if (!node) throw new Error('Node not found.');

		const parentPath = node.path.substring(0, node.path.lastIndexOf('/'));
		const newPath = `${parentPath}/${args.newName}`;

		// Update this node
		await ctx.db.patch(args.id, { name: args.newName, path: newPath, updatedAt: Date.now() });

		// If it's a folder, update all descendants' paths too
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
						updatedAt: Date.now()
					});
				}
			}
		}

		return true;
	}
});

/** Delete a node. If it's a folder, also deletes all descendant nodes. */
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
				if (child.path.startsWith(prefix)) {
					await ctx.db.delete(child._id);
				}
			}
		}

		return true;
	}
});

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Return all nodes for a project — used to build the sidebar file tree. */
export const listNodes = query({
	args: { projectId: v.id('projects') },
	handler: async (ctx, args) => {
		return await ctx.db
			.query('nodes')
			.withIndex('by_project_path', (q) => q.eq('projectId', args.projectId))
			.collect();
	}
});

/** Return the direct children of a folder (or root-level nodes if parentId is omitted). */
export const listChildren = query({
	args: {
		projectId: v.id('projects'),
		parentId: v.optional(v.id('nodes'))
	},
	handler: async (ctx, args) => {
		return await ctx.db
			.query('nodes')
			.withIndex('by_parent', (q) =>
				q.eq('projectId', args.projectId).eq('parentId', args.parentId)
			)
			.collect();
	}
});

/**
 * Return all nodes for a project formatted as the nested object tree
 * that WebContainers' `mount()` expects.
 *
 * Example return value:
 * {
 *   "index.js": { file: { contents: "console.log('hi')" } },
 *   "src": { directory: {
 *     "utils.js": { file: { contents: "export const x = 1" } }
 *   }}
 * }
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
 * Build a root workspace tree for all projects owned by a user.
 * The caller can mount this directly at `/` in WebContainer.
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
						{
							name: 'sandem-workspace',
							private: true,
							version: '0.0.0',
							workspaces: ['*']
						},
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

			const projectTree = buildWebContainerTree(
				nodes.map((n) => ({ path: n.path, type: n.type, content: n.content }))
			);

			const folder = folderNameFromProject(project);
			workspaceTree[folder] = { directory: projectTree };
		}

		return workspaceTree;
	}
});
