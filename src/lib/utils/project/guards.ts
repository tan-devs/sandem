import type { IDEProject, ProjectDoc } from '$types/projects.js';

export const isPersistedProject = (
	project: IDEProject | null | undefined
): project is ProjectDoc => {
	return typeof (project as ProjectDoc | undefined)?._id === 'string';
};
