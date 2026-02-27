// src/routes/api/liveblocks-auth/+server.ts
import { type RequestEvent } from '@sveltejs/kit';
import { LIVEBLOCKS_SECRET_KEY } from '$env/static/private';
import { PUBLIC_CONVEX_URL } from '$env/static/public';
import { Liveblocks } from '@liveblocks/node';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '$convex/_generated/api.js';

const liveblocks = new Liveblocks({
	secret: LIVEBLOCKS_SECRET_KEY
});

export async function POST({ locals, request }: RequestEvent): Promise<Response> {
	try {
		// create fresh client for each request to avoid shared-state race conditions
		const convex = new ConvexHttpClient(PUBLIC_CONVEX_URL);

		const { room } = await request.json();

		if (room) {
			if (typeof room !== 'string') {
				return new Response('Invalid room ID type', { status: 400 });
			}
			if (room.trim().length === 0) {
				return new Response('Room ID cannot be empty', { status: 400 });
			}
		}

		if (!locals.token) {
			return new Response('Unauthorized - No Token', { status: 401 });
		}

		convex.setAuth(locals.token);
		const user = await convex.query(api.auth.getCurrentUser);

		if (!user) {
			return new Response('Unauthorized - User not found', { status: 401 });
		}

		const session = liveblocks.prepareSession(user._id, {
			userInfo: {
				name: user.name?.trim() || 'Anonymous User',
				email: user.email?.trim() || '',
				avatar: user.image?.trim() || ''
			}
		});

		if (room) {
			// FIX: Fetch the project from Convex using the Room ID
			let project;
			try {
				project = await convex.query(api.projects.openCollab, { room, owner: user._id });
			} catch (error) {
				console.error('Failed to fetch project for room:', room, error);
				return new Response('Failed to authorize room', { status: 500 });
			}
			if (project) {
				const isOwner = project.owner === user._id;
				session.allow(room, isOwner ? session.FULL_ACCESS : ['room:read', 'room:presence:write']);
			} else {
				// If project doesn't exist, you might want to deny access or allow read-only
				session.allow(room, ['room:read']);
			}
		}

		const { status, body } = await session.authorize();
		return new Response(body, { status });
	} catch (error) {
		console.error('Liveblocks auth error:', error);
		return new Response('Internal Server Error', { status: 500 });
	}
}
