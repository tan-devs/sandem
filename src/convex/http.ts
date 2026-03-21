import { httpRouter, type HttpRouter } from 'convex/server';
import { authComponent, createAuth } from './auth.js';

const http: HttpRouter = httpRouter();

authComponent.registerRoutes(http, createAuth);

export default http;
