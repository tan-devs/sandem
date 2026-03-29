import type { IDEContext } from '$lib/context/ide-context.js';
import { appendTerminalAudit, collaborationPermissionsStore, getPanelsContext } from '$lib/stores';
import { createShellProcess } from './createShellProcess.svelte.js';
import { createTerminalPanelController } from './createTerminalPanel.svelte.js';
import { createTerminalSessionsController } from './createTerminalSessions.svelte.js';
import { createTerminalWorkspaceController } from './createTerminalWorkspace.svelte.js';

/**
 * Composes the full terminal stack from injected dependencies.
 *
 * All external concerns — IDE context, store subscriptions, panel layout —
 * are injected here rather than imported directly in Terminal.svelte.
 * This keeps the component a pure consumer of the returned object.
 *
 * Returns the three sub-controllers plus the composed workspace so that
 * Terminal.svelte and useTerminal can destructure exactly what they need.
 */
export function createTerminal(ide: IDEContext) {
	// ── Permissions (reactive, updated via subscription in useTerminal) ───────

	let canExecute = $state(true);
	let roomId = $state<string | null>(null);

	function applyPermissions(canWrite: boolean, room: string | null) {
		canExecute = canWrite;
		roomId = room;
	}

	// ── Sub-controllers ───────────────────────────────────────────────────────

	const panel = createTerminalPanelController();
	const sessions = createTerminalSessionsController();
	const layout = getPanelsContext();

	const workspace = createTerminalWorkspaceController({
		panel,
		sessions,
		createShell: ({ canExecute: shellCanExecute, onAudit }) =>
			createShellProcess(ide.getWebcontainer, {
				canExecute: shellCanExecute,
				onAudit
			}),
		canExecute: () => canExecute,
		getRoomId: () => roomId,
		recordAudit: appendTerminalAudit,
		getLayout: () => layout
	});

	return {
		// Sub-controllers — exposed so useTerminal and Terminal.svelte
		// can access granular state without going through workspace.
		panel,
		sessions,
		workspace,

		// Permissions — managed here, applied via useTerminal's subscription
		applyPermissions,
		get canExecute() {
			return canExecute;
		}
	};
}

export type TerminalComposition = ReturnType<typeof createTerminal>;

// Re-export store subscription helper so useTerminal stays import-free
// of store internals.
export { collaborationPermissionsStore };
