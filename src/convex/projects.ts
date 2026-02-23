import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

// Create a new multi-file project
export const createProject = mutation({
	args: {
		title: v.string(),
		files: v.array(v.object({ name: v.string(), contents: v.string() })),
		entry: v.string(),
		visibleFiles: v.array(v.string()),
		ownerId: v.optional(v.string()) // Pass the authenticated user's ID
	},
	handler: async (ctx, args) => {
		return await ctx.db.insert('projects', { ...args });
	}
});

// Load a specific project by its Convex ID
export const getProject = query({
	args: { id: v.id('projects') },
	handler: async (ctx, args) => {
		return await ctx.db.get(args.id);
	}
});
