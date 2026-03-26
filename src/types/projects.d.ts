import type { Doc, Id } from '$convex/_generated/dataModel.js';

export type FILE = { name: string; contents: string };

export type PROJECT_DOC = Doc<'projects'> & {
	files?: FILE[];
	title?: string;
};
export type PROJECT_ID = Id<'projects'>;
export type Document = PROJECT_DOC;
export type Identity = PROJECT_ID;
export type PROJECT = PROJECT_DOC;
export type PROJECT_WITH_FILES = PROJECT_DOC & { files: FILE[] };
export type Files = FILE;

export type FOLDER = {
	_id: string;
	title: string;
	owner: string;
};

export type CALLS = {
	list(owner: string): Promise<FOLDER[]>;
	create(owner: string, title: string): Promise<string>;
	delete(owner: string, id: string): Promise<void>;
};
