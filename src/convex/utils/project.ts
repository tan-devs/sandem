/**
 * Convert a human project title or ID into a URL-safe folder slug.
 */
export function folderNameFromProject(project: { name?: string; _id: string }): string {
	const raw = project.name || project._id;
	const slug = String(raw)
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
	return slug || String(project._id);
}

export function toRoomSlug(input: string): string {
	return (
		input
			.toLowerCase()
			.replace(/\s+/g, '-')
			.replace(/[^a-z0-9-]/g, '')
			.slice(0, 36) || 'project'
	);
}

export function generateLiveblocksRoomId(ownerId: string, projectName: string): string {
	const stamp = Date.now().toString(36);
	const entropy = Math.random().toString(36).slice(2, 8);
	return `room-${toRoomSlug(ownerId)}-${toRoomSlug(projectName)}-${stamp}-${entropy}`;
}
