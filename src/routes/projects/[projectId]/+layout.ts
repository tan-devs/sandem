import type { LayoutLoad } from './$types.js';
import type { Id } from '$convex/_generated/dataModel.js';

export const load: LayoutLoad = ({ params }) => {
	return {
		// We cast this to the Convex Id type to keep the compiler happy
		projectId: params.projectId as Id<'projects'>
	};
};
