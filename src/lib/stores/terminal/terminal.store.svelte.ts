import { createTerminalPanelStore } from './terminal.panel.store.svelte.js';
import { createTerminalSessionStore } from './terminal.session.store.svelte.js';

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

// runs at SSR module evaluation time
export const TerminalStore = createTerminalStore();
