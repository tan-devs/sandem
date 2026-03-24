import type { PROJECT, Document } from '$types/projects.js';

export const isPersistedProject = (project: PROJECT | null | undefined): project is Document => {
	return typeof (project as Document | undefined)?._id === 'string';
};
