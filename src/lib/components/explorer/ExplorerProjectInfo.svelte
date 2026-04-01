<script lang="ts">
	import { Accordion } from 'bits-ui';
	import { ChevronRight } from '@lucide/svelte';
	import type { ProjectDoc } from '$lib/context';

	interface Props {
		activeProject: ProjectDoc | null;
		projectFolderName: string | null;
		/** Total node count for the active project — pass from the parent that owns the node list. */
		nodeCount: number | null;
		isOwner: boolean;
	}

	const { activeProject, projectFolderName, nodeCount, isOwner }: Props = $props();

	const visibility = $derived(
		activeProject ? (activeProject.isPublic ? 'Public' : 'Private') : null
	);

	const createdAt = $derived(
		activeProject ? new Date(activeProject.createdAt).toLocaleDateString() : null
	);
</script>

<Accordion.Item value="project-info" class="explorer-section">
	<Accordion.Header>
		<Accordion.Trigger class="section-trigger">
			<span class="section-chevron" aria-hidden="true">
				<ChevronRight size={11} strokeWidth={2} />
			</span>
			<span class="section-title">PROJECT DETAILS</span>
		</Accordion.Trigger>
	</Accordion.Header>

	<Accordion.Content>
		{#if activeProject}
			<div class="info-grid">
				<div class="info-row">
					<span class="label">Name</span>
					<span class="value">{activeProject.name}</span>
				</div>
				{#if projectFolderName}
					<div class="info-row">
						<span class="label">Folder</span>
						<span class="value">{projectFolderName}</span>
					</div>
				{/if}
				<div class="info-row">
					<span class="label">Visibility</span>
					<span class="value">{visibility}</span>
				</div>
				{#if nodeCount !== null}
					<div class="info-row">
						<span class="label">Nodes</span>
						<span class="value">{nodeCount}</span>
					</div>
				{/if}
				<div class="info-row">
					<span class="label">Created</span>
					<span class="value">{createdAt}</span>
				</div>
				<div class="info-row">
					<span class="label">Access</span>
					<span class="value">{isOwner ? 'Owner' : 'Read-only'}</span>
				</div>
			</div>
		{:else}
			<p class="empty-state">No project selected</p>
		{/if}
	</Accordion.Content>
</Accordion.Item>

<style>
	.info-grid {
		display: flex;
		flex-direction: column;
		gap: 5px;
		padding: 8px 10px;
		font-size: 11px;
	}

	.info-row {
		display: flex;
		gap: 6px;
		align-items: baseline;
	}

	.label {
		font-weight: 600;
		color: var(--text);
		flex-shrink: 0;
		min-width: 56px;
	}

	.value {
		color: var(--muted);
		word-break: break-word;
	}

	.empty-state {
		padding: 8px 10px;
		color: var(--muted);
		font-size: 11px;
		margin: 0;
	}
</style>
