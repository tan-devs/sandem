// convex/users.ts
import { mutation } from './_generated/server';

export const syncUser = mutation({
	args: {},
	handler: async (ctx) => {
		// 1. Get the authenticated identity from Better Auth via Convex
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			throw new Error('Called syncUser without authentication present');
		}

		// 2. Check if we already have this user in our custom app table
		const existingUser = await ctx.db
			.query('users')
			.withIndex('by_tokenIdentifier', (q) => q.eq('tokenIdentifier', identity.tokenIdentifier))
			.unique();

		const now = Date.now();

		if (existingUser !== null) {
			// User exists. Let's also update their lastSeen time while we're here!
			await ctx.db.patch(existingUser._id, { lastSeen: now });
			return existingUser._id;
		}

		// 3. If missing, insert the new user into our app's table with ALL required schema fields
		const newUserId = await ctx.db.insert('users', {
			tokenIdentifier: identity.tokenIdentifier,
			name: identity.name,
			email: identity.email,

			// --- Newly added required fields to satisfy schema.ts ---

			// Fallback to their name, then email, then a default string if neither exist
			username: identity.name ?? identity.email ?? 'UnknownUser',

			isGuest: false, // They are authenticated via Better Auth, so they aren't a guest
			createdAt: now,
			lastSeen: now
		});

		return newUserId;
	}
});
