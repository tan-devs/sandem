import { getLiveblocksClient } from '$lib/liveblocks.config.js';
import type { CollaborationRoom } from './createCollaborationPresence.js';

export type CollaborationRoomSession = {
	room: CollaborationRoom;
	leave: () => void;
};

export function createCollaborationRoom(projectRoom: string): CollaborationRoomSession {
	const client = getLiveblocksClient();
	const entered = client.enterRoom(projectRoom, {
		initialPresence: { cursor: null, selection: null }
	});
	return {
		room: entered.room,
		leave: entered.leave
	};
}
