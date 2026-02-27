<script lang="ts">
	import { requireIDEContext } from '$lib/context/ide-context.js';
	import { createPreview } from '$lib/hooks/createPreview.svelte.js';

	const ide = requireIDEContext();

	// createPreview (not usePreview — that export doesn't exist)
	const preview = createPreview(ide.getWebcontainer);

	// Start listening as soon as the container is available.
	// Because we're inside the {#if project.data && webcontainerInstance} gate
	// in the layout, getWebcontainer() is guaranteed to succeed here.
	// We use $effect instead of onMount so it re-runs if the container is
	// ever replaced (e.g. hot-reload in dev).
	$effect(() => {
		preview.listenForServer();
	});
</script>

<div class="preview-shell">
	<div class="browser-toolbar">
		<button class="icon-btn" onclick={preview.reload} disabled={!preview.url} aria-label="Refresh">
			<!-- Refresh icon -->
			<svg
				width="14"
				height="14"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<path d="M21 2v6h-6"></path>
				<path d="M3 12a9 9 0 1 0 2.13-5.85L7 8"></path>
			</svg>
		</button>

		<div class="address-bar">
			<span class="url-text">{preview.url || 'Waiting for dev server…'}</span>
		</div>

		<a
			href={preview.url || '#'}
			target="_blank"
			rel="noopener noreferrer"
			class="icon-btn"
			class:disabled={!preview.url}
			aria-label="Open in new tab"
		>
			<!-- External-link icon -->
			<svg
				width="14"
				height="14"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
				<polyline points="15 3 21 3 21 9"></polyline>
				<line x1="10" y1="14" x2="21" y2="3"></line>
			</svg>
		</a>
	</div>

	<div class="iframe-container">
		{#if preview.url}
			{#key preview.key}
				<iframe title="WebContainer Preview" src={preview.url} allow="cross-origin-isolated"
				></iframe>
			{/key}
		{:else}
			<div class="empty-state">
				<div class="spinner"></div>
				<p>
					Run <code>npm run dev</code> in the terminal to start the preview.
				</p>
			</div>
		{/if}
	</div>
</div>

<style>
	.preview-shell {
		display: flex;
		flex-direction: column;
		height: 100%;
		width: 100%;
		background-color: var(--bg);
	}

	.browser-toolbar {
		display: flex;
		align-items: center;
		padding: 6px 10px;
		background-color: var(--fg);
		border-bottom: 1px solid var(--border);
		gap: 8px;
		flex-shrink: 0;
	}

	.address-bar {
		flex: 1;
		background-color: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		padding: 4px 10px;
		overflow: hidden;
	}

	.url-text {
		color: var(--accent);
		font-family: var(--fonts-mono);
		font-size: 11px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		display: block;
	}

	.icon-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		color: var(--muted);
		cursor: pointer;
		padding: 4px;
		border-radius: var(--radius-sm);
		transition:
			background-color var(--time) var(--ease),
			color var(--time) var(--ease);
		flex-shrink: 0;
	}

	.icon-btn:hover:not(.disabled):not(:disabled) {
		background-color: var(--mg);
		color: var(--text);
	}

	.icon-btn:disabled,
	.icon-btn.disabled {
		opacity: 0.4;
		cursor: not-allowed;
		pointer-events: none;
	}

	.iframe-container {
		flex: 1;
		position: relative;
		overflow: hidden;
	}

	iframe {
		width: 100%;
		height: 100%;
		border: none;
		display: block;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 16px;
		height: 100%;
		background: var(--bg);
		color: var(--muted);
		font-family: var(--fonts);
		font-size: 13px;
		text-align: center;
		padding: 24px;
	}

	.empty-state code {
		background: var(--fg);
		padding: 2px 6px;
		border-radius: var(--radius-sm);
		color: var(--accent);
		font-family: var(--fonts-mono);
		font-size: 12px;
	}

	.spinner {
		width: 28px;
		height: 28px;
		border: 2px solid var(--border);
		border-top-color: var(--accent);
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
