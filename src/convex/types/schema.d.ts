declare const _default: import('convex/server').SchemaDefinition<
	{
		users: import('convex/server').TableDefinition<
			import('convex/values').VObject<
				{
					tokenIdentifier: string;
					username: string;
					isGuest: boolean;
					createdAt: number;
					lastSeen: number;
				},
				{
					tokenIdentifier: import('convex/values').VString<string, 'required'>;
					username: import('convex/values').VString<string, 'required'>;
					isGuest: import('convex/values').VBoolean<boolean, 'required'>;
					createdAt: import('convex/values').VFloat64<number, 'required'>;
					lastSeen: import('convex/values').VFloat64<number, 'required'>;
				},
				'required',
				'tokenIdentifier' | 'username' | 'isGuest' | 'createdAt' | 'lastSeen'
			>,
			{
				by_tokenIdentifier: ['tokenIdentifier', '_creationTime'];
				by_username: ['username', '_creationTime'];
			}
		>;

		projects: import('convex/server').TableDefinition<
			import('convex/values').VObject<
				{
					ownerId: import('convex/values').GenericId<'users'>;
					name: string;
					isPublic: boolean;
					room: string;
					entry?: string | undefined;
					createdAt: number;
					updatedAt: number;
				},
				{
					ownerId: import('convex/values').VId<
						import('convex/values').GenericId<'users'>,
						'required'
					>;
					name: import('convex/values').VString<string, 'required'>;
					isPublic: import('convex/values').VBoolean<boolean, 'required'>;
					room: import('convex/values').VString<string, 'required'>;
					entry: import('convex/values').VString<string | undefined, 'optional'>;
					createdAt: import('convex/values').VFloat64<number, 'required'>;
					updatedAt: import('convex/values').VFloat64<number, 'required'>;
				},
				'required',
				'ownerId' | 'name' | 'isPublic' | 'room' | 'entry' | 'createdAt' | 'updatedAt'
			>,
			{
				by_owner: ['ownerId', '_creationTime'];
			}
		>;

		nodes: import('convex/server').TableDefinition<
			import('convex/values').VObject<
				{
					projectId: import('convex/values').GenericId<'projects'>;
					path: string;
					name: string;
					type: 'file' | 'folder';
					content?: string | undefined;
					parentId?: import('convex/values').GenericId<'nodes'> | undefined;
					createdAt: number;
					updatedAt: number;
				},
				{
					projectId: import('convex/values').VId<
						import('convex/values').GenericId<'projects'>,
						'required'
					>;
					path: import('convex/values').VString<string, 'required'>;
					name: import('convex/values').VString<string, 'required'>;
					type: import('convex/values').VUnion<
						'file' | 'folder',
						[
							import('convex/values').VLiteral<'file', 'required'>,
							import('convex/values').VLiteral<'folder', 'required'>
						],
						'required',
						never
					>;
					content: import('convex/values').VString<string | undefined, 'optional'>;
					parentId: import('convex/values').VId<
						import('convex/values').GenericId<'nodes'> | undefined,
						'optional'
					>;
					createdAt: import('convex/values').VFloat64<number, 'required'>;
					updatedAt: import('convex/values').VFloat64<number, 'required'>;
				},
				'required',
				'projectId' | 'path' | 'name' | 'type' | 'content' | 'parentId' | 'createdAt' | 'updatedAt'
			>,
			{
				by_project_path: ['projectId', 'path', '_creationTime'];
				by_parent: ['projectId', 'parentId', '_creationTime'];
			}
		>;

		projectSeedState: import('convex/server').TableDefinition<
			import('convex/values').VObject<
				{
					ownerId: import('convex/values').GenericId<'users'>;
					starterProjectSeeded: boolean;
					seededAt: number;
				},
				{
					ownerId: import('convex/values').VId<
						import('convex/values').GenericId<'users'>,
						'required'
					>;
					starterProjectSeeded: import('convex/values').VBoolean<boolean, 'required'>;
					seededAt: import('convex/values').VFloat64<number, 'required'>;
				},
				'required',
				'ownerId' | 'starterProjectSeeded' | 'seededAt'
			>,
			{
				by_owner: ['ownerId', '_creationTime'];
			}
		>;
	},
	true
>;

export default _default;
