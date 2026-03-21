import type { Doc, Id } from '$convex/_generated/dataModel.js';

export type ProjectDoc = Doc<'projects'>;
export type ProjectId = Id<'projects'>;
export type ProjectFile = ProjectDoc['files'][number];

export type IDEProject =
	| ProjectDoc
	| {
			files: ProjectFile[];
			entry?: string;
			room?: string;
			title?: string;
	  };
