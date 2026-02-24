<script lang="ts">
	import PageHeader from '$lib/components/layout/PageHeader.svelte';
	import PageSection from '$lib/components/layout/PageSection.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Grid from '$lib/components/ui/Grid.svelte';
	import Card from '$lib/components/ui/Card.svelte';

	import { useQuery } from 'convex-svelte';
	import { api } from '$convex/_generated/api.js';

	// Use listProjects as defined in your projects.ts
	// Passing an empty object as we want to list all available projects
	const projects = useQuery(api.projects.listProjects, {});

	// Debugging locally in the page scope
	$inspect(projects.data).with(console.log);
</script>

<main class="projects-page">
	<PageHeader
		heading="Project Repository"
		subtitle="Access your sandboxed development environments and collaborative workspaces."
	>
		<div class="header-actions">
			<Button variant="default" size="lg">New Project</Button>
		</div>
	</PageHeader>

	<PageSection heading="Recent Repos">
		{#if projects.data === undefined}
			<div class="status-message">
				<p>Syncing with Convex...</p>
			</div>
		{:else if projects.data.length === 0}
			<div class="status-message">
				<p>No projects found in your database.</p>
				<Button variant="outline" style="margin-top: 1rem;">Create your first repo</Button>
			</div>
		{:else}
			<Grid minWidth="320px" gap="1.5rem">
				{#each projects.data as project}
					<Card preset="notched">
						{#snippet content()}
							<div class="project-content">
								<div class="project-info">
									<span class="project-id">ID: {project._id.slice(-4)}</span>
									<h3>{project.title}</h3>
									<p class="description">
										Entry point: <code>{project.entry}</code>
									</p>
									<div class="file-count">
										{project.files.length} files tracked
									</div>
								</div>

								<div class="project-footer">
									<Button variant="outline" href="/projects/{project._id}" style="width: 100%">
										Launch IDE
									</Button>
								</div>
							</div>
						{/snippet}
					</Card>
				{/each}
			</Grid>
		{/if}
	</PageSection>
</main>

<style>
	.header-actions {
		margin-top: 1rem;
	}

	.status-message {
		text-align: center;
		padding: 4rem;
		background: var(--mg);
		border-radius: var(--radius);
		border: 1px dashed var(--border);
		color: var(--muted);
	}

	.project-content {
		display: flex;
		flex-direction: column;
		height: 100%;
		justify-content: space-between;
		gap: 2rem;
	}

	.project-info h3 {
		font-size: 1.5rem;
		margin: 0.5rem 0;
		color: var(--highlight);
	}

	.project-id {
		font-family: monospace;
		font-size: 0.75rem;
		color: var(--muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.description {
		color: var(--text);
		font-size: 0.9rem;
		opacity: 0.8;
	}

	.description code {
		background: var(--fg);
		padding: 0.2rem 0.4rem;
		border-radius: 4px;
	}

	.file-count {
		margin-top: 1rem;
		font-size: 0.8rem;
		color: var(--muted);
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.file-count::before {
		content: '';
		width: 8px;
		height: 8px;
		background: var(--success);
		border-radius: 50%;
	}
</style>
