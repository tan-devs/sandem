export function normalizeNodePath(path: string): string {
	if (!path) return '/';
	return path.startsWith('/') ? path : `/${path}`;
}

export function getParentNodePath(path: string): string {
	const normalized = normalizeNodePath(path);
	if (normalized === '/' || normalized === '') return '';
	const lastSlash = normalized.lastIndexOf('/');
	if (lastSlash <= 0) return '';
	return normalized.substring(0, lastSlash);
}
