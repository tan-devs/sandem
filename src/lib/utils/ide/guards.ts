import type { PROJECT, PROJECT_DOC } from '$types/projects.js';

export const isPersistedProject = (project: PROJECT | null | undefined): project is PROJECT_DOC => {
	return typeof (project as PROJECT_DOC | undefined)?._id === 'string';
};
