<script lang="ts">
	import { NavigationMenu, type WithoutChildrenOrChild } from 'bits-ui';

	let {
		links = []
	}: WithoutChildrenOrChild<NavigationMenu.RootProps> & {
		links?: {
			path: string;
			label: string;
		}[];
	} = $props();
</script>

<NavigationMenu.List aria-label="Primary links">
	{#snippet child({ props })}
		<ul {...props} class="links">
			{#each links as link}
				<NavigationMenu.Item class="nav-item">
					<NavigationMenu.Link class="nav-link" href={link.path}>
						{link.label}
					</NavigationMenu.Link>
				</NavigationMenu.Item>
			{/each}
		</ul>
	{/snippet}
</NavigationMenu.List>

<style>
	.links {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	:global(.nav-item) {
		display: flex;
		align-items: center;
	}

	:global(.nav-link) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		height: 22px;
		padding: 0 10px;
		color: var(--muted);
		text-decoration: none;
		font-family: var(--fonts);
		font-size: 12px;
		border-radius: 4px;
		transition: all 0.1s ease;
	}

	:global(.nav-link:hover) {
		color: var(--text);
		background: var(--fg);
	}

	:global(.nav-link[data-active]) {
		color: var(--text);
		background: var(--border);
	}
</style>
