<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/stores';
	import Button from '$lib/components/ui/Button.svelte';
	import ModeToggle from '$lib/components/colors/ModeToggle.svelte';
	import ThemeSwitcher from '$lib/components/colors/ThemeSwitcher.svelte';

	let {
		variant = 'standard',
		links = [],
		field,
		actions
	}: {
		variant?: 'standard' | 'transparent';
		links?: { path: string; label: string }[];
		field?: Snippet;
		actions?: Snippet;
	} = $props();

	// Reactive active-link check — updates on every navigation
	let pathname = $derived($page.url.pathname);

	function isActive(path: string): boolean {
		// Exact match for home, prefix match for all others
		return path === '/' ? pathname === '/' : pathname.startsWith(path);
	}
</script>

<nav class="navbar" data-variant={variant} aria-label="Main navigation">
	<!-- Left: brand + links -->
	<div class="navbar-left">
		<a href="/" class="brand" aria-label="Home">
			<span class="brand-mark" aria-hidden="true"></span>
			<span class="brand-name">devspace</span>
		</a>

		{#if links.length > 0}
			<div class="nav-links" role="list">
				{#each links as link}
					<div role="listitem">
						<Button
							href={link.path}
							variant="link"
							active={isActive(link.path)}
							aria-current={isActive(link.path) ? 'page' : undefined}
						>
							{link.label}
						</Button>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Centre: optional field snippet (e.g. SearchBar) -->
	{#if field}
		<div class="navbar-center">
			{@render field()}
		</div>
	{/if}

	<!-- Right: optional actions snippet + theme controls -->
	<div class="navbar-right">
		{#if actions}
			<div class="navbar-actions">
				{@render actions()}
			</div>
		{/if}

		<div class="navbar-controls">
			<ThemeSwitcher />
			<ModeToggle />
		</div>
	</div>
</nav>

<style>
	/* ── Shell ───────────────────────────────────────────────────── */
	.navbar {
		position: sticky;
		top: 0;
		z-index: 100;
		height: var(--navbar-height);
		width: 100%;

		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0 1.25rem;
	}

	/* standard: solid surface */
	.navbar[data-variant='standard'] {
		background: var(--fg);
		border-bottom: 1px solid var(--border);
		box-shadow: var(--shadow);
	}

	/* transparent: glass — for landing pages */
	.navbar[data-variant='transparent'] {
		background: var(--glass-bg);
		border-bottom: 1px solid var(--glass-border);
		backdrop-filter: var(--backdrop-blur);
		-webkit-backdrop-filter: var(--backdrop-blur);
	}

	/* ── Left ────────────────────────────────────────────────────── */
	.navbar-left {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		flex-shrink: 0;
	}

	/* ── Brand ───────────────────────────────────────────────────── */
	.brand {
		display: inline-flex;
		align-items: center;
		gap: 0.55rem;
		padding: 0.25rem 0.5rem;
		border-radius: var(--radius-sm);
		text-decoration: none;
		transition:
			opacity var(--time) var(--ease),
			background-color var(--time) var(--ease);
		margin-right: 0.5rem;
	}

	.brand:hover {
		background: var(--mg);
	}

	.brand-mark {
		width: 22px;
		height: 22px;
		border-radius: 6px;
		background: var(--accent);
		flex-shrink: 0;
		/* Small inset notch to give the mark character */
		box-shadow:
			inset 0 1px 0 hsla(0, 0%, 100%, 0.18),
			0 1px 4px hsla(0, 0%, 0%, 0.25);
	}

	.brand-name {
		font-family: var(--fonts-mono);
		font-size: 0.8rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		color: var(--text);
	}

	/* ── Nav links ───────────────────────────────────────────────── */
	.nav-links {
		display: flex;
		align-items: center;
		/* Negative margin compensates for Button's own padding */
		margin-left: 0.125rem;
	}

	/* ── Centre ──────────────────────────────────────────────────── */
	.navbar-center {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		/* Constrain the field so it doesn't stretch full-width */
		max-width: 380px;
		/* Auto-centre between left and right */
		margin: 0 auto;
	}

	/* ── Right ───────────────────────────────────────────────────── */
	.navbar-right {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-shrink: 0;
		margin-left: auto;
	}

	.navbar-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.navbar-controls {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		/* Thin separator between actions and controls */
		padding-left: 0.5rem;
		border-left: 1px solid var(--border);
	}
</style>
