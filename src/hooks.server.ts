import type { Handle } from '@sveltejs/kit';
import { createAuth } from '$convex/functions/auth.js';
import { getToken } from '$lib/sveltekit/index.js';

export const handle: Handle = async ({ event, resolve }) => {
	// Skip auth + custom headers for WebContainer internal requests
	// (the long hash paths its service worker handles)
	const isWebContainerInternal = /^\/[a-z0-9]{20,}(\/|$)/i.test(event.url.pathname);

	if (!isWebContainerInternal) {
		event.locals.token = await getToken(createAuth, event.cookies);
	}

	const response = await resolve(event);

	if (event.url.pathname.startsWith('/api') || isWebContainerInternal) {
		return response;
	}

	// 2. Skip adding these headers to API endpoints.
	// Auth endpoints return immutable responses, and APIs don't need COOP/COEP anyway.
	if (event.url.pathname.startsWith('/api')) {
		return response;
	}

	// 3. Safely apply headers for HTML pages
	try {
		response.headers.set('Cross-Origin-Embedder-Policy', 'credentialless');
		response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
		return response;
	} catch {
		// If the response is STILL immutable (e.g., a page redirect),
		// we clone it into a new mutable Response.
		const mutableHeaders = new Headers(response.headers);
		mutableHeaders.set('Cross-Origin-Embedder-Policy', 'credentialless');
		mutableHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');

		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers: mutableHeaders
		});
	}
};
