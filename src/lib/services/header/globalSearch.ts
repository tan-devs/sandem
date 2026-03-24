// $lib/services/search/globalSearch.ts
export function globalSearchKeydown(
	event: KeyboardEvent,
	query: string,
	onNavigate: (path: string) => void
) {
	if (event.key !== 'Enter') return;
	const q = query.trim();
	if (!q) return;
	onNavigate(`/shop?search=${encodeURIComponent(q)}`);
}
