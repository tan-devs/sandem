import type { TerminalComposition } from '$lib/services';
import { collaborationPermissionsStore } from '$lib/stores';

/**
 * Owns the Terminal component's full lifecycle:
 *   - Liveblocks permissions subscription (canExecute / roomId)
 *   - Session storage restore on mount
 *   - Runtime sync effect registration
 *   - Workspace teardown on destroy
 *
 * Call `mount()` inside onMount and pass its return value to onDestroy.
 *
 * Pure in the project sense: all dependencies come in via the
 * TerminalComposition object; nothing is imported from module-level
 * singletons except the permissions store (which is re-exported from
 * createTerminal to keep this file decoupled from $lib/stores).
 */
export function useTerminal(terminal: TerminalComposition) {
	const { sessions, workspace, applyPermissions } = terminal;

	// ── Reactive runtime sync ─────────────────────────────────────────────────

	// Registered during component init so it runs in the correct Svelte 5
	// reactive context. Tracks session list changes and reconciles runtimes.
	$effect(() => {
		workspace.syncRuntimes();
	});

	// ── Mount / destroy ───────────────────────────────────────────────────────

	function mount() {
		// Restore persisted session list before syncing runtimes.
		sessions.restoreFromStorage();
		workspace.syncRuntimes();

		// Subscribe to collaboration permissions so canExecute and roomId
		// stay reactive without coupling Terminal.svelte to the store directly.
		const unsubscribePermissions = collaborationPermissionsStore.subscribe((value) => {
			applyPermissions(value.canWrite, value.roomId);
		});

		return function destroy() {
			unsubscribePermissions();
			workspace.destroy();
		};
	}

	return { mount };
}
