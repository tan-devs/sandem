import type { PROJECT_DOC } from '$types/projects';

export const isPersistedProject = (project: unknown): project is PROJECT_DOC => {
	return typeof (project as PROJECT_DOC | undefined)?._id === 'string';
};
