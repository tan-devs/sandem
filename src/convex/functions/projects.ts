import { mutation, query, type MutationCtx, type QueryCtx } from '../_generated/server.js';

import { v } from 'convex/values';
import type { GenericId } from 'convex/values';
import type { ProjectDoc, NodeDoc, ProjectFile } from '../types/index.js';
import { normalizeNodePath, getParentNodePath } from '../utils/paths.js';
import { generateLiveblocksRoomId } from '../utils/project.js';
import {
	STARTER_PROJECT_ENTRY,
	STARTER_PROJECT_FILES,
	STARTER_PROJECT_TITLE
} from '../../lib/utils/ide/template.js';

// ---------------------------------------------------------------------------
// Ctx aliases
//
// assertProjectAccess and the read-only helpers are called from both queries
// and mutations. DatabaseWriter extends DatabaseReader, so MutationCtx
// satisfies QueryCtx structurally — we accept either via a union.
// ---------------------------------------------------------------------------

type AnyCtx = QueryCtx | MutationCtx;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Permission guard
//
// Central function used by every query/mutation that touches project data.
// Returns the project if the caller has the requested access level,
// throws otherwise.
//
// Access rules:
//   'read'  → owner always; anyone if isPublic: true
//   'write' → owner only, always
// ---------------------------------------------------------------------------

async function assertProjectAccess(
	ctx: AnyCtx,
	projectId: GenericId<'projects'>,
	level: 'read' | 'write'
): Promise<{ project: ProjectDoc; isOwner: boolean }> {
	const project = (await ctx.db.get(projectId)) as ProjectDoc | null;
	if (!project) throw new Error('Project not found.');

	const identity = await ctx.auth.getUserIdentity();
	const callerToken = identity?.tokenIdentifier ?? null;

	const owner = await ctx.db.get(project.ownerId);
	if (!owner) throw new Error('Project owner not found.');

	const isOwner =
		callerToken !== null && callerToken === (owner as { tokenIdentifier?: string }).tokenIdentifier;

	if (level === 'write' && !isOwner) {
		throw new Error('Read-only: only the project owner can make changes.');
	}

	if (level === 'read' && !isOwner && !project.isPublic) {
		throw new Error('Private project: you do not have access.');
	}

	return { project, isOwner };
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export const createProject = mutation({
	args: {
		ownerId: v.id('users'),
		name: v.string(),
		isPublic: v.optional(v.boolean()),
		room: v.optional(v.string()),
		entry: v.optional(v.string())
	},
	handler: async (ctx, args) => {
		const now = Date.now();
		const room = args.room?.trim() || generateLiveblocksRoomId(args.ownerId, args.name);

		return await ctx.db.insert('projects', {
			ownerId: args.ownerId,
			name: args.name,
			isPublic: args.isPublic ?? false,
			room,
			entry: args.entry,
			createdAt: now,
			updatedAt: now
		});
	}
});

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/** List all projects owned by a user. Caller must be the owner. */
export const getAllProjects = query({
	args: { ownerId: v.id('users') },
	handler: async (ctx, args) => {
		if (!args.ownerId) return [];

		return await ctx.db
			.query('projects')
			.withIndex('by_owner', (q) => q.eq('ownerId', args.ownerId))
			.collect();
	}
});

/** Fetch a single project by its _id. Enforces read permission. */
export const getProject = query({
	args: { id: v.id('projects') },
	handler: async (ctx, args) => {
		const { project, isOwner } = await assertProjectAccess(ctx, args.id, 'read');
		return { ...project, isOwner };
	}
});

/**
 * The main entry point for the IDE route.
 *
 * Fetches the project + all its nodes in a single call, enforcing:
 *   - Public projects  → any visitor can read
 *   - Private projects → owner only
 *   - Write access     → owner only (isOwner flag lets the UI disable Save)
 */
async function findUserByUsername(ctx: AnyCtx, username: string) {
	return await ctx.db
		.query('users')
		.withIndex('by_username', (q) => q.eq('username', username))
		.unique();
}

async function findProjectByOwnerAndName(
	ctx: AnyCtx,
	ownerId: GenericId<'users'>,
	projectName: string
) {
	return await ctx.db
		.query('projects')
		.withIndex('by_owner', (q) => q.eq('ownerId', ownerId))
		.filter((q) => q.eq(q.field('name'), projectName))
		.first();
}

export const getProjectFiles = query({
	args: {
		username: v.string(),
		projectName: v.string()
	},
	handler: async (ctx, args) => {
		const user = await findUserByUsername(ctx, args.username);
		if (!user) throw new Error(`User "${args.username}" not found.`);

		const project = await findProjectByOwnerAndName(ctx, user._id, args.projectName);
		if (!project) throw new Error(`Project "${args.projectName}" not found.`);

		const { project: guardedProject, isOwner } = await assertProjectAccess(
			ctx,
			project._id,
			'read'
		);

		const nodes = await getNodesForProject(ctx, project._id);

		return {
			project: guardedProject,
			nodes,
			isOwner
		};
	}
});

/** Resolve a project by room slug — used to join a Liveblocks collab session. */
export const openCollab = query({
	args: { room: v.string() },
	handler: async (ctx, args) => {
		if (!args.room) return null;

		const project = await ctx.db
			.query('projects')
			.withIndex('by_room', (q) => q.eq('room', args.room))
			.first();

		if (!project) return null;

		await assertProjectAccess(ctx, project._id, 'read');

		return project;
	}
});

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

/** Update project metadata (name, entry, room, isPublic). Owner only. */
export const updateProject = mutation({
	args: {
		id: v.id('projects'),
		name: v.optional(v.string()),
		entry: v.optional(v.string()),
		room: v.optional(v.string()),
		isPublic: v.optional(v.boolean()),
		files: v.optional(v.array(v.object({ name: v.string(), contents: v.string() })))
	},
	handler: async (ctx, args) => {
		await assertProjectAccess(ctx, args.id, 'write');
		const { id, ...updates } = args;
		await ctx.db.patch(id, { ...updates, updatedAt: Date.now() });
	}
});

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

/** Delete a project and all its nodes. Owner only. */
export const deleteProject = mutation({
	args: { id: v.id('projects') },
	handler: async (ctx, args) => {
		await assertProjectAccess(ctx, args.id, 'write');

		const nodes = await ctx.db
			.query('nodes')
			.withIndex('by_project_path', (q) => q.eq('projectId', args.id))
			.collect();

		for (const node of nodes) {
			await ctx.db.delete(node._id);
		}

		await ctx.db.delete(args.id);
	}
});

// ---------------------------------------------------------------------------
// Seeding & backfill
// ---------------------------------------------------------------------------

const SYSTEM_TEMPLATE_USERNAME = 'sandem-system';

async function ensureSystemTemplateUser(ctx: MutationCtx) {
	let systemUser = await ctx.db
		.query('users')
		.withIndex('by_username', (q) => q.eq('username', SYSTEM_TEMPLATE_USERNAME))
		.unique();

	if (!systemUser) {
		const now = Date.now();
		const systemUserId = await ctx.db.insert('users', {
			tokenIdentifier: SYSTEM_TEMPLATE_USERNAME,
			username: SYSTEM_TEMPLATE_USERNAME,
			isGuest: false,
			createdAt: now,
			lastSeen: now
		});

		systemUser = await ctx.db.get(systemUserId);
	}

	return systemUser;
}

async function getNodesForProject(
	ctx: AnyCtx,
	projectId: GenericId<'projects'>
): Promise<NodeDoc[]> {
	return (await ctx.db
		.query('nodes')
		.withIndex('by_project_path', (q) => q.eq('projectId', projectId))
		.collect()) as NodeDoc[];
}

type NodeInsert = {
	path: string;
	type: 'file' | 'folder';
	content?: string;
};

/**
 * Insert a full file/folder tree into a project, with computed parentId links.
 */
async function insertProjectNodes(
	ctx: MutationCtx,
	projectId: GenericId<'projects'>,
	nodes: NodeInsert[]
) {
	const now = Date.now();
	const normalizedNodes = new Map<string, NodeInsert>();

	for (const node of nodes) {
		const path = normalizeNodePath(node.path);
		normalizedNodes.set(path, { path, type: node.type, content: node.content });

		// Ensure all folder ancestors exist (for tree consistency)
		const parts = path.replace(/^\//, '').split('/').filter(Boolean);
		let prefix = '';
		for (let i = 0; i < parts.length - 1; i++) {
			prefix += `/${parts[i]}`;
			if (!normalizedNodes.has(prefix)) {
				normalizedNodes.set(prefix, { path: prefix, type: 'folder' });
			}
		}
	}

	// Sort by depth (folders before deeper files) so parent nodes exist first.
	const sortedPaths = Array.from(normalizedNodes.keys()).sort((a, b) => {
		const aDepth = a.split('/').filter(Boolean).length;
		const bDepth = b.split('/').filter(Boolean).length;
		if (aDepth !== bDepth) return aDepth - bDepth;
		const aIsFolder = normalizedNodes.get(a)?.type === 'folder' ? 0 : 1;
		const bIsFolder = normalizedNodes.get(b)?.type === 'folder' ? 0 : 1;
		if (aIsFolder !== bIsFolder) return aIsFolder - bIsFolder;
		return a.localeCompare(b);
	});

	const pathToNodeId = new Map<string, GenericId<'nodes'>>();

	for (const path of sortedPaths) {
		const node = normalizedNodes.get(path);
		if (!node) continue;

		const parentPath = getParentNodePath(path);
		const parentId = parentPath ? pathToNodeId.get(parentPath) : undefined;
		const name = path.split('/').pop() ?? '';

		const insertedId = await ctx.db.insert('nodes', {
			projectId,
			path,
			name,
			type: node.type,
			content: node.type === 'file' ? (node.content ?? '') : undefined,
			parentId,
			createdAt: now,
			updatedAt: now
		});

		pathToNodeId.set(path, insertedId);
	}
}

async function ensureSystemTemplateProject(ctx: MutationCtx) {
	const systemUser = await ensureSystemTemplateUser(ctx);
	if (!systemUser) throw new Error('Failed to create system template user.');

	const existingTemplateProject = await ctx.db
		.query('projects')
		.withIndex('by_owner', (q) => q.eq('ownerId', systemUser._id))
		.filter((q) => q.eq(q.field('name'), STARTER_PROJECT_TITLE))
		.first();

	if (existingTemplateProject) return existingTemplateProject;

	const now = Date.now();
	const projectId = await ctx.db.insert('projects', {
		ownerId: systemUser._id,
		name: STARTER_PROJECT_TITLE,
		isPublic: true,
		room: generateLiveblocksRoomId(systemUser._id, STARTER_PROJECT_TITLE),
		entry: STARTER_PROJECT_ENTRY,
		createdAt: now,
		updatedAt: now
	});

	await insertProjectNodes(
		ctx,
		projectId,
		(STARTER_PROJECT_FILES as ProjectFile[]).map((file) => ({
			path: normalizeNodePath(file.name),
			type: 'file',
			content: file.contents
		}))
	);

	const createdProject = await ctx.db.get(projectId);
	if (!createdProject) throw new Error('Failed to create system template project.');

	return createdProject;
}

/**
 * Seed a starter project for a brand-new user.
 * Uses projectSeedState to guarantee exactly-once behaviour.
 */
export async function seedStarterProjectForOwner(
	ctx: MutationCtx,
	ownerId: GenericId<'users'>
): Promise<string | null> {
	if (!ownerId) return null;

	const now = Date.now();

	const seedState = await ctx.db
		.query('projectSeedState')
		.withIndex('by_owner', (q) => q.eq('ownerId', ownerId))
		.first();

	if (seedState?.starterProjectSeeded) return null;

	const existing = await ctx.db
		.query('projects')
		.withIndex('by_owner', (q) => q.eq('ownerId', ownerId))
		.first();

	let projectId: GenericId<'projects'> | null = null;

	if (!existing) {
		const systemTemplateProject = await ensureSystemTemplateProject(ctx);

		projectId = await ctx.db.insert('projects', {
			ownerId,
			name: STARTER_PROJECT_TITLE,
			isPublic: true,
			room: generateLiveblocksRoomId(ownerId, STARTER_PROJECT_TITLE),
			entry: STARTER_PROJECT_ENTRY,
			createdAt: now,
			updatedAt: now
		});

		const templateNodes = await getNodesForProject(ctx, systemTemplateProject._id);

		if (templateNodes.length > 0) {
			await insertProjectNodes(
				ctx,
				projectId,
				templateNodes.map((node) => ({
					path: node.path,
					type: node.type,
					content: node.content
				}))
			);
		} else {
			await insertProjectNodes(
				ctx,
				projectId,
				(STARTER_PROJECT_FILES as ProjectFile[]).map((file) => ({
					path: file.name,
					type: 'file',
					content: file.contents
				}))
			);
		}
	}

	if (seedState) {
		await ctx.db.patch(seedState._id, { starterProjectSeeded: true, seededAt: now });
	} else {
		await ctx.db.insert('projectSeedState', {
			ownerId,
			starterProjectSeeded: true,
			seededAt: now
		});
	}

	return projectId;
}

export const ensureStarterProjectForOwner = mutation({
	args: { ownerId: v.id('users') },
	handler: async (ctx, args) => {
		if (!args.ownerId) return null;
		return seedStarterProjectForOwner(ctx, args.ownerId);
	}
});

/**
 * Backfill any projects that were created without a Liveblocks room slug.
 * Safe to call on every login — patches only the rows that need it.
 */
export const ensureLiveblocksRoomsForOwner = mutation({
	args: { ownerId: v.id('users') },
	handler: async (ctx, args) => {
		if (!args.ownerId) return 0;

		const projects = await ctx.db
			.query('projects')
			.withIndex('by_owner', (q) => q.eq('ownerId', args.ownerId))
			.collect();

		let patched = 0;
		for (const project of projects) {
			if (project.room?.trim()) continue;
			await ctx.db.patch(project._id, {
				room: generateLiveblocksRoomId(args.ownerId, project.name),
				updatedAt: Date.now()
			});
			patched += 1;
		}

		return patched;
	}
});
