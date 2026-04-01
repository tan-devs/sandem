import { getLiveblocksClient } from '$lib/liveblocks.config.js';
import type { LsonObject, Json } from '@liveblocks/client';
import type {
	CollaborationRole,
	CursorPresence,
	SelectionPresence
} from '$lib/stores/collaboration';

/**
 * The presence shape sent over the Liveblocks wire (cursor + selection only).
 * Named RoomPresence to avoid collision with the store's CollaborationPresence
 * type, which is the full hydrated user record.
 */
export type RoomPresence = {
	cursor?: CursorPresence | null;
	selection?: SelectionPresence | null;
};

export type CollaborationUserInfo = {
	name?: string;
	avatar?: string;
	role?: CollaborationRole;
};

export type CollaborationUserMeta = {
	id?: string;
	info?: CollaborationUserInfo;
};

export type CollaborationRoom = import('@liveblocks/client').Room<
	RoomPresence,
	LsonObject,
	CollaborationUserMeta,
	Json
>;

export type RoomSession = {
	room: CollaborationRoom;
	leave: () => void;
};

/**
 * Enters a Liveblocks room and returns the room handle + leave callback.
 * Always call `leave()` on teardown to release the server connection.
 */
export function enterRoom(projectRoom: string): RoomSession {
	const client = getLiveblocksClient();
	const entered = client.enterRoom(projectRoom, {
		initialPresence: { cursor: null, selection: null }
	});
	return {
		room: entered.room as CollaborationRoom,
		leave: entered.leave
	};
}
