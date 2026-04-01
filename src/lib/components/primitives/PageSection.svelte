<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		variant = 'default',
		label,
		heading,
		children,
		aside
	}: {
		/**
		 * default   — centered header, standard padding
		 * split     — two-column, main + aside
		 * wide      — full-bleed, no max-width
		 * grid      — auto-fit card grid, centered header
		 */
		variant?: 'default' | 'split' | 'wide' | 'grid';
		heading?: string;
		label?: string;
		children: Snippet;
		aside?: Snippet;
	} = $props();
</script>

<section class="section" data-variant={variant} aria-label={label}>
	<div class="inner">
		{#if heading}
			<header class="header">
				<h2 class="heading">{@html heading}</h2>
			</header>
		{/if}

		<article class="content">
			{@render children()}
			{#if aside}
				<aside class="aside">
					{@render aside()}
				</aside>
			{/if}
		</article>
	</div>
</section>

<style>
	.section {
		padding: clamp(1rem, 2vw, 2rem);
	}

	.inner {
		max-width: 80rem;
		margin-inline: auto;
		display: grid;
		gap: 1rem;
	}

	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.heading {
		font-size: clamp(1.125rem, 1rem + 1vw, 1.75rem);
		line-height: 1.2;
		color: var(--text);
	}

	.content {
		display: grid;
		gap: 1rem;
	}

	.aside {
		padding: 1rem;
		border: 1px solid var(--border);
		border-radius: calc(var(--radius) / 3);
		background: var(--fg);
	}

	.heading :global(em) {
		color: var(--accent);
		font-style: normal;
	}

	.section[data-variant='split'] .content {
		grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
		align-items: start;
	}

	.section[data-variant='wide'] .inner {
		max-width: none;
	}

	.section[data-variant='grid'] .content {
		grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
	}

	@media (max-width: 900px) {
		.section[data-variant='split'] .content {
			grid-template-columns: 1fr;
		}
	}
</style>
