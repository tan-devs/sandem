import { writable } from 'svelte/store';

export type CollaborationRole = 'owner' | 'editor' | 'viewer' | 'unknown';

export type CursorPresence = {
	path?: string;
	line?: number;
	column?: number;
	x?: number;
	y?: number;
};

export type SelectionPresence = {
	path?: string;
	startLine: number;
	startColumn: number;
	endLine: number;
	endColumn: number;
};

export type CollaborationPresence = {
	connectionId: number;
	userId: string;
	name: string;
	avatar: string;
	role: CollaborationRole;
	canWrite: boolean;
	cursor: CursorPresence | null;
	selection: SelectionPresence | null;
};

export type CollaborationPermissions = {
	roomId: string | null;
	role: CollaborationRole;
	canWrite: boolean;
};

export type TerminalAuditEntry = {
	at: number;
	command: string;
	allowed: boolean;
	roomId: string | null;
};

const DEFAULT_PERMISSIONS: CollaborationPermissions = {
	roomId: null,
	role: 'unknown',
	canWrite: true
};

export const collaborationPresenceStore = writable<CollaborationPresence[]>([]);
export const collaborationPermissionsStore =
	writable<CollaborationPermissions>(DEFAULT_PERMISSIONS);
export const terminalAuditStore = writable<TerminalAuditEntry[]>([]);

export function resetCollaborationStores() {
	collaborationPresenceStore.set([]);
	collaborationPermissionsStore.set(DEFAULT_PERMISSIONS);
}

export function setCollaborationPermissions(next: CollaborationPermissions) {
	collaborationPermissionsStore.set(next);
}

export function setCollaborationPresence(next: CollaborationPresence[]) {
	collaborationPresenceStore.set(next);
}

export function appendTerminalAudit(entry: TerminalAuditEntry) {
	terminalAuditStore.update((current) => {
		const next = [...current, entry];
		if (next.length > 200) {
			return next.slice(next.length - 200);
		}
		return next;
	});
}
