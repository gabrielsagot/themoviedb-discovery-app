import express from 'express';
import { registerGenresApi } from './genres-api';
import { registerHealthApi } from './health-api';
import { registerMoviesApi } from './movies-api';
import type { ApiErrorResponse } from './schemas/MoviesTypes';

// Create a new express application instance
const app = express();

// Define the port number for the server to listen on
const port: number = 3000;

// Register API routes from dedicated modules
registerMoviesApi(app);
registerGenresApi(app);
registerHealthApi(app);

// Catch-all for any route that isn't defined above. Must stay last: Express
// tries routes in registration order, so every real route above still gets
// first refusal.
app.use((_req: express.Request, res: express.Response) => {
  const errorResponse: ApiErrorResponse = { error: 'Route not found' };
  res.status(404).json(errorResponse);
});

// Start the server and listen on the specified port
app.listen(port, () => {
  console.log(`Example app in TypeScript listening on port ${port}`);
});
