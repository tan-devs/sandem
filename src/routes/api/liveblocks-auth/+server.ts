import { type RequestEvent } from '@sveltejs/kit';
import { LIVEBLOCKS_SECRET_KEY } from '$env/static/private';
import { Liveblocks } from '@liveblocks/node';

// 1. Import your Better Auth client (adjust the path if needed)
import { authClient } from '$lib/auth-client.js';

const liveblocks = new Liveblocks({
	secret: LIVEBLOCKS_SECRET_KEY
});

export async function POST({ request }: RequestEvent): Promise<Response> {
	try {
		// 2. Fetch the session from Better Auth / Convex.
		// We pass `request.headers` so that Better Auth can read the session cookie
		// that the user's browser sent to this API route.
		const { data: session, error } = await authClient.getSession({
			fetchOptions: {
				headers: request.headers
			}
		});

		// 3. Reject the request if they aren't logged in
		if (error || !session?.user) {
			return new Response('Unauthorized', { status: 401 });
		}

		// 4. Register the user with Liveblocks
		const { status, body } = await liveblocks.identifyUser(
			{
				userId: session.user.id,
				groupIds: []
			},
			{
				userInfo: {
					name: session.user.name,
					email: session.user.email,
					// If the user doesn't have an avatar, give them a placeholder based on their ID
					avatar:
						session.user.image ||
						`https://api.dicebear.com/7.x/avataaars/svg?seed=${session.user.id}`
				}
			}
		);

		return new Response(body, { status });
	} catch (error) {
		console.error('Authentication error:', error);
		return new Response('Internal Server Error', { status: 500 });
	}
}
