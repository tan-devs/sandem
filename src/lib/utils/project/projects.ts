type ProjectSummary = { _id: string };

function slugifyProjectTitle(title?: string): string {
	const value = title?.trim().toLowerCase() ?? '';
	const slug = value
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 64);

	return slug || 'untitled-project';
}

export function uniqueProjects<T extends ProjectSummary>(items: ReadonlyArray<T>): T[] {
	const seen = new Set<string>();
	const next: T[] = [];
	for (const project of items) {
		if (seen.has(project._id)) continue;
		seen.add(project._id);
		next.push(project);
	}
	return next;
}

export function areProjectsEqual<T extends ProjectSummary>(
	left: ReadonlyArray<T>,
	right: ReadonlyArray<T>
): boolean {
	if (left.length !== right.length) return false;
	for (let index = 0; index < left.length; index += 1) {
		if (left[index]?._id !== right[index]?._id) return false;
	}
	return true;
}

export function projectFolderName(projectId: string, title?: string): string {
	void projectId;
	return slugifyProjectTitle(title);
}
