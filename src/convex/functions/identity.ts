import { mutation } from '../_generated/server.js';
import type { MutationCtx } from '../_generated/server.js';
import { v } from 'convex/values';
import type { GenericId } from 'convex/values';

import { seedStarterProjectForOwner } from './projects.js';

/** Fallback UUID for environments where crypto.randomUUID is unavailable. */
function generateId(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Upsert a user row and return a stable { convexUserId, isGuest } pair.
 *
 * - Authenticated users: resolved via ctx.auth — no guestId needed.
 * - Guest users: pass a stable guestId cookie value (generated client-side).
 *
 * Called from +layout.server.ts on every page load so the row is always
 * current before any project or filesystem mutation runs.
 */
export const ensureUserIdentity = mutation({
	args: {
		guestId: v.optional(v.string())
	},
	handler: async (ctx: MutationCtx, args: { guestId?: string }) => {
		const now = Date.now();

		// ── Authenticated path ────────────────────────────────────────────────
		const identity = await ctx.auth.getUserIdentity();
		if (identity) {
			const { tokenIdentifier } = identity;

			const existing = (await ctx.db
				.query('users')
				.withIndex('by_tokenIdentifier', (q) => q.eq('tokenIdentifier', tokenIdentifier))
				.first()) as {
				_id: GenericId<'users'>;
				lastSeen: number;
			} | null;

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

			// Seed starter project on first account creation.
			await seedStarterProjectForOwner(ctx, id);

			return { convexUserId: id, isGuest: false };
		}

		// ── Guest path ────────────────────────────────────────────────────────
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
