/**
 * createWebcontainer.svelte.ts
 *
 * Low-level WebContainer boot + runtime lifecycle.
 *
 * getWebContainer()       — module-level singleton boot (used by wcSingleton internally)
 * createRuntimeManager()  — reactive phase machine consumed by createWorkspaceRuntime
 *
 * CHANGE: createRuntimeManager now accepts an optional `getExternalWebcontainer`
 * dep. When provided it skips WebContainer.boot() entirely and uses the
 * already-booted instance from wcSingleton. This is the seam that lets
 * (app)/+layout.svelte pre-boot the container before [repo] ever mounts.
 */

import { WebContainer } from '@webcontainer/api';
import { buildFileSystemTree } from '$lib/utils/vfs';
import { createError } from '$lib/sveltekit/index.js';
import type { FileSystemTree } from '@webcontainer/api';
import type { Doc } from '$convex/_generated/dataModel.js';

type ProjectDoc = Doc<'projects'>;

// ── Module-level singleton boot ───────────────────────────────────────────────
// Kept for backward compat. wcSingleton delegates here internally.

let _instance: WebContainer | null = null;

export async function getWebContainer(): Promise<WebContainer> {
	if (!_instance) {
		_instance = await WebContainer.boot();
	}
	return _instance;
}

export async function mountProject(
	nodes: Array<{ path: string; type: 'file' | 'folder'; content?: string }>
): Promise<WebContainer> {
	const instance = await getWebContainer();
	const tree = buildFileSystemTree(nodes);
	await instance.mount(tree);

	if (tree['package.json']) {
		const install = await instance.spawn('npm', ['install']);
		await install.exit;
	}

	return instance;
}

// ── Runtime manager ───────────────────────────────────────────────────────────

export type RuntimePhase = 'idle' | 'mounting' | 'installing' | 'ready' | 'failed';

export type RuntimeManagerOptions = {
	isDemo: () => boolean;
	getProjects: () => ProjectDoc[];
	getEntryPath: () => string;
	getWorkspaceTree: () => FileSystemTree;
	/**
	 * When provided, the runtime manager skips WebContainer.boot() and uses
	 * this instance directly. Pass `wcSingleton.getWebcontainer` here when
	 * the singleton has already been booted at the app layout level.
	 */
	getExternalWebcontainer?: () => Promise<WebContainer>;
};

export function createRuntimeManager(options: RuntimeManagerOptions) {
	let runtimePhase = $state<RuntimePhase>('idle');
	let runtimeError = $state<ReturnType<typeof createError> | null>(null);
	let webcontainer = $state<WebContainer | null>(null);

	const ready = $derived(runtimePhase === 'ready');

	async function startRuntime(): Promise<void> {
		if (runtimePhase === 'mounting' || runtimePhase === 'installing' || runtimePhase === 'ready') {
			return;
		}

		runtimePhase = 'mounting';
		runtimeError = null;

		try {
			// Use external singleton if provided — avoids a second WebContainer.boot() call.
			if (options.getExternalWebcontainer) {
				console.log('[RuntimeManager] using external WC singleton ✓');
				webcontainer = await options.getExternalWebcontainer();
			} else {
				console.warn('[RuntimeManager] WARNING: booting new WC instance — double-boot risk');
				webcontainer = await getWebContainer();
			}
			await webcontainer.mount(options.getWorkspaceTree());

			runtimePhase = 'installing';

			const tree = options.getWorkspaceTree();
			console.log('[RuntimeManager] tree keys:', Object.keys(tree));
			console.log(
				'[RuntimeManager] package.json:',
				tree['package.json']
					? JSON.parse((tree['package.json'] as { file: { contents: string } }).file.contents)
					: 'MISSING'
			);

			const install = await webcontainer.spawn('npm', ['install']);
			const exitCode = await install.exit;
			console.log('[RuntimeManager] npm exit code raw:', exitCode);

			if (exitCode !== 0) {
				throw new Error(`npm install failed with exit code ${exitCode}`);
			}

			runtimePhase = 'ready';
		} catch (err) {
			failRuntimeWithError(createError('Failed to start the sandbox runtime.'), err);
		}
	}

	async function stopRuntime(): Promise<void> {
		// Only teardown if we own the instance (no external singleton).
		if (!options.getExternalWebcontainer) {
			webcontainer?.teardown();
		}
		webcontainer = null;
		runtimePhase = 'idle';
		runtimeError = null;
	}

	function failRuntimeWithError(err: ReturnType<typeof createError>, cause?: unknown): void {
		runtimePhase = 'failed';
		runtimeError = err;
		console.error('[RuntimeManager] Unrecoverable error:', cause ?? err);
	}

	return {
		get runtimePhase() {
			return runtimePhase;
		},
		get runtimeError() {
			return runtimeError;
		},
		get ready() {
			return ready;
		},
		get webcontainer() {
			return webcontainer;
		},
		startRuntime,
		stopRuntime,
		failRuntimeWithError
	};
}

export type RuntimeManager = ReturnType<typeof createRuntimeManager>;
