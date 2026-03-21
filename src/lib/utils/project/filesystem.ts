// src/lib/utils/project/filesystem.ts
import type { FileSystemTree } from '@webcontainer/api';
import type { Doc } from '$convex/_generated/dataModel.js';

type ProjectFileLike = { name: string };

/**
 * Converts a flat Convex project.files array into a WebContainer FileSystemTree.
 * Handles nested paths like "src/App.jsx" by creating intermediate directories.
 */
export function projectFilesToTree(files: Doc<'projects'>['files']): FileSystemTree {
	const tree: FileSystemTree = {};

	for (const file of files) {
		const parts = file.name.split('/');

		if (parts.length === 1) {
			tree[file.name] = { file: { contents: file.contents ?? '' } };
		} else {
			let current = tree;
			for (let i = 0; i < parts.length - 1; i++) {
				const segment = parts[i];
				if (!current[segment]) {
					current[segment] = { directory: {} };
				}
				current = (current[segment] as { directory: FileSystemTree }).directory;
			}
			const leaf = parts[parts.length - 1];
			current[leaf] = { file: { contents: file.contents ?? '' } };
		}
	}

	return tree;
}

export function getRootFolder(path: string): string {
	return path.split('/')[0] ?? '';
}

export function resolveProjectFileName(
	path: string,
	files: ReadonlyArray<ProjectFileLike>
): string {
	if (files.some((file) => file.name === path)) return path;

	const [, ...rest] = path.split('/');
	const stripped = rest.join('/');
	if (stripped && files.some((file) => file.name === stripped)) return stripped;

	// If project files are rootless (e.g. "src/App.ts") and incoming WC paths are
	// rooted (e.g. "my-project/src/App.ts"), prefer stripping the first segment
	// for newly created files as well.
	const root = path.split('/')[0] ?? '';
	const hasRootedEntries = !!root && files.some((file) => file.name.startsWith(`${root}/`));
	if (!hasRootedEntries && stripped) return stripped;

	return path;
}

export function toWebContainerPath(rootFolder: string, projectFileName: string): string {
	if (!rootFolder) return projectFileName;
	if (projectFileName.startsWith(`${rootFolder}/`)) return projectFileName;
	return `${rootFolder}/${projectFileName}`;
}
