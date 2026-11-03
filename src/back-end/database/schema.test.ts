import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { initializeSchema, getDatabase } from './schema';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('schema.ts', () => {
  describe('getDatabase', () => {
    it('returns a DatabaseSync instance connected to the specified database', () => {
      const directory = mkdtempSync(join(tmpdir(), 'movies-database-'));
      const databasePath = join(directory, 'nested', 'movies.sqlite');

      const database = getDatabase(databasePath);

      // Verify that the returned object is a DatabaseSync instance
      expect(database).toBeInstanceOf(DatabaseSync);

      // Verify that foreign key constraints are enabled
      expect(database.prepare('PRAGMA foreign_keys').get()).toEqual({
        foreign_keys: 1,
      });

      // Verify that foreign key for movie_genres table is enforced when inserting a non-existent genre ID
      expect(() =>
        database.prepare('INSERT INTO movie_genres VALUES (?, ?)').run(1, 18),
      ).toThrow(/FOREIGN KEY constraint failed/);

      // Verify that foreign key for production_countries table is enforced when inserting a non-existent country code
      expect(() =>
        database
          .prepare('INSERT INTO production_countries VALUES (?, ?)')
          .run(1, 'US'),
      ).toThrow(/FOREIGN KEY constraint failed/);

      database.close();
    });

    it('rolls back schema initialization and rethrows when initialization fails', () => {
      const directory = mkdtempSync(join(tmpdir(), 'movies-database-'));
      const databasePath = join(directory, 'movies.sqlite');
      const existingDatabase = new DatabaseSync(databasePath);

      // Create an existing movies table to simulate a schema initialization failure
      existingDatabase.exec('CREATE TABLE movies (id INTEGER PRIMARY KEY)');
      existingDatabase.close();

      // Attempt to get the database, which should fail due to the missing release_year column
      expect(() => getDatabase(databasePath)).toThrow(
        /no such column: release_year/,
      );

      // Verify that the schema initialization was rolled back and the movies table remains unchanged
      const database = new DatabaseSync(databasePath);
      const tables = database
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
        .all()
        .map((row) => row.name);
      expect(tables).toEqual(['movies']);
      database.close();
    });

    it('recreates the schema and removes existing data when forced', () => {
      const directory = mkdtempSync(join(tmpdir(), 'movies-database-'));
      const databasePath = join(directory, 'movies.sqlite');

      const existingDatabase = getDatabase(databasePath);

      existingDatabase
        .prepare('INSERT INTO genres (id, name) VALUES (?, ?)')
        .run(18, 'Drama');
      existingDatabase.close();

      // Force recreate the schema, which should remove existing data
      const database = getDatabase(databasePath, true);

      expect(database.prepare('SELECT * FROM genres').all()).toEqual([]);
      expect(
        database
          .prepare(
            "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
          )
          .all()
          .map((row) => row.name),
      ).toEqual([
        'countries',
        'genres',
        'movie_genres',
        'movies',
        'production_countries',
      ]);
      database.close();
    });
  });

  describe('initializeSchema', () => {
    it('creates every table, index and optional movie column in the initial schema', () => {
      const database = new DatabaseSync(':memory:');
      try {
        // Initialize the database schema
        initializeSchema(database);

        // Verify that all expected tables are created
        const tables = database
          .prepare(
            "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
          )
          .all()
          .map((row) => row.name);
        expect(tables).toEqual([
          'countries',
          'genres',
          'movie_genres',
          'movies',
          'production_countries',
        ]);

        // Verify that all expected indexes are created
        const indexes = database
          .prepare("SELECT name FROM sqlite_master WHERE type = 'index'")
          .all()
          .map((row) => row.name);
        expect(indexes).toEqual(
          expect.arrayContaining([
            'movies_release_year',
            'movie_genres_genre_id',
          ]),
        );
      } finally {
        database.close();
      }
    });
  });
  describe('integrity constraints', () => {
    /**
     * Opens an in-memory database with foreign keys enabled, the initialized
     * schema, two genres and two countries, as the collector would leave it
     * before inserting movies.
     * @returns The prepared in-memory database.
     */
    function createSeededDatabase(): DatabaseSync {
      const database = new DatabaseSync(':memory:');
      database.exec('PRAGMA foreign_keys = ON;');
      initializeSchema(database);
      database.exec(`
        INSERT INTO genres (id, name) VALUES (35, 'Comédie'), (12, 'Aventure');
        INSERT INTO countries (code, name) VALUES ('FR', 'France'), ('BE', 'Belgique');
      `);
      return database;
    }

    /**
     * Inserts a movie with the required columns and the given optional ones.
     * @param database The database to insert the movie into.
     * @param id The TMDB identifier of the movie.
     * @param values Optional column values to set on the movie.
     */
    function insertMovie(
      database: DatabaseSync,
      id: number,
      values: {
        release_date?: string | null;
        runtime_minutes?: number | null;
        budget?: number | null;
        revenue?: number | null;
      } = {},
    ): void {
      database
        .prepare(
          `INSERT INTO movies (id, title, original_title, original_language,
             overview, release_date, runtime_minutes, budget, revenue, collected_at)
           VALUES (?, 'Titre', 'Title', 'fr', '', ?, ?, ?, ?, '2026-11-03T00:00:00Z')`,
        )
        .run(
          id,
          values.release_date ?? null,
          values.runtime_minutes ?? null,
          values.budget ?? null,
          values.revenue ?? null,
        );
    }

    /**
     * Reads the generated release year of a movie.
     * @param database The database to read from.
     * @param id The TMDB identifier of the movie.
     * @returns The release year, or null when it is unknown.
     */
    function releaseYearOf(database: DatabaseSync, id: number): unknown {
      return database
        .prepare('SELECT release_year FROM movies WHERE id = ?')
        .get(id)?.release_year;
    }

    it('finds a coproduced movie from each of its genres and countries', () => {
      const database = createSeededDatabase();
      try {
        insertMovie(database, 1, { release_date: '2020-05-01' });
        database.exec(`
          INSERT INTO movie_genres (movie_id, genre_id) VALUES (1, 35), (1, 12);
          INSERT INTO production_countries (movie_id, country_code) VALUES (1, 'FR'), (1, 'BE');
        `);

        for (const genreId of [35, 12]) {
          expect(
            database
              .prepare('SELECT movie_id FROM movie_genres WHERE genre_id = ?')
              .all(genreId)
              .map((row) => row.movie_id),
          ).toEqual([1]);
        }
        for (const countryCode of ['FR', 'BE']) {
          expect(
            database
              .prepare(
                'SELECT movie_id FROM production_countries WHERE country_code = ?',
              )
              .all(countryCode)
              .map((row) => row.movie_id),
          ).toEqual([1]);
        }
      } finally {
        database.close();
      }
    });

    it('rejects duplicate movies, genres, countries and associations', () => {
      const database = createSeededDatabase();
      try {
        insertMovie(database, 1);
        database.exec(`
          INSERT INTO movie_genres (movie_id, genre_id) VALUES (1, 35);
          INSERT INTO production_countries (movie_id, country_code) VALUES (1, 'FR');
        `);

        expect(() => insertMovie(database, 1)).toThrow(
          /UNIQUE constraint failed: movies.id/,
        );
        expect(() =>
          database.exec("INSERT INTO genres (id, name) VALUES (35, 'Comedy')"),
        ).toThrow(/UNIQUE constraint failed: genres.id/);
        expect(() =>
          database.exec(
            "INSERT INTO countries (code, name) VALUES ('FR', 'France')",
          ),
        ).toThrow(/UNIQUE constraint failed: countries.code/);
        expect(() =>
          database.exec('INSERT INTO movie_genres VALUES (1, 35)'),
        ).toThrow(/UNIQUE constraint failed: movie_genres/);
        expect(() =>
          database.exec("INSERT INTO production_countries VALUES (1, 'FR')"),
        ).toThrow(/UNIQUE constraint failed: production_countries/);
      } finally {
        database.close();
      }
    });

    it('rejects associations with an unknown movie, genre or country', () => {
      const database = createSeededDatabase();
      try {
        insertMovie(database, 1);

        expect(() =>
          database.exec('INSERT INTO movie_genres VALUES (42, 35)'),
        ).toThrow(/FOREIGN KEY constraint failed/);
        expect(() =>
          database.exec('INSERT INTO movie_genres VALUES (1, 99)'),
        ).toThrow(/FOREIGN KEY constraint failed/);
        expect(() =>
          database.exec("INSERT INTO production_countries VALUES (42, 'FR')"),
        ).toThrow(/FOREIGN KEY constraint failed/);
        expect(() =>
          database.exec("INSERT INTO production_countries VALUES (1, 'ZZ')"),
        ).toThrow(/FOREIGN KEY constraint failed/);
      } finally {
        database.close();
      }
    });

    it('deletes the associations of a deleted movie but keeps the catalogues', () => {
      const database = createSeededDatabase();
      try {
        insertMovie(database, 1);
        database.exec(`
          INSERT INTO movie_genres VALUES (1, 35);
          INSERT INTO production_countries VALUES (1, 'FR');
          DELETE FROM movies WHERE id = 1;
        `);

        expect(
          database.prepare('SELECT COUNT(*) AS count FROM movie_genres').get(),
        ).toEqual({ count: 0 });
        expect(
          database
            .prepare('SELECT COUNT(*) AS count FROM production_countries')
            .get(),
        ).toEqual({ count: 0 });
        expect(
          database.prepare('SELECT COUNT(*) AS count FROM genres').get(),
        ).toEqual({ count: 2 });
        expect(
          database.prepare('SELECT COUNT(*) AS count FROM countries').get(),
        ).toEqual({ count: 2 });
      } finally {
        database.close();
      }
    });

    it('refuses to delete a genre or a country still used by a movie', () => {
      const database = createSeededDatabase();
      try {
        insertMovie(database, 1);
        database.exec(`
          INSERT INTO movie_genres VALUES (1, 35);
          INSERT INTO production_countries VALUES (1, 'FR');
        `);

        expect(() => database.exec('DELETE FROM genres WHERE id = 35')).toThrow(
          /FOREIGN KEY constraint failed/,
        );
        expect(() =>
          database.exec("DELETE FROM countries WHERE code = 'FR'"),
        ).toThrow(/FOREIGN KEY constraint failed/);

        // Unused genres and countries can still be removed
        database.exec(`
          DELETE FROM genres WHERE id = 12;
          DELETE FROM countries WHERE code = 'BE';
        `);
        expect(
          database
            .prepare('SELECT id FROM genres')
            .all()
            .map((row) => row.id),
        ).toEqual([35]);
        expect(
          database
            .prepare('SELECT code FROM countries')
            .all()
            .map((row) => row.code),
        ).toEqual(['FR']);
      } finally {
        database.close();
      }
    });

    it('requires a name for every genre and country', () => {
      const database = createSeededDatabase();
      try {
        expect(() =>
          database.exec('INSERT INTO genres (id, name) VALUES (18, NULL)'),
        ).toThrow(/NOT NULL constraint failed: genres.name/);
        expect(() =>
          database.exec(
            "INSERT INTO countries (code, name) VALUES ('US', NULL)",
          ),
        ).toThrow(/NOT NULL constraint failed: countries.name/);
      } finally {
        database.close();
      }
    });

    it.each([
      ['runtime_minutes', 0],
      ['runtime_minutes', -90],
      ['budget', 0],
      ['budget', -1],
      ['revenue', 0],
      ['revenue', -1],
    ] as const)('rejects %s = %d', (column, value) => {
      const database = createSeededDatabase();
      try {
        expect(() => insertMovie(database, 1, { [column]: value })).toThrow(
          new RegExp(`CHECK constraint failed: ${column}`),
        );
      } finally {
        database.close();
      }
    });

    it('keeps unknown runtime, budget, revenue and indicators as NULL', () => {
      const database = createSeededDatabase();
      try {
        insertMovie(database, 1, {
          runtime_minutes: 95,
          budget: 1,
          revenue: 2,
        });
        insertMovie(database, 2);

        expect(
          database
            .prepare(
              `SELECT runtime_minutes, budget, revenue, popularity, vote_average, vote_count
               FROM movies WHERE id = ?`,
            )
            .get(2),
        ).toEqual({
          runtime_minutes: null,
          budget: null,
          revenue: null,
          popularity: null,
          vote_average: null,
          vote_count: null,
        });
        expect(
          database
            .prepare(
              'SELECT runtime_minutes, budget, revenue FROM movies WHERE id = ?',
            )
            .get(1),
        ).toEqual({ runtime_minutes: 95, budget: 1, revenue: 2 });
      } finally {
        database.close();
      }
    });

    it.each([
      ['2020-05-01', 2020],
      ['1999-12-31', 1999],
      ['2024-02-29', 2024],
      [null, null],
      ['', null],
      ['2020', null],
      ['2020-05', null],
      ['abc', null],
      ['2020-13-01', null],
      ['2023-02-29', null],
      ['2020-05-01T10:00:00', null],
    ] as const)(
      'derives release_year from release_date %j as %j',
      (releaseDate, expectedYear) => {
        const database = createSeededDatabase();
        try {
          insertMovie(database, 1, { release_date: releaseDate });
          expect(releaseYearOf(database, 1)).toBe(expectedYear);
        } finally {
          database.close();
        }
      },
    );

    it('updates release_year when release_date changes', () => {
      const database = createSeededDatabase();
      try {
        insertMovie(database, 1, { release_date: '2020-05-01' });
        database.exec(
          "UPDATE movies SET release_date = '2015-01-10' WHERE id = 1",
        );
        expect(releaseYearOf(database, 1)).toBe(2015);

        database.exec('UPDATE movies SET release_date = NULL WHERE id = 1');
        expect(releaseYearOf(database, 1)).toBeNull();
      } finally {
        database.close();
      }
    });

    it('refuses to write release_year directly', () => {
      const database = createSeededDatabase();
      try {
        insertMovie(database, 1, { release_date: '2020-05-01' });

        expect(() =>
          database.exec('UPDATE movies SET release_year = 1999 WHERE id = 1'),
        ).toThrow(/cannot UPDATE generated column "release_year"/);
        expect(() =>
          database.exec(
            `INSERT INTO movies (id, title, original_title, original_language,
               overview, release_year, collected_at)
             VALUES (2, 'T', 'T', 'fr', '', 1999, 't')`,
          ),
        ).toThrow(/cannot INSERT into generated column "release_year"/);
      } finally {
        database.close();
      }
    });
  });
});
