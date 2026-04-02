import { createClient, type GenericCtx } from '@convex-dev/better-auth';
import { convex } from '@convex-dev/better-auth/plugins';
import { components } from '../_generated/api.js';
import { type DataModel } from '../_generated/dataModel.js';
import { query } from '../_generated/server.js';
import { betterAuth } from 'better-auth';
import authConfig from '../config/auth.config';
import { convexEnv } from './env.js';

// ─── Better Auth infrastructure only ─────────────────────────────────────────
// Nothing app-level lives here. User queries/mutations live in users.ts.

/**
 * The component client wraps the Better Auth Convex component.
 * Used for two things only:
 *   1. Providing the database adapter to betterAuth()
 *   2. Registering HTTP routes via authComponent.registerRoutes() in http.ts
 */
export const authComponent: ReturnType<typeof createClient<DataModel>> = createClient<DataModel>(
	components.betterAuth
);

/**
 * Factory that creates the Better Auth instance for a given Convex context.
 * Called once per HTTP request inside http.ts — not used directly in queries
 * or mutations.
 */
export const createAuth = (ctx: GenericCtx<DataModel>) => {
	const env = convexEnv();
	return betterAuth({
		baseURL: env.SITE_URL,
		// Binds Better Auth's storage to the Convex component's internal tables.
		// These are separate from your app's `users` table in schema.ts.
		database: authComponent.adapter(ctx),
		secret: env.BETTER_AUTH_SECRET,
		emailAndPassword: {
			enabled: true,
			requireEmailVerification: false
		},
		socialProviders: {
			github: {
				enabled: true,
				clientId: env.GITHUB_CLIENT_ID,
				clientSecret: env.GITHUB_CLIENT_SECRET
			}
		},
		plugins: [
			// Required — makes Better Auth issue JWTs that Convex can verify.
			// The tokenIdentifier in those JWTs is what your users table keys on.
			convex({
				authConfig,
				jwksRotateOnTokenGenerationError: true
			})
		]
	});
};

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Returns the current user row from YOUR app's `users` table — not from
 * Better Auth's internal component tables.
 *
 * This is the single source of truth for user identity in the app.
 * Any frontend code that needs "who am I" should call this, not anything
 * that touches the Better Auth component directly.
 *
 * Returns null for unauthenticated / guest sessions — callers handle that.
 */
export const getCurrentUser = query({
	args: {},
	handler: async (ctx) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) return null;

		return ctx.db
			.query('users')
			.withIndex('by_tokenIdentifier', (q) => q.eq('tokenIdentifier', identity.tokenIdentifier))
			.first();
	}
});
