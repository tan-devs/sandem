import { mutation } from '../_generated/server.js';
import type { MutationCtx } from '../_generated/server.js';
import { v } from 'convex/values';
import type { GenericId } from 'convex/values';

import { seedStarterProjectForOwner } from './projects.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Fallback UUID for environments where crypto.randomUUID is unavailable. */
function generateId(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// ─── Mutations ────────────────────────────────────────────────────────────────

/**
 * Upsert a user row and return a stable { convexUserId, isGuest } pair.
 *
 * - Authenticated users: resolved via ctx.auth — no guestId needed.
 * - Guest users: pass a stable guestId cookie value (generated client-side).
 *
 * Called from +layout.server.ts on every page load so the row always exists
 * before any project or node mutation runs. This is important — ownership
 * guards in projects.ts and nodes.ts query this table and will throw
 * "Authenticated user not found" if this hasn't run first.
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

			// First time we've seen this authenticated user — create their row.
			// Mirror name + email from the JWT so your users table stays in sync
			// with what Better Auth's internal `user` table has.
			const id = await ctx.db.insert('users', {
				tokenIdentifier,
				username: identity.name ?? identity.email ?? tokenIdentifier,
				name: identity.name ?? undefined,
				email: identity.email ?? undefined,
				isGuest: false,
				createdAt: now,
				lastSeen: now
			});

			// Seed starter project exactly once on first account creation.
			await seedStarterProjectForOwner(ctx, id);

			return { convexUserId: id, isGuest: false };
		}

		// ── Guest path ────────────────────────────────────────────────────────
		// guestId is a stable cookie generated client-side. If absent, we mint
		// a new one — but the caller won't persist it, so it'll be ephemeral.
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
			// Guests have no name/email — fields stay undefined as schema allows.
			isGuest: true,
			createdAt: now,
			lastSeen: now
		});

		return { convexUserId: guestDbId, isGuest: true };
	}
});
