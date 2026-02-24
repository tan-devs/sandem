<script lang="ts">
	import { page } from '$app/stores';
	import ModeToggle from '$lib/components/colors/ModeToggle.svelte';
	import Search from '$lib/components/ui/Search.svelte';
	import Button from '$lib/components/ui/Button.svelte';

	let { variant = 'standard', brandName = 'convex-svelte', links = [] } = $props();

	let searchQuery = $state('');
	let showMobileMenu = $state(false);

	// Helper to check active route
	const isActive = (path: string) => $page.url.pathname === path;
</script>

<header class="navbar" data-variant={variant}>
	{#if variant === 'standard'}
		<nav class="container">
			<div class="left">
				<a href="/" class="brand">{brandName}</a>
				<ul class="nav-links">
					{#each links as link}
						<li>
							<a href={link.path} class="nav-link" class:active={isActive(link.path)}>
								{link.label}
							</a>
						</li>
					{/each}
				</ul>
			</div>

			<div class="right">
				<div class="search-box">
					<Search bind:value={searchQuery} placeholder="Quick search..." />
				</div>
				<ModeToggle />
				<Button
					variant="outline"
					size="sm"
					class="mobile-toggle"
					onclick={() => (showMobileMenu = !showMobileMenu)}
				>
					Menu
				</Button>
			</div>
		</nav>
	{:else}
		<nav class="ide-bar">
			<div class="ide-left">
				<button class="ide-icon-btn" title="Site Menu">
					<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
						<path d="M1 3h14v2H1V3zm0 4h14v2H1V7zm0 4h14v2H1v-2z" />
					</svg>
				</button>

				<div class="menu-group">
					<button class="menu-item">File</button>
					<button class="menu-item">Edit</button>
					<button class="menu-item">Selection</button>
					<button class="menu-item">View</button>
					<button class="menu-item">Go</button>
				</div>
			</div>

			<div class="ide-center">
				<span class="project-name">project-main — Convex IDE</span>
			</div>

			<div class="ide-right">
				<div class="ide-search">
					<Search bind:value={searchQuery} placeholder="Search files..." />
				</div>
				<ModeToggle />
			</div>
		</nav>
	{/if}
</header>

<style>
	/* --- Base Header Styles --- */
	.navbar {
		width: 100%;
		z-index: 100;
		transition: all var(--time) var(--ease);
		border-bottom: 1px solid var(--border);
	}

	/* --- Variant: Standard --- */
	.navbar[data-variant='standard'] {
		background: var(--bg);
		height: 64px;
		display: flex;
		align-items: center;
	}

	.container {
		max-width: 1200px;
		margin: 0 auto;
		width: 100%;
		padding: 0 1.5rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.left,
	.right {
		display: flex;
		align-items: center;
		gap: 2rem;
	}

	.brand {
		font-weight: 700;
		font-size: 1.1rem;
		color: var(--text);
		text-decoration: none;
		letter-spacing: -0.02em;
	}

	.nav-links {
		display: flex;
		list-style: none;
		gap: 0.5rem;
	}

	.nav-link {
		text-decoration: none;
		color: var(--muted);
		font-size: 0.9rem;
		font-weight: 500;
		padding: 0.5rem 0.75rem;
		border-radius: var(--radius);
		transition: all var(--time) var(--ease);
	}

	.nav-link:hover,
	.nav-link.active {
		color: var(--text);
		background: var(--mg);
	}

	.search-box {
		width: 200px;
	}

	/* --- Variant: IDE (VSCode style) --- */
	.navbar[data-variant='ide'] {
		background: var(--fg); /* Darker hierarchy */
		height: 35px;
		font-size: 0.8rem;
	}

	.ide-bar {
		display: flex;
		height: 100%;
		align-items: center;
		justify-content: space-between;
		padding: 0 0.5rem;
		position: relative;
	}

	.ide-left,
	.ide-right {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.ide-icon-btn {
		background: transparent;
		border: none;
		color: var(--muted);
		padding: 4px;
		cursor: pointer;
		display: flex;
		border-radius: 4px;
	}

	.ide-icon-btn:hover {
		background: var(--mg);
		color: var(--accent);
	}

	.menu-group {
		display: flex;
		margin-left: 0.5rem;
	}

	.menu-item {
		background: transparent;
		border: none;
		color: var(--text);
		padding: 2px 8px;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.75rem;
	}

	.menu-item:hover {
		background: var(--mg);
	}

	.ide-center {
		position: absolute;
		left: 50%;
		transform: translateX(-50%);
		color: var(--muted);
		pointer-events: none;
		white-space: nowrap;
	}

	.ide-search {
		width: 300px;
		transform: scale(0.9); /* Make search slightly more compact for IDE */
	}

	/* --- Responsiveness --- */
	@media (max-width: 768px) {
		.nav-links,
		.search-box {
			display: none;
		}

		.ide-center,
		.menu-group {
			display: none;
		}
	}
</style>
