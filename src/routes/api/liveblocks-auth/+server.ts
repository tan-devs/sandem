import { type RequestEvent } from '@sveltejs/kit';
import { LIVEBLOCKS_SECRET_KEY } from '$env/static/private';
import { PUBLIC_CONVEX_URL } from '$env/static/public';
import { Liveblocks } from '@liveblocks/node';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '$convex/_generated/api.js';

const liveblocks = new Liveblocks({
	secret: LIVEBLOCKS_SECRET_KEY
});

// Initialize the Convex HTTP client for server-side queries
const convex = new ConvexHttpClient(PUBLIC_CONVEX_URL);

export async function POST({ locals }: RequestEvent): Promise<Response> {
	try {
		// 1. Grab the token that hooks.server.ts already parsed for us
		if (!locals.token) {
			return new Response('Unauthorized - No Token', { status: 401 });
		}

		// 2. Authenticate the Convex client with the user's token
		convex.setAuth(locals.token);

		// 3. Call your perfect `getCurrentUser` query from src/convex/auth.ts!
		const user = await convex.query(api.auth.getCurrentUser);

		if (!user) {
			return new Response('Unauthorized - User not found', { status: 401 });
		}

		// 4. Register the securely fetched user with Liveblocks
		const { status, body } = await liveblocks.identifyUser(
			{
				userId: user._id, // Ensure you use Convex's internal _id or the specific string ID Liveblocks expects
				groupIds: []
			},
			{
				userInfo: {
					name: user.name || 'Anonymous',
					email: user.email || '',
					avatar: user.image || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user._id}`
				}
			}
		);

		return new Response(body, { status });
	} catch (error) {
		console.error('Liveblocks Auth Error:', error);
		return new Response('Internal Server Error', { status: 500 });
	}
}
