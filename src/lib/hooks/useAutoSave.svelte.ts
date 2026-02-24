import { useConvexClient } from 'convex-svelte';
import { api } from '$convex/_generated/api.js';
import type { Doc } from '$convex/_generated/dataModel.js';

export function createAutoSaver(getProject: () => Doc<'projects'> | undefined) {
	const convexClient = useConvexClient();

	let saveStatus = $state<'Saved' | 'Saving...' | 'Unsaved changes'>('Saved');
	let saveTimeout: ReturnType<typeof setTimeout>;

	async function saveToConvex(activeFile: string, content: string) {
		const project = getProject();
		if (!project) return;

		try {
			await convexClient.mutation(api.projects.updateProject, {
				id: project._id,
				files: project.files.map((f) => (f.name === activeFile ? { ...f, contents: content } : f))
			});
			saveStatus = 'Saved';
		} catch (err) {
			console.error('Save failed', err);
			saveStatus = 'Unsaved changes';
		}
	}

	function triggerAutoSave(activeFile: string, content: string) {
		saveStatus = 'Unsaved changes';
		clearTimeout(saveTimeout);
		saveTimeout = setTimeout(() => {
			saveStatus = 'Saving...';
			saveToConvex(activeFile, content);
		}, 1500);
	}

	function cleanup() {
		clearTimeout(saveTimeout);
	}

	return {
		get status() {
			return saveStatus;
		},
		triggerAutoSave,
		cleanup
	};
}
