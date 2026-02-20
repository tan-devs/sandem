// convex/users.ts
import { query } from './_generated/server.js';
import { authComponent } from './auth.js';
import { v } from 'convex/values';

export const getMyProfile = query({
	args: {},
	handler: async (ctx) => {
		// 1. Get the auth user from the Better Auth component
		const user = await authComponent.safeGetAuthUser(ctx);

		if (!user) {
			return null;
		}

		// 2. Query your app's custom users table using the Convex _id
		const appUser = await ctx.db
			.query('users')
			// Notice the change here: user._id instead of user.id
			.withIndex('by_authUserId', (q) => q.eq('authUserId', user._id))
			.first();

		return appUser;
	}
});

export const getUserByAuthId = query({
	args: { authUserId: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db
			.query('users')
			.withIndex('by_authUserId', (q) => q.eq('authUserId', args.authUserId))
			.first();
	}
});
