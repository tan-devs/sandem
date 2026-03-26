import { mutation, query } from './_generated/server.js';
import { v } from 'convex/values';
import type { PROJECT_DOC, PROJECT_ID, FILE } from '$types/projects.js';
import {
	STARTER_PROJECT_ENTRY,
	STARTER_PROJECT_FILES,
	STARTER_PROJECT_TITLE
} from '../lib/utils/ide/template.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toRoomSlug(input: string): string {
	return (
		input
			.toLowerCase()
			.replace(/\s+/g, '-')
			.replace(/[^a-z0-9-]/g, '')
			.slice(0, 36) || 'project'
	);
}

function generateLiveblocksRoomId(ownerId: string, projectName: string): string {
	const stamp = Date.now().toString(36);
	const entropy = Math.random().toString(36).slice(2, 8);
	return `room-${toRoomSlug(ownerId)}-${toRoomSlug(projectName)}-${stamp}-${entropy}`;
}

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
	ctx: { db: any; auth: any },
	projectId: PROJECT_ID,
	level: 'read' | 'write'
): Promise<{ project: PROJECT_DOC; owner: { tokenIdentifier?: string }; isOwner: boolean }> {
	const project = (await ctx.db.get(projectId)) as PROJECT_DOC | null;
	if (!project) throw new Error('Project not found.');

	// Resolve the caller's tokenIdentifier if they're authenticated
	const identity = await ctx.auth.getUserIdentity();
	const callerToken = identity?.tokenIdentifier ?? null;

	// Resolve the project owner's tokenIdentifier for comparison
	const owner = await ctx.db.get(project.ownerId);
	if (!owner) throw new Error('Project owner not found.');

	const isOwner = callerToken !== null && callerToken === owner.tokenIdentifier;

	if (level === 'write' && !isOwner) {
		throw new Error('Read-only: only the project owner can make changes.');
	}

	if (level === 'read' && !isOwner && !project.isPublic) {
		throw new Error('Private project: you do not have access.');
	}

	return { project, owner, isOwner };
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
			.withIndex('by_owner', (q: any) => q.eq('ownerId', args.ownerId))
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
 *
 * Permission check flow:
 *   1. Resolve the project by (username, projectName).
 *   2. Resolve caller identity via ctx.auth.getUserIdentity().
 *   3. Compare caller tokenIdentifier to owner tokenIdentifier.
 *   4. If private and not owner → throw before any file data is sent.
 *   5. If public or owner → collect nodes and return.
 */
async function findUserByUsername(ctx: { db: any; auth: any }, username: string) {
	return await ctx.db
		.query('users')
		.withIndex('by_username', (q: any) => q.eq('username', username))
		.unique();
}

async function findProjectByOwnerAndName(
	ctx: { db: any; auth: any },
	ownerId: string,
	projectName: string
) {
	return await ctx.db
		.query('projects')
		.withIndex('by_owner', (q: any) => q.eq('ownerId', ownerId))
		.filter((q: any) => q.eq(q.field('name'), projectName))
		.first();
}

export const getProjectFiles = query({
	args: {
		username: v.string(), // e.g. "prajwal"
		projectName: v.string() // e.g. "demo-project"
	},
	handler: async (ctx, args) => {
		// Step 1: resolve the owner by username
		const user = await findUserByUsername(ctx, args.username);
		if (!user) throw new Error(`User "${args.username}" not found.`);

		// Step 2: resolve project by name under owner
		const project = await findProjectByOwnerAndName(ctx, user._id, args.projectName);
		if (!project) throw new Error(`Project "${args.projectName}" not found.`);

		// Step 3: enforce owner/public access with shared helper
		const { project: guardedProject, isOwner } = await assertProjectAccess(
			ctx,
			project._id,
			'read'
		);

		// Step 4: collect tree nodes for the project
		const nodes = await getNodesForProject(ctx, project._id);

		return {
			project: guardedProject,
			nodes,
			// Let the UI know so it can disable the Save button for guests
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
			.filter((q: any) => q.eq(q.field('room'), args.room))
			.first();

		if (!project) return null;

		// Collab rooms always require read access — applies the same public/private rule
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

		// Cascade-delete all nodes belonging to this project
		const nodes = await ctx.db
			.query('nodes')
			.withIndex('by_project_path', (q: any) => q.eq('projectId', args.id))
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

/**
 * Normalize a path to an absolute node path: '/src/App.jsx'.
 */
function normalizeNodePath(path: string): string {
	if (!path) return '/';
	return path.startsWith('/') ? path : `/${path}`;
}

/**
 * Get the parent path, e.g. '/src/App.jsx' -> '/src'. Root-level files return ''.
 */
function getParentNodePath(path: string): string {
	const normalized = normalizeNodePath(path);
	if (normalized === '/' || normalized === '') return '';
	const lastSlash = normalized.lastIndexOf('/');
	if (lastSlash <= 0) return '';
	return normalized.substring(0, lastSlash);
}

async function ensureSystemTemplateUser(ctx: { db: any; auth: any }) {
	let systemUser = await ctx.db
		.query('users')
		.withIndex('by_username', (q: any) => q.eq('username', SYSTEM_TEMPLATE_USERNAME))
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

async function getNodesForProject(ctx: { db: any; auth: any }, projectId: string) {
	return await ctx.db
		.query('nodes')
		.withIndex('by_project_path', (q: any) => q.eq('projectId', projectId))
		.collect();
}

/**
 * Insert a full file/folder tree into a project, with computed parentId links.
 */
async function insertProjectNodes(
	ctx: { db: any; auth: any },
	projectId: string,
	nodes: Array<{ path: string; type: 'file' | 'folder'; content?: string; file?: FILE }>
) {
	const now = Date.now();
	const normalizedNodes = new Map<
		string,
		{ path: string; type: 'file' | 'folder'; content?: string }
	>();

	for (const node of nodes) {
		const path = normalizeNodePath(node.path);
		normalizedNodes.set(path, { path, type: node.type, content: node.content });

		// Ensure all folder ancestors exist in the map (for tree consistency)
		if (node.type === 'file' || node.type === 'folder') {
			const parts = path.replace(/^\//, '').split('/').filter(Boolean);
			let prefix = '';
			for (let i = 0; i < parts.length - 1; i++) {
				prefix += `/${parts[i]}`;
				if (!normalizedNodes.has(prefix)) {
					normalizedNodes.set(prefix, { path: prefix, type: 'folder' });
				}
			}
		}
	}

	// Sort by path depth (folders before deeper files) so parent nodes exist first.
	const sortedPaths = Array.from(normalizedNodes.keys()).sort((a, b) => {
		const aDepth = a.split('/').filter(Boolean).length;
		const bDepth = b.split('/').filter(Boolean).length;
		if (aDepth !== bDepth) return aDepth - bDepth;
		const aType = normalizedNodes.get(a)?.type === 'folder' ? 0 : 1;
		const bType = normalizedNodes.get(b)?.type === 'folder' ? 0 : 1;
		if (aType !== bType) return aType - bType;
		return a.localeCompare(b);
	});

	const pathToNodeId = new Map<string, string>();

	for (const path of sortedPaths) {
		const node = normalizedNodes.get(path);
		if (!node) continue;

		const parentPath = getParentNodePath(path);
		const parentId = parentPath ? pathToNodeId.get(parentPath) : undefined;
		const name = path.split('/').pop() ?? '';

		const insertedNode = await ctx.db.insert('nodes', {
			projectId,
			path,
			name,
			type: node.type,
			content: node.type === 'file' ? (node.content ?? '') : undefined,
			parentId,
			createdAt: now,
			updatedAt: now
		});

		pathToNodeId.set(path, insertedNode._id);
	}
}

async function ensureSystemTemplateProject(ctx: { db: any; auth: any }) {
	const systemUser = await ensureSystemTemplateUser(ctx);
	if (!systemUser) throw new Error('Failed to create system template user.');

	const existingTemplateProject = await ctx.db
		.query('projects')
		.withIndex('by_owner', (q: any) => q.eq('ownerId', systemUser._id))
		.filter((q: any) => q.eq(q.field('name'), STARTER_PROJECT_TITLE))
		.first();

	if (existingTemplateProject) {
		return existingTemplateProject;
	}

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
		STARTER_PROJECT_FILES.map((file: { name: string; contents: string }) => ({
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
 * Starter project nodes are inserted into the `nodes` table —
 * not embedded in the project document.
 */
export async function seedStarterProjectForOwner(
	ctx: { db: any; auth: any },
	ownerId: string
): Promise<string | null> {
	if (!ownerId) return null;

	const now = Date.now();

	// Check idempotency guard
	const seedState = await ctx.db
		.query('projectSeedState')
		.withIndex('by_owner', (q: any) => q.eq('ownerId', ownerId))
		.first();

	if (seedState?.starterProjectSeeded) return null;

	// Also skip if they already own at least one project (e.g. migrated user)
	const existing = await ctx.db
		.query('projects')
		.withIndex('by_owner', (q: any) => q.eq('ownerId', ownerId))
		.first();

	let projectId: string | null = null;

	if (!existing) {
		const systemTemplateProject = await ensureSystemTemplateProject(ctx);

		projectId = await ctx.db.insert('projects', {
			ownerId,
			name: STARTER_PROJECT_TITLE,
			isPublic: true, // starter is public so guests can view it
			room: generateLiveblocksRoomId(ownerId, STARTER_PROJECT_TITLE),
			entry: STARTER_PROJECT_ENTRY,
			createdAt: now,
			updatedAt: now
		});

		if (!projectId) {
			throw new Error('Failed to create starter project for owner.');
		}

		const templateNodes = await getNodesForProject(ctx, systemTemplateProject._id);

		if (templateNodes && templateNodes.length > 0) {
			await insertProjectNodes(
				ctx,
				projectId,
				templateNodes.map((node: { path: string; type: 'file' | 'folder'; content?: string }) => ({
					path: node.path,
					type: node.type,
					content: node.content
				}))
			);
		} else {
			await insertProjectNodes(
				ctx,
				projectId,
				STARTER_PROJECT_FILES.map((file: { name: string; contents: string }) => ({
					path: file.name,
					type: 'file',
					content: file.contents
				}))
			);
		}
	}

	// Write idempotency record
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
