import { mutation, query } from './_generated/server.js';
import { v } from 'convex/values';
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
	projectId: string,
	level: 'read' | 'write'
) {
	const project = await ctx.db.get(projectId);
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
export const getProjectFiles = query({
	args: {
		username: v.string(), // e.g. "prajwal"
		projectName: v.string() // e.g. "demo-project"
	},
	handler: async (ctx, args) => {
		// Step 1: resolve the owner by username
		const user = await ctx.db
			.query('users')
			.withIndex('by_username', (q: any) => q.eq('username', args.username))
			.unique();

		if (!user) throw new Error(`User "${args.username}" not found.`);

		// Step 2: find the project under that owner
		const project = await ctx.db
			.query('projects')
			.withIndex('by_owner', (q: any) => q.eq('ownerId', user._id))
			.filter((q: any) => q.eq(q.field('name'), args.projectName))
			.first();

		if (!project) throw new Error(`Project "${args.projectName}" not found.`);

		// Step 3: resolve caller identity
		const identity = await ctx.auth.getUserIdentity();
		const isOwner = identity !== null && identity.tokenIdentifier === user.tokenIdentifier;

		// Step 4: gate private projects
		if (!project.isPublic && !isOwner) {
			throw new Error('Private project: you do not have access.');
		}

		// Step 5: return project metadata + all file/folder nodes
		const nodes = await ctx.db
			.query('nodes')
			.withIndex('by_project_path', (q: any) => q.eq('projectId', project._id))
			.collect();

		return {
			project,
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
		isPublic: v.optional(v.boolean())
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

/**
 * Seed a starter project for a brand-new user.
 * Uses projectSeedState to guarantee exactly-once behaviour.
 * Starter project nodes are inserted into the `nodes` table —
 * not embedded in the project document.
 */
export const ensureStarterProjectForOwner = mutation({
	args: { ownerId: v.id('users') },
	handler: async (ctx, args) => {
		if (!args.ownerId) return null;

		const now = Date.now();

		// Check idempotency guard
		const seedState = await ctx.db
			.query('projectSeedState')
			.withIndex('by_owner', (q: any) => q.eq('ownerId', args.ownerId))
			.first();

		if (seedState?.starterProjectSeeded) return null;

		// Also skip if they already own at least one project (e.g. migrated user)
		const existing = await ctx.db
			.query('projects')
			.withIndex('by_owner', (q: any) => q.eq('ownerId', args.ownerId))
			.first();

		let projectId: string | null = null;

		if (!existing) {
			projectId = await ctx.db.insert('projects', {
				ownerId: args.ownerId,
				name: STARTER_PROJECT_TITLE,
				isPublic: true, // starter is public so guests can view it
				room: generateLiveblocksRoomId(args.ownerId, STARTER_PROJECT_TITLE),
				entry: STARTER_PROJECT_ENTRY,
				createdAt: now,
				updatedAt: now
			});

			// Seed starter files as nodes
			for (const file of STARTER_PROJECT_FILES as Array<{ name: string; contents: string }>) {
				const path = file.name.startsWith('/') ? file.name : `/${file.name}`;
				await ctx.db.insert('nodes', {
					projectId,
					path,
					name: file.name.split('/').pop() ?? file.name,
					type: 'file',
					content: file.contents,
					createdAt: now,
					updatedAt: now
				});
			}
		}

		// Write idempotency record
		if (seedState) {
			await ctx.db.patch(seedState._id, { starterProjectSeeded: true, seededAt: now });
		} else {
			await ctx.db.insert('projectSeedState', {
				ownerId: args.ownerId,
				starterProjectSeeded: true,
				seededAt: now
			});
		}

		return projectId;
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
			.withIndex('by_owner', (q: any) => q.eq('ownerId', args.ownerId))
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
