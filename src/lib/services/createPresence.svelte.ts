import {
	setCollaborationPresence,
	setCollaborationPermissions,
	type CollaborationRole
} from '$lib/stores';
import type { CollaborationRoom } from './createRoom.svelte.js';

export type PresenceContext = {
	room: CollaborationRoom;
	roomId: string;
};

function asRole(value: unknown): CollaborationRole | undefined {
	if (value === 'owner' || value === 'editor' || value === 'viewer') return value;
	return undefined;
}

function deriveRole(role: CollaborationRole | undefined, canWrite: boolean): CollaborationRole {
	return role ?? (canWrite ? 'editor' : 'viewer');
}

/**
 * Subscribes to room presence events and propagates them to the collaboration
 * stores. Returns `dispose` — call it when tearing down the session.
 */
export function syncPresence(ctx: PresenceContext): { dispose: () => void } {
	function update() {
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

	const unsubSelf = ctx.room.subscribe('my-presence', update);
	const unsubOthers = ctx.room.subscribe('others', update);
	update(); // populate stores immediately from current snapshot

	return {
		dispose() {
			unsubSelf();
			unsubOthers();
		}
	};
}
