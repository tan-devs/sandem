import type { GenericId } from 'convex/values';

// ---------------------------------------------------------------------------
// Types (mirrors the ProjectDoc shape from projects.d.ts)
// ---------------------------------------------------------------------------

export type ProjectSummary = {
	_id: GenericId<'projects'>;
	ownerId: GenericId<'users'>;
	name: string;
	isPublic: boolean;
	room: string;
	entry?: string;
	createdAt: number;
	updatedAt: number;
};

// ---------------------------------------------------------------------------
// Slug / name helpers
// ---------------------------------------------------------------------------

/**
 * Converts a project name to a URL-safe slug.
 *
 * "My Web App" → "my-web-app"
 * "  "         → "untitled-project"
 */
export function slugifyProjectName(name?: string): string {
	const value = name?.trim().toLowerCase() ?? '';
	const slug = value
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 64);

	return slug || 'untitled-project';
}

/**
 * Returns the URL path segment for a project, based on the owner's username
 * and the project name slug.
 *
 * e.g. "prajwal" + "My Web App" → "/prajwal/my-web-app"
 */
export function projectUrl(username: string, projectName: string): string {
	return `/${username}/${slugifyProjectName(projectName)}`;
}

/**
 * The filesystem-safe folder name for a project inside a WebContainer
 * workspace. Uses the project's `name` field (new schema) — not `title`.
 *
 * e.g. project.name = "My Web App" → "my-web-app"
 */
export function projectFolderName(
	projectOrId: Pick<ProjectSummary, 'name'> | string,
	name?: string
): string {
	if (typeof projectOrId === 'string') {
		// Called as projectFolderName(projectId, projectName)
		const raw = name?.trim() || String(projectOrId).trim();
		return slugifyProjectName(raw);
	}

	return slugifyProjectName(projectOrId.name?.trim() || '');
}

// ---------------------------------------------------------------------------
// Deduplication & equality
// ---------------------------------------------------------------------------

/**
 * Remove duplicate projects by _id, preserving order.
 * Useful when merging optimistic updates with server state.
 */
export function uniqueProjects<T extends Pick<ProjectSummary, '_id'>>(
	items: ReadonlyArray<T>
): T[] {
	const seen = new Set<string>();
	const result: T[] = [];
	for (const project of items) {
		if (seen.has(project._id)) continue;
		seen.add(project._id);
		result.push(project);
	}
	return result;
}

/**
 * Shallow equality check by _id order.
 * Returns true only if both lists contain the same projects in the same order.
 */
export function areProjectsEqual<T extends Pick<ProjectSummary, '_id'>>(
	left: ReadonlyArray<T>,
	right: ReadonlyArray<T>
): boolean {
	if (left.length !== right.length) return false;
	for (let i = 0; i < left.length; i++) {
		if (left[i]?._id !== right[i]?._id) return false;
	}
	return true;
}

// ---------------------------------------------------------------------------
// Visibility helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if the project can be read by a guest (non-owner).
 */
export function isProjectPublic(project: Pick<ProjectSummary, 'isPublic'>): boolean {
	return project.isPublic === true;
}

/**
 * Returns the human-readable visibility label for UI badges.
 *
 * e.g. "Public" | "Private"
 */
export function projectVisibilityLabel(project: Pick<ProjectSummary, 'isPublic'>): string {
	return project.isPublic ? 'Public' : 'Private';
}

// ---------------------------------------------------------------------------
// Entry file helpers
// ---------------------------------------------------------------------------

/**
 * Resolves the default file path to open when the IDE loads a project.
 * Falls back to common convention if entry is not set.
 *
 * Priority: project.entry → "/src/index.ts"
 */
export function resolveEntryPath(project: Pick<ProjectSummary, 'entry'>): string {
	return project.entry ?? '/src/index.ts';
}

// ---------------------------------------------------------------------------
// Sort helpers
// ---------------------------------------------------------------------------

/**
 * Comparator: sort projects newest-first by createdAt.
 */
export function byNewest(
	a: Pick<ProjectSummary, 'createdAt'>,
	b: Pick<ProjectSummary, 'createdAt'>
): number {
	return b.createdAt - a.createdAt;
}

/**
 * Comparator: sort projects alphabetically by name (case-insensitive).
 */
export function byName(a: Pick<ProjectSummary, 'name'>, b: Pick<ProjectSummary, 'name'>): number {
	return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
}
