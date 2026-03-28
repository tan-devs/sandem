import type { Room, LsonObject, Json } from '@liveblocks/client';
import {
	setCollaborationPresence,
	setCollaborationPermissions,
	type CollaborationRole,
	type CursorPresence,
	type SelectionPresence
} from '$lib/stores';

type CollaborationUserInfo = {
	name?: string;
	avatar?: string;
	role?: CollaborationRole;
};

type CollaborationUserMeta = {
	id?: string;
	info?: CollaborationUserInfo;
};

type LiveblocksCollaborationPresence = {
	cursor?: CursorPresence | null;
	selection?: SelectionPresence | null;
};

export type CollaborationRoom = Room<
	LiveblocksCollaborationPresence,
	LsonObject,
	CollaborationUserMeta,
	Json
>;

export type PresenceContext = {
	room: CollaborationRoom;
	roomId: string;
};

function asRole(value: unknown): CollaborationRole | undefined {
	if (value === 'owner' || value === 'editor' || value === 'viewer') return value;
	return undefined;
}

function deriveRole(role: CollaborationRole | undefined, canWrite: boolean): CollaborationRole {
	if (role) return role;
	return canWrite ? 'editor' : 'viewer';
}

/**
 * Subscribes to room presence events and propagates them to the collaboration
 * stores.
 *
 * Injected: `PresenceContext` (room handle + roomId string).
 * Returns a `dispose` function — call it when tearing down the session.
 *
 * Pure in the project sense: all dependencies come in via the context object;
 * nothing is imported from module-level singletons except store setters.
 */
export function createCollaborationPresence(ctx: PresenceContext): { dispose: () => void } {
	function updatePresenceList() {
		const others = ctx.room.getOthers();
		const self = ctx.room.getSelf();
		const users = self ? [self, ...others] : [...others];

		setCollaborationPresence(
			users.map((user) => ({
				connectionId: user.connectionId,
				userId: String(user.id),
				name: user.info?.name ?? 'Anonymous',
				avatar: user.info?.avatar ?? '',
				role: deriveRole(asRole(user.info?.role), user.canWrite),
				canWrite: user.canWrite,
				cursor: user.presence?.cursor ?? null,
				selection: user.presence?.selection ?? null
			}))
		);

		if (self) {
			setCollaborationPermissions({
				roomId: ctx.roomId,
				role: deriveRole(asRole(self.info?.role), self.canWrite),
				canWrite: self.canWrite
			});
		}
	}

	const unsubPresence = ctx.room.subscribe('my-presence', updatePresenceList);
	const unsubOthers = ctx.room.subscribe('others', updatePresenceList);

	// Populate stores immediately with the current snapshot.
	updatePresenceList();

	return {
		dispose() {
			unsubPresence();
			unsubOthers();
		}
	};
}
