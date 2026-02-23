import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

// -------------------------
// Create
// -------------------------

// Create a new multi-file project
export const createProject = mutation({
	args: {
		title: v.string(),
		files: v.array(v.object({ name: v.string(), contents: v.string() })),
		entry: v.string(),
		visibleFiles: v.array(v.string()),
		ownerId: v.optional(v.string()),
		liveblocksRoomId: v.optional(v.string()) // 👈 ADD THIS
	},
	handler: async (ctx, args) => {
		return await ctx.db.insert('projects', { ...args });
	}
});

// -------------------------
// Read
// -------------------------

// Load a specific project by its Convex ID
export const getProject = query({
	args: { id: v.id('projects') },
	handler: async (ctx, args) => {
		return await ctx.db.get(args.id);
	}
});

// List all projects (optionally filtered by the owner)
export const listProjects = query({
	args: {
		ownerId: v.optional(v.string())
	},
	handler: async (ctx, args) => {
		if (args.ownerId) {
			// If you add an index on ownerId in schema.ts, you can optimize this with .withIndex()
			return await ctx.db
				.query('projects')
				.filter((q) => q.eq(q.field('ownerId'), args.ownerId))
				.collect();
		}
		return await ctx.db.query('projects').collect();
	}
});

// -------------------------
// Update
// -------------------------

// Update an existing project
// Update an existing project
export const updateProject = mutation({
	args: {
		id: v.id('projects'),
		title: v.optional(v.string()),
		files: v.optional(v.array(v.object({ name: v.string(), contents: v.string() }))),
		entry: v.optional(v.string()),
		visibleFiles: v.optional(v.array(v.string())),
		liveblocksRoomId: v.optional(v.string()) // 👈 ADD THIS
	},
	handler: async (ctx, args) => {
		const { id, ...updates } = args;
		await ctx.db.patch(id, updates);
		return id;
	}
});

// -------------------------
// Delete
// -------------------------

// Delete a project by its Convex ID
export const deleteProject = mutation({
	args: { id: v.id('projects') },
	handler: async (ctx, args) => {
		await ctx.db.delete(args.id);
	}
});
