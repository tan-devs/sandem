import type { ProjectDoc } from '$lib/context/webcontainer';

export const isPersistedProject = (project: unknown): project is ProjectDoc => {
	return typeof (project as ProjectDoc | undefined)?._id === 'string';
};
