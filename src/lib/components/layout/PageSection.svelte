<script lang="ts">
	import type { Snippet } from 'svelte';
	let {
		heading,
		children,
		grid = false,
		prose = false
	}: {
		heading?: string;
		children: Snippet;
		grid?: boolean;
		prose?: boolean;
	} = $props();
</script>

<section class="page-section">
	{#if heading}
		<h2>{heading}</h2>
	{/if}
	<div class="section-container" class:grid-layout={grid} class:prose-layout={prose}>
		{@render children()}
	</div>
</section>

<style>
	.page-section {
		padding: 4rem 1rem;
		width: 100%;
	}

	.section-container {
		max-width: 1200px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 3rem;
	}

	.section-container.grid-layout {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 2rem;
	}

	.section-container.prose-layout {
		max-width: 800px;
		font-size: 1.25rem;
		line-height: 1.6;
		text-align: center;
	}

	@media (max-width: 1024px) {
		.section-container.grid-layout {
			grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		}
	}

	.page-section h2 {
		font-size: 2rem;
		text-align: center;
		margin-bottom: 2rem;
	}
</style>
