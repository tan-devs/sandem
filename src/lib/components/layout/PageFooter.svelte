<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		icon,
		heading,
		subtitle,
		children
	}: {
		icon?: Snippet;
		heading: string;
		subtitle?: string;
		children?: Snippet;
	} = $props();
</script>

<footer class="page-footer">
	{#if icon}
		<div class="footer-icon">{@render icon()}</div>
	{/if}
	<h2 class="heading">{heading}</h2>
	{#if subtitle}
		<p class="subtitle text-muted">{subtitle}</p>
	{/if}
	{#if children}
		<div class="actions">{@render children()}</div>
	{/if}
</footer>

<style>
	.page-footer {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		padding: 6rem 1rem;
		gap: 1.5rem;
		max-width: 800px;
		margin: 0 auto;
	}

	.footer-icon {
		margin-bottom: 0.5rem;
	}

	.heading {
		font-size: 2rem; /* [cite: 10] */
		margin: 0;
	}

	.subtitle {
		font-size: 1.125rem; /* [cite: 6] */
		line-height: 1.6; /* [cite: 6] */
		max-width: 60ch; /* [cite: 6] */
		margin: 0;
	}

	.actions {
		display: flex;
		gap: 1rem;
		margin-top: 1rem;
		justify-content: center;
	}
</style>
