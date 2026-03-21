// liveblocks.config.ts
import { createClient } from '@liveblocks/client';
import { browser } from '$app/environment';

// Define Liveblocks types based on your Convex user schema
declare global {
	interface Liveblocks {
		Presence: {
			cursor: {
				x?: number;
				y?: number;
				path?: string;
				line?: number;
				column?: number;
			} | null;
			selection: {
				path?: string;
				startLine: number;
				startColumn: number;
				endLine: number;
				endColumn: number;
			} | null;
		};
		Storage: Record<string, never>;
		UserMeta: {
			id: string; // Convex User ID
			info: {
				name: string;
				email: string;
				avatar: string;
				role?: 'owner' | 'editor' | 'viewer';
			};
		};
		RoomEvent:
			| {
					type: 'fs-op';
					opId: string;
					actorId: string;
					op: 'create' | 'rename' | 'delete';
					path: string;
					nextPath?: string;
					contents?: string;
					isDirectory?: boolean;
					ts: number;
			  }
			| {
					type: 'terminal-audit';
					roomId: string;
					command: string;
					allowed: boolean;
					at: number;
			  };
		ThreadMetadata: Record<string, never>;
		RoomInfo: Record<string, never>;
	}
}

let cachedClient: ReturnType<typeof createClient> | null = null;

export function getLiveblocksClient() {
	if (!browser) {
		throw new Error('Liveblocks client is only available in the browser');
	}

	if (cachedClient) return cachedClient;

	cachedClient = createClient({
		authEndpoint: async (room) => {
			const response = await fetch('/api/liveblocks-auth', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ room })
			});

			if (!response.ok) {
				throw new Error('Failed to authenticate with Liveblocks');
			}

			return await response.json();
		}
	});

	return cachedClient;
}
