<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import { type Snippet } from 'svelte';

	import { page } from '$app/state';
	import { goto } from '$app/navigation';

	import { NavigationMenu, type WithoutChildrenOrChild } from 'bits-ui';
	import NavigationList from '$lib/components/primitives/NavigationList.svelte';

	import SearchBar from '$lib/components/primitives/SearchBar.svelte';
	import AppMenu from '$lib/components/workspace/AppMenu.svelte';
	import CommandPalette from '$lib/components/workspace/CommandPalette.svelte';
	import PanelControls from '$lib/components/primitives/PanelControls.svelte';
	import WindowControls from '$lib/components/primitives/WindowControls.svelte';
	import ThemeSwitcher from '$lib/components/colors/ThemeSwitcher.svelte';
	import ModeToggle from '$lib/components/colors/ModeToggle.svelte';

	import type { IDEPanelsAdapter } from '$lib/controllers/panels';
	import { globalSearchKeydown } from '$lib/services/workspace';

	const links = [
		{ path: '/repo', label: 'repo' },
		{ path: '/shop', label: 'shop' },
		{ path: '/auth', label: 'auth' }
	];

	const menus = ['File', 'Edit', 'Selection', 'View', 'Go', 'Run', 'Terminal', 'Help'];

	let {
		variant = 'default',
		class: className,
		ref = $bindable(null),
		search,
		children,
		panels,
		...rest
	}: WithoutChildrenOrChild<NavigationMenu.RootProps> & {
		variant?: 'default' | 'outline' | 'ghost';
		class?: string;
		search?: Snippet;
		children?: Snippet;
		panels?: IDEPanelsAdapter;
	} = $props();

	let globalQuery = $state('');

	const isRepoRoute = $derived(page.url.pathname.startsWith('/repo'));

	function handleGlobalSearchKeydown(event: KeyboardEvent) {
		globalSearchKeydown(event, globalQuery, (path) => goto(path));
	}
</script>

<NavigationMenu.Root data-variant={variant} class={className} {...rest} bind:ref>
	{#snippet child({ props })}
		<header {...props} class="app-header" aria-label="Application header">
			<div class="left">
				<a href="/" class="favicon" aria-label="Go home" title="Home">
					<img src={favicon} alt="home" />
				</a>
				<NavigationList {links} />
				{#if isRepoRoute}
					<AppMenu {menus} {panels} />
				{/if}
			</div>

			<div class="center">
				{#if search}
					{@render search()}
				{:else if isRepoRoute}
					<CommandPalette />
				{:else}
					<SearchBar
						bind:value={globalQuery}
						placeholder="...search"
						size="sm"
						class="search-bar"
						onkeydown={handleGlobalSearchKeydown}
					/>
				{/if}
			</div>

			<div class="right">
				<div class="tb-right">
					{#if isRepoRoute}
						<PanelControls {panels} />
					{/if}
					<div class="tb-sep"></div>
					<div class="action-items">
						<ModeToggle />
						<ThemeSwitcher />
					</div>
					<div class="tb-sep"></div>
					<WindowControls />
				</div>
				{#if children}{@render children()}{/if}
			</div>

			<div class="viewport">
				<NavigationMenu.Viewport />
			</div>
		</header>
	{/snippet}
</NavigationMenu.Root>

<style>
	.app-header {
		z-index: 100;
		inset: 0 0 auto 0;
		width: 100%;
		height: var(--navbar-height, 30px);
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 4px;
		padding: 0 0 0 4px;
		background: var(--mg);
		border-bottom: 1px solid var(--border);
		user-select: none;
		font-family: var(--fonts);
		-webkit-app-region: drag;
	}

	.app-header :global(button),
	.app-header :global(a),
	.app-header :global(menu),
	.app-header :global(input) {
		-webkit-app-region: no-drag;
	}

	.left,
	.center,
	.right {
		display: flex;
		align-items: center;
		min-width: 0;
	}

	.left {
		gap: 0.5rem;
		overflow: hidden;
	}

	.center {
		justify-content: center;
		flex-shrink: 0;
		gap: 1px;
	}

	.right {
		justify-content: flex-end;
		gap: 0.35rem;
	}

	.favicon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 22px;
		min-width: 22px;
		border-radius: 4px;
		flex-shrink: 0;
		text-decoration: none;
	}
	.favicon img {
		width: 16px;
		height: 16px;
		display: block;
	}
	.favicon:hover {
		background: var(--fg);
	}

	.action-items {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		justify-content: flex-end;
	}
	.action-items :global(button) {
		height: 22px;
		min-width: 22px;
		border-radius: 4px;
	}
	.action-items :global(svg) {
		width: 14px;
		height: 14px;
	}

	.tb-right {
		display: flex;
		align-items: center;
		gap: 2px;
	}

	.tb-sep {
		width: 1px;
		height: 14px;
		background: var(--border);
		margin: 0 2px;
		flex-shrink: 0;
	}

	.viewport {
		display: contents;
	}

	:global(.search-bar) {
		width: 244px;
	}
</style>
