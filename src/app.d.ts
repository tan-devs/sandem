// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Locals {
			token: string | undefined;
			session?: {
				user?: {
					id?: string;
					// Add more user fields as needed
				};
				// Add more session fields as needed
			};
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
