import { RepoController } from '$lib/controllers/RepoController.svelte';

export function createRepoController(options: unknown) {
	return RepoController(options as any);
}
