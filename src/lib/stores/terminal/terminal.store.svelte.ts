import { createTerminalPanelStore, createTerminalSessionStore } from '$lib/stores/terminal';

export function createTerminalStore() {
	const panel = createTerminalPanelStore();
	const sessions = createTerminalSessionStore();

	let canExecute = $state(true);
	let roomId = $state<string | null>(null);

	return {
		panel,
		sessions,
		get canExecute() {
			return canExecute;
		},
		get roomId() {
			return roomId;
		},
		applyPermissions: (canWrite: boolean, room: string | null) => {
			canExecute = canWrite;
			roomId = room;
		}
	};
}

export type TerminalStore = ReturnType<typeof createTerminalStore>;
export const terminalStore = createTerminalStore();
