import type { Doc, Id } from '$convex/_generated/dataModel.js';

export type Document = Doc<'projects'>;
export type Identity = Id<'projects'>;
export type Files = ProjectDoc['files'][number];

export type PROJECT =
	| Document
	| {
			files: Files[];
			entry?: string;
			room?: string;
			title?: string;
	  };

export type FOLDER = {
	_id: string;
	title: string;
	owner: string;
};

export type CALLS = {
	list(owner: string): Promise<FOLDER[]>;
	create(owner: string, title: string): Promise<string>;
	delete(owner: string, ProjectId: string): Promise<void>;
};
