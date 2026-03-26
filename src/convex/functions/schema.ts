import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
	/**
	 * Users — both real and guest.
	 * tokenIdentifier comes from auth provider.
	 * username is the human-readable handle.
	 */
	users: defineTable({
		tokenIdentifier: v.string(), // Betterauth
		username: v.string(), // "prajwal"
		isGuest: v.boolean(),
		createdAt: v.number(),
		lastSeen: v.number()
	})
		.index('by_tokenIdentifier', ['tokenIdentifier'])
		.index('by_username', ['username']),

	/**
	 * Projects — the top-level namespace owned by a user.
	 * isPublic lets guests open a project in read-only mode without
	 * being the owner; your mutation guards should enforce this.
	 */
	projects: defineTable({
		ownerId: v.id('users'), // FK → users._id (not a raw string)
		name: v.string(), // "my-web-app"
		isPublic: v.boolean(), // true → guests can read
		room: v.string(), // LiveBlocks / Livekit room slug
		entry: v.optional(v.string()), // default open file path, e.g. "/src/index.ts"
		createdAt: v.number(),
		updatedAt: v.number()
	})
		.index('by_owner', ['ownerId'])
		.index('by_room', ['room']),

	/**
	 * Nodes — the unified filesystem tree for a project.
	 *
	 * A node is either a "file" (has content) or a "folder" (no content).
	 * Keeping both in one table means:
	 *   • Empty folders are first-class — they exist even with no children.
	 *   • You query the whole tree in one round-trip.
	 *   • Rename/move is a single patch on `path` + `name`.
	 *
	 * Path convention (always absolute from project root):
	 *   folder  →  "/src"
	 *   file    →  "/src/main.ts"
	 *   root    →  "/"   (the implicit project root; usually not stored)
	 *
	 * parentId is denormalised from path for fast UI tree rendering —
	 * keep it in sync whenever you write `path`.
	 */
	nodes: defineTable({
		projectId: v.id('projects'),
		path: v.string(), // "/src/components/Button.tsx"
		name: v.string(), // "Button.tsx"
		type: v.union(v.literal('file'), v.literal('folder')),
		content: v.optional(v.string()), // only present when type === "file"
		parentId: v.optional(v.id('nodes')), // null / undefined → root child
		createdAt: v.number(),
		updatedAt: v.number()
	})
		// Primary lookup: give me everything in project X at path Y
		.index('by_project_path', ['projectId', 'path'])
		// Fast tree rendering: give me all direct children of a folder
		.index('by_parent', ['projectId', 'parentId']),

	/**
	 * projectSeedState — tracks whether the "starter project" has been
	 * injected for a user so we never seed twice.
	 */
	projectSeedState: defineTable({
		ownerId: v.id('users'), // FK → users._id
		starterProjectSeeded: v.boolean(),
		seededAt: v.number()
	}).index('by_owner', ['ownerId'])
});
