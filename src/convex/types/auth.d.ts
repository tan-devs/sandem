import { createClient, type GenericCtx } from '@convex-dev/better-auth';
import { type DataModel } from '../_generated/dataModel.js';
import { query } from '../_generated/server.js';
export declare const authComponent: ReturnType<typeof createClient<DataModel>>;
export declare const createAuth: (ctx: GenericCtx<DataModel>) => import('better-auth').Auth<{
	baseURL: string;
	database: any;
	emailAndPassword: {
		enabled: true;
		requireEmailVerification: false;
	};
	socialProviders: {
		github: {
			enabled: true;
			clientId: string;
			clientSecret: string;
		};
	};
	plugins: [
		{
			id: 'convex';
			init: (ctx: import('better-auth').AuthContext) => void;
			hooks: {
				before: (
					| {
							matcher(context: import('better-auth').HookEndpointContext): boolean;
							handler: (
								inputContext: import('better-auth').MiddlewareInputContext<
									import('better-auth').MiddlewareOptions
								>
							) => Promise<
								| {
										context: {
											headers: Headers;
										};
								  }
								| undefined
							>;
					  }
					| {
							matcher: (ctx: import('better-auth').HookEndpointContext) => boolean;
							handler: (
								inputContext: import('better-auth').MiddlewareInputContext<
									import('better-auth').MiddlewareOptions
								>
							) => Promise<{
								context: import('better-auth').MiddlewareContext<
									import('better-auth').MiddlewareOptions,
									{
										returned?: unknown | undefined;
										responseHeaders?: Headers | undefined;
									} & import('better-auth').PluginContext<import('better-auth').BetterAuthOptions> &
										import('better-auth').InfoContext & {
											options: import('better-auth').BetterAuthOptions;
											trustedOrigins: string[];
											trustedProviders: string[];
											isTrustedOrigin: (
												url: string,
												settings?: {
													allowRelativePaths: boolean;
												}
											) => boolean;
											oauthConfig: {
												skipStateCookieCheck?: boolean | undefined;
												storeStateStrategy: 'database' | 'cookie';
											};
											newSession: {
												session: {
													id: string;
													createdAt: Date;
													updatedAt: Date;
													userId: string;
													expiresAt: Date;
													token: string;
													ipAddress?: string | null | undefined;
													userAgent?: string | null | undefined;
												} & Record<string, any>;
												user: {
													id: string;
													createdAt: Date;
													updatedAt: Date;
													email: string;
													emailVerified: boolean;
													name: string;
													image?: string | null | undefined;
												} & Record<string, any>;
											} | null;
											session: {
												session: {
													id: string;
													createdAt: Date;
													updatedAt: Date;
													userId: string;
													expiresAt: Date;
													token: string;
													ipAddress?: string | null | undefined;
													userAgent?: string | null | undefined;
												} & Record<string, any>;
												user: {
													id: string;
													createdAt: Date;
													updatedAt: Date;
													email: string;
													emailVerified: boolean;
													name: string;
													image?: string | null | undefined;
												} & Record<string, any>;
											} | null;
											setNewSession: (
												session: {
													session: {
														id: string;
														createdAt: Date;
														updatedAt: Date;
														userId: string;
														expiresAt: Date;
														token: string;
														ipAddress?: string | null | undefined;
														userAgent?: string | null | undefined;
													} & Record<string, any>;
													user: {
														id: string;
														createdAt: Date;
														updatedAt: Date;
														email: string;
														emailVerified: boolean;
														name: string;
														image?: string | null | undefined;
													} & Record<string, any>;
												} | null
											) => void;
											socialProviders: import('better-auth').OAuthProvider[];
											authCookies: import('better-auth').BetterAuthCookies;
											logger: ReturnType<
												(
													options?: import('better-auth').Logger | undefined
												) => import('better-auth').InternalLogger
											>;
											rateLimit: {
												enabled: boolean;
												window: number;
												max: number;
												storage: 'memory' | 'database' | 'secondary-storage';
											} & Omit<
												import('better-auth').BetterAuthRateLimitOptions,
												'enabled' | 'window' | 'max' | 'storage'
											>;
											adapter: import('better-auth').DBAdapter<
												import('better-auth').BetterAuthOptions
											>;
											internalAdapter: import('better-auth').InternalAdapter<
												import('better-auth').BetterAuthOptions
											>;
											createAuthCookie: (
												cookieName: string,
												overrideAttributes?:
													| Partial<import('better-auth').CookieOptions>
													| undefined
											) => import('better-auth').BetterAuthCookie;
											secret: string;
											secretConfig: string | import('better-auth').SecretConfig;
											sessionConfig: {
												updateAge: number;
												expiresIn: number;
												freshAge: number;
												cookieRefreshCache:
													| false
													| {
															enabled: true;
															updateAge: number;
													  };
											};
											generateId: (options: {
												model: import('better-auth').ModelNames;
												size?: number | undefined;
											}) => string | false;
											secondaryStorage: import('better-auth').SecondaryStorage | undefined;
											password: {
												hash: (password: string) => Promise<string>;
												verify: (data: { password: string; hash: string }) => Promise<boolean>;
												config: {
													minPasswordLength: number;
													maxPasswordLength: number;
												};
												checkPassword: (
													userId: string,
													ctx: import('better-auth').GenericEndpointContext<
														import('better-auth').BetterAuthOptions
													>
												) => Promise<boolean>;
											};
											tables: import('better-auth').BetterAuthDBSchema;
											runMigrations: () => Promise<void>;
											publishTelemetry: (event: {
												type: string;
												anonymousId?: string | undefined;
												payload: Record<string, any>;
											}) => Promise<void>;
											skipOriginCheck: boolean | string[];
											skipCSRFCheck: boolean;
											runInBackground: (promise: Promise<unknown>) => void;
											runInBackgroundOrAwait: (
												promise: Promise<unknown> | void
											) => import('better-auth').Awaitable<unknown>;
										}
								>;
							}>;
					  }
				)[];
				after: {
					matcher: (context: import('better-auth').HookEndpointContext) => boolean;
					handler: import('better-auth/api').AuthMiddleware;
				}[];
			};
			endpoints: {
				getOpenIdConfig: import('better-auth').StrictEndpoint<
					'/convex/.well-known/openid-configuration',
					{
						method: 'GET';
						metadata: {
							isAction: false;
						};
					},
					import('better-auth/plugins').OIDCMetadata
				>;
				getJwks: import('better-auth').StrictEndpoint<
					'/convex/jwks',
					{
						method: 'GET';
						metadata: {
							openapi: {
								description: string;
								responses: {
									'200': {
										description: string;
										content: {
											'application/json': {
												schema: {
													type: 'object';
													properties: {
														keys: {
															type: string;
															description: string;
															items: {
																type: string;
																properties: {
																	kid: {
																		type: string;
																		description: string;
																	};
																	kty: {
																		type: string;
																		description: string;
																	};
																	alg: {
																		type: string;
																		description: string;
																	};
																	use: {
																		type: string;
																		description: string;
																		enum: string[];
																		nullable: boolean;
																	};
																	n: {
																		type: string;
																		description: string;
																		nullable: boolean;
																	};
																	e: {
																		type: string;
																		description: string;
																		nullable: boolean;
																	};
																	crv: {
																		type: string;
																		description: string;
																		nullable: boolean;
																	};
																	x: {
																		type: string;
																		description: string;
																		nullable: boolean;
																	};
																	y: {
																		type: string;
																		description: string;
																		nullable: boolean;
																	};
																};
																required: string[];
															};
														};
													};
													required: string[];
												};
											};
										};
									};
								};
							};
						};
					},
					import('better-auth').JSONWebKeySet
				>;
				getLatestJwks: import('better-auth').StrictEndpoint<
					'/convex/latest-jwks',
					{
						isAction: boolean;
						method: 'POST';
						metadata: {
							SERVER_ONLY: true;
							openapi: {
								description: string;
							};
						};
					},
					any[]
				>;
				rotateKeys: import('better-auth').StrictEndpoint<
					'/convex/rotate-keys',
					{
						isAction: boolean;
						method: 'POST';
						metadata: {
							SERVER_ONLY: true;
							openapi: {
								description: string;
							};
						};
					},
					any[]
				>;
				getToken: import('better-auth').StrictEndpoint<
					'/convex/token',
					{
						method: 'GET';
						requireHeaders: true;
						use: ((
							inputContext: import('better-auth').MiddlewareInputContext<
								import('better-auth').MiddlewareOptions
							>
						) => Promise<{
							session: {
								session: Record<string, any> & {
									id: string;
									createdAt: Date;
									updatedAt: Date;
									userId: string;
									expiresAt: Date;
									token: string;
									ipAddress?: string | null | undefined;
									userAgent?: string | null | undefined;
								};
								user: Record<string, any> & {
									id: string;
									createdAt: Date;
									updatedAt: Date;
									email: string;
									emailVerified: boolean;
									name: string;
									image?: string | null | undefined;
								};
							};
						}>)[];
						metadata: {
							openapi: {
								description: string;
								responses: {
									200: {
										description: string;
										content: {
											'application/json': {
												schema: {
													type: 'object';
													properties: {
														token: {
															type: string;
														};
													};
												};
											};
										};
									};
								};
							};
						};
					},
					{
						token: string;
					}
				>;
			};
			schema: {
				jwks: {
					fields: {
						publicKey: {
							type: 'string';
							required: true;
						};
						privateKey: {
							type: 'string';
							required: true;
						};
						createdAt: {
							type: 'date';
							required: true;
						};
						expiresAt: {
							type: 'date';
							required: false;
						};
					};
				};
				user: {
					readonly fields: {
						readonly userId: {
							readonly type: 'string';
							readonly required: false;
							readonly input: false;
						};
					};
				};
			};
		}
	];
}>;
export declare const getCurrentUser: ReturnType<typeof query>;
