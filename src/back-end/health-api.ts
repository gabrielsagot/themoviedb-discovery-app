import type { Express } from 'express';
import express from 'express';

/**
 * Registers the health check route, used to verify that the server is up
 * without calling the TMDB API.
 * @param app The express application to register the route on.
 */
export function registerHealthApi(app: Express): void {
  // Define a route handler for health check endpoint
  app.get('/api/health', (_req: express.Request, res: express.Response) => {
    const response: { status: string } = { status: 'ok' };
    res.json(response);
  });
}
