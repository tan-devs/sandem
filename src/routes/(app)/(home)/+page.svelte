<script lang="ts">
	import Button from '$lib/components/primitives/Button.svelte';

	import { ArrowRight } from '@lucide/svelte';
</script>

<main class="hero">
	<div class="hero-content">
		<h1>sandem</h1>
		<p class="subtitle">
			A browser-native dev environment. Write code, run processes, and collaborate — no server
			required.
		</p>
		<div class="actions">
			<Button variant="outline" href="/repo">open workspace <ArrowRight size={13} /></Button>
			<Button variant="link" href="/docs">docs</Button>
			<Button variant="link" href="https://github.com" target="_blank" rel="noopener">github</Button
			>
		</div>
	</div>
</main>

<style>
	.hero {
		width: 100%;
		flex: 1;
		display: grid;
		place-items: center;
		padding: clamp(1rem, 2vw, 2rem);
		text-align: center;
	}

	.hero-content {
		max-width: 50rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
	}

	h1 {
		font-size: clamp(2.5rem, 5vw, 4rem);
		line-height: 1.2;
		color: var(--text);
		font-weight: 600;
	}

	.subtitle {
		font-size: clamp(1rem, 1.5vw, 1.25rem);
		line-height: 1.6;
		color: var(--muted);
		max-width: 45rem;
	}

	.actions {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		flex-wrap: wrap;
		margin-top: 1rem;
	}
</style>
