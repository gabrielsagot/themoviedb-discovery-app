import type express from 'express';

/**
 * Tells the browser (and any intermediate cache) how long it may reuse a
 * response before checking back with us — mirrors the server-side cache TTLs
 * in constants.ts so both layers agree on how fresh the data needs to be.
 * @param res The response to set the header on.
 * @param ttlMs How long the response stays usable, in milliseconds.
 */
export const setCacheControl = (res: express.Response, ttlMs: number): void => {
  res.set('Cache-Control', `public, max-age=${Math.floor(ttlMs / 1000)}`);
};
