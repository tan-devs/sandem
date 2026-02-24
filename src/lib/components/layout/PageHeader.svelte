<script lang="ts">
	import type { Snippet } from 'svelte';
	let {
		badge,
		redirect,
		heading,
		subtitle,
		children
	}: {
		badge?: Snippet;
		redirect?: Snippet;
		heading: string;
		subtitle?: string;
		children?: Snippet;
	} = $props();
</script>

<header class="page-header">
	{#if badge}
		<div class="badge">
			{@render badge()}
		</div>
	{/if}

	<h1 class="heading">{heading}</h1>

	{#if subtitle}
		<p class="subtitle">{subtitle}</p>
	{/if}

	{#if redirect}
		<nav class="actions">
			{@render redirect()}
		</nav>
	{/if}

	{#if children}
		{@render children()}
	{/if}
</header>

<style>
	.page-header {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		padding: 4rem 1rem; /* Generous vertical spacing */
		gap: 1.5rem;
		max-width: 800px;
		margin: 0 auto; /* Centers the header container */
	}

	.badge {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
		font-weight: 500;
	}

	.heading {
		font-size: clamp(2rem, 5vw, 3.5rem); /* Responsive font sizing */
		line-height: 1.1;
		margin: 0;
	}

	.subtitle {
		font-size: 1.125rem;
		line-height: 1.6;
		max-width: 60ch; /* Limits width for better readability */
		margin: 0;
	}

	.actions {
		display: flex;
		gap: 1rem;
		margin-top: 1rem;
		flex-wrap: wrap;
		justify-content: center;
	}
</style>
