// Define Liveblocks types for your application
// https://liveblocks.io/docs/api-reference/liveblocks-client#Typing-your-data
declare global {
	interface Liveblocks {
		// Each user's Presence, for room.getPresence, room.subscribe("others"), etc.
		Presence: Record<string, never>;

		// The Storage tree for the room, for room.getStorage, room.subscribe(storageItem), etc.
		Storage: Record<string, never>;

		// Custom user info set when authenticating with a secret key
		UserMeta: {
			id: string;
			info: Record<string, never>;
		};

		// Custom events, for room.broadcastEvent, room.subscribe("event")
		RoomEvent: Record<string, never>;

		// Custom metadata set on threads, for use in React
		ThreadMetadata: Record<string, never>;

		// Custom room info set with resolveRoomsInfo, for use in React
		RoomInfo: Record<string, never>;
	}
}

export {};
