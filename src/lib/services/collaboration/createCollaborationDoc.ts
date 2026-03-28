import * as Y from 'yjs';
import { LiveblocksYjsProvider } from '@liveblocks/yjs';
import type { Room } from '@liveblocks/client';

export type YDocContext = {
	room: Room;
	/** Called once the provider has synced with the server. */
	onSync: (isSynced: boolean) => void;
	/** Called on every Yjs document update. */
	onUpdate: (ydoc: Y.Doc, origin: unknown) => void;
};

export type YDocSession = {
	ydoc: Y.Doc;
	provider: LiveblocksYjsProvider;
	dispose: () => void;
};

function detachProviderListener(
	provider: LiveblocksYjsProvider,
	event: string,
	handler: (...args: unknown[]) => void
) {
	const emitter = provider as unknown as {
		off?: (event: string, listener: (...args: unknown[]) => void) => void;
		removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
		removeEventListener?: (event: string, listener: (...args: unknown[]) => void) => void;
	};
	emitter.off?.(event, handler);
	emitter.removeListener?.(event, handler);
	emitter.removeEventListener?.(event, handler);
}

/**
 * Creates a Yjs document and a LiveblocksYjsProvider bound to the given room.
 *
 * Injected: `YDocContext` — room handle, sync callback, update callback.
 * Returns `{ ydoc, provider, dispose }`.
 *
 * `dispose` detaches all listeners and destroys the provider; the ydoc itself
 * is left alive because Monaco bindings may still hold a reference when dispose
 * is called — callers can `ydoc.destroy()` themselves if needed.
 */
export function createCollaborationYDoc(ctx: YDocContext): YDocSession {
	const ydoc = new Y.Doc();
	const provider = new LiveblocksYjsProvider(ctx.room, ydoc);

	const onProviderSync = (isSynced: boolean) => ctx.onSync(isSynced);
	provider.on('sync', onProviderSync);

	const onYDocUpdate = (_update: Uint8Array, origin: unknown) => ctx.onUpdate(ydoc, origin);
	ydoc.on('update', onYDocUpdate);

	return {
		ydoc,
		provider,
		dispose() {
			detachProviderListener(provider, 'sync', onProviderSync as (...args: unknown[]) => void);
			ydoc.off('update', onYDocUpdate);
		}
	};
}
