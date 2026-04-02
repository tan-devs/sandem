/**
 * createWebcontainerSingleton.svelte.ts
 *
 * Module-level singleton that boots WebContainer exactly once per page origin
 * and exposes reactive phase state so consumers can react to boot progress.
 *
 * Lifted out of createRuntimeManager so the boot fires at app layout level
 * ((app)/+layout.svelte) rather than at [repo]/+layout.svelte — giving the
 * container time to warm up while the user is still on the home/dashboard page.
 *
 * Usage:
 *   // (app)/+layout.svelte — fires boot early, no await needed
 *   import { wcSingleton } from '$lib/services/webcontainer/createWebcontainerSingleton.svelte';
 *   wcSingleton.boot();
 *
 *   // [repo]/+layout.svelte — runtime just consumes the already-booting instance
 *   createWorkspaceController({ getWebcontainer: wcSingleton.getWebcontainer, ... })
 */

import { WebContainer } from '@webcontainer/api';

export type WCSingletonPhase = 'idle' | 'booting' | 'ready' | 'failed';

function createWCSingleton() {
	// ── Reactive state ────────────────────────────────────────────────────────
	// $state here because (app)/+layout.svelte may want to show a subtle
	// indicator, and [repo]/+layout.svelte waits on `ready` before rendering.

	let phase = $state<WCSingletonPhase>('idle');
	let error = $state<string | null>(null);
	let instance = $state<WebContainer | null>(null);

	// Plain promise so concurrent callers all await the same boot.
	let bootPromise: Promise<WebContainer> | null = null;

	// ── Boot ──────────────────────────────────────────────────────────────────

	function boot(): Promise<WebContainer> {
		// Already booting or done — return the same promise.
		if (bootPromise) return bootPromise;

		phase = 'booting';
		error = null;

		bootPromise = WebContainer.boot()
			.then((wc) => {
				instance = wc;
				phase = 'ready';
				return wc;
			})
			.catch((err) => {
				phase = 'failed';
				error = err instanceof Error ? err.message : String(err);
				bootPromise = null; // allow retry
				throw err;
			});

		return bootPromise;
	}

	// ── Getters ───────────────────────────────────────────────────────────────

	/**
	 * Returns the WebContainer instance synchronously.
	 * Throws if not yet ready — callers inside [repo] should only call this
	 * after the runtime has confirmed phase === 'ready'.
	 */
	function getWebcontainer(): WebContainer {
		if (!instance) throw new Error('WebContainer is not ready yet.');
		return instance;
	}

	/**
	 * Waits for the boot to complete and returns the instance.
	 * Safe to call multiple times — resolves immediately if already ready.
	 */
	async function waitForWebcontainer(): Promise<WebContainer> {
		if (instance) return instance;
		if (bootPromise) return bootPromise;
		return boot();
	}

	// ── Public API ────────────────────────────────────────────────────────────

	return {
		get phase() {
			return phase;
		},
		get error() {
			return error;
		},
		get instance() {
			return instance;
		},
		get ready() {
			return phase === 'ready';
		},
		boot,
		getWebcontainer,
		waitForWebcontainer
	};
}

// Module-level singleton — one instance for the entire app lifetime.
export const wcSingleton = createWCSingleton();
