import { describe, expect, it, vi } from 'vitest';

// The express application is replaced by a stub that simply records what the
// back-end registers, so the test can inspect the routes without ever opening
// a real port. Plain arrays are used rather than vi.fn() spies because Vitest
// resets mocks between tests, which would wipe the calls made at import time.
const { mockApp, registeredPaths, listenCalls } = vi.hoisted(() => {
  const registeredPaths: string[] = [];
  const listenCalls: Array<{ port: number; callback: unknown }> = [];

  return {
    registeredPaths,
    listenCalls,
    mockApp: {
      get: (path: string) => {
        registeredPaths.push(path);
      },
      listen: (port: number, callback: unknown) => {
        listenCalls.push({ port, callback });
      },
    },
  };
});

vi.mock('express', () => ({
  default: () => mockApp,
}));

// The real config throws when TMDB_ACCESS_TOKEN is missing, which would tie
// the test to a .env file that never exists on a CI runner.
vi.mock('./config', () => ({
  tmdbAccessToken: 'test-access-token',
}));

// Imported once the mocks above are in place, so the module registers its
// routes on the stub instead of a real express application.
await import('./index');

describe('back-end server routes', () => {
  describe('server setup', () => {
    describe('server listening', () => {
      it('starts the server on port 3000', () => {
        expect(listenCalls).toHaveLength(1);
        expect(listenCalls[0].port).toBe(3000);
        expect(typeof listenCalls[0].callback).toBe('function');
      });
    });
  });

  describe('route registration', () => {
    it('registers the / route', () => {
      expect(registeredPaths).toContain('/');
    });

    it('registers the /api/movies/popular route', () => {
      expect(registeredPaths).toContain('/api/movies/popular');
    });

    it('registers the /api/health route', () => {
      expect(registeredPaths).toContain('/api/health');
    });
  });
});
