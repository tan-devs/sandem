<script lang="ts">
	import { api } from '$convex/_generated/api.js';
	import { useQuery } from 'convex-svelte';
	import { useAuth } from '$lib/svelte/index.js';
	import PageSection from '$lib/components/ui/primitives/PageSection.svelte';
	import Card from '$lib/components/ui/primitives/Card.svelte';

	let { data } = $props();

	const auth = useAuth();

	// Public query - always runs, no auth required
	const publicQueryResponse = useQuery(
		api.auth.getPublicData,
		{}, // Always pass args, never skip
		() => ({
			initialData: data.publicData
		})
	);

	// Protected query - only runs when authenticated
	const protectedQueryResponse = useQuery(
		api.auth.getCurrentUser,
		() => (auth.isAuthenticated ? {} : 'skip'),
		() => ({
			initialData: data.protectedData,
			keepPreviousData: true
		})
	);
</script>

<PageSection heading="Query Behavior Test" label="Convex query behavior diagnostics">
	<div class="stack">
		<Card data-testid="auth-state" title="Auth State" variant="outline">
			<ul class="state-list">
				<li data-testid="is-loading"><strong>isLoading:</strong> {auth.isLoading}</li>
				<li data-testid="is-authenticated">
					<strong>isAuthenticated:</strong>
					{auth.isAuthenticated}
				</li>
			</ul>
		</Card>

		<Card data-testid="public-query" title="Public Query (always runs)" tone="info">
			{#if publicQueryResponse.isLoading}
				<p data-testid="public-loading">Loading...</p>
			{:else if publicQueryResponse.data}
				<p data-testid="public-message">{publicQueryResponse.data.message}</p>
				<p class="meta" data-testid="public-timestamp">
					Timestamp: {publicQueryResponse.data.timestamp}
				</p>
			{:else}
				<p data-testid="public-error">Error loading public data</p>
			{/if}
		</Card>

		<Card data-testid="protected-query" title="Protected Query (auth required)" tone="accent">
			{#if auth.isLoading}
				<p data-testid="protected-auth-loading">Checking auth...</p>
			{:else if !auth.isAuthenticated}
				<p data-testid="protected-skipped">Query skipped - not authenticated</p>
			{:else if protectedQueryResponse.isLoading}
				<p data-testid="protected-loading">Loading user...</p>
			{:else if protectedQueryResponse.data}
				<p data-testid="protected-email">{protectedQueryResponse.data.email}</p>
			{:else}
				<p data-testid="protected-none">No user data</p>
			{/if}
		</Card>

		<Card data-testid="ssr-data" title="SSR Initial Data" variant="outline">
			<p data-testid="ssr-public">
				<strong>publicData:</strong>
				{data.publicData?.message ?? 'null'}
			</p>
			<p data-testid="ssr-protected">
				<strong>protectedData:</strong>
				{data.protectedData?.email ?? 'null'}
			</p>
		</Card>
	</div>
</PageSection>

<style>
	.stack {
		display: grid;
		gap: 0.9rem;
	}

	.state-list {
		display: grid;
		gap: 0.3rem;
	}

	.meta {
		font-size: 0.75rem;
		color: var(--muted);
	}
</style>
