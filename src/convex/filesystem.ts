import { mutation, query } from './_generated/server.js';
import { v } from 'convex/values';
import type { Id } from './_generated/dataModel.js';
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
// Identity
// ---------------------------------------------------------------------------

/**
 * Upsert a user row and return a stable { convexUserId, isGuest } pair.
 *
 * For authenticated users, tokenIdentifier comes from Better Auth's session
 * (ctx.auth). For guests, a stable browser-generated guestId is used as the
 * tokenIdentifier with isGuest: true.
 */
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
				.withIndex('by_tokenIdentifier', (q) => q.eq('tokenIdentifier', tokenIdentifier))
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
			.withIndex('by_tokenIdentifier', (q) => q.eq('tokenIdentifier', guestToken))
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
