import type { DatabaseSync } from 'node:sqlite';
import type { Country } from '../types/DatabaseTypes.ts';

/**
 * Converts a row read from the `countries` table into a `Country`.
 * @param row The raw SQLite row.
 * @returns The country with its code and name.
 */
function toCountry(row: Record<string, unknown>): Country {
  return { code: String(row.code), name: String(row.name) };
}

/**
 * Finds a country by its ISO 3166-1 alpha-2 code.
 * @param database The SQLite database to read from.
 * @param code The country code, e.g. "FR".
 * @returns The matching country, or `undefined` if no country has this code.
 */
export function findCountryByCode(
  database: DatabaseSync,
  code: string,
): Country | undefined {
  const row = database
    .prepare('SELECT code, name FROM countries WHERE code = ?')
    .get(code);
  return row ? toCountry(row) : undefined;
}

/**
 * Lists every country stored in the database.
 * @param database The SQLite database to read from.
 * @returns The countries sorted by ascending code, or an empty list when
 * none is stored.
 */
export function listCountries(database: DatabaseSync): Country[] {
  return database
    .prepare('SELECT code, name FROM countries ORDER BY code ASC')
    .all()
    .map(toCountry);
}

/**
 * Inserts new countries and updates the name of existing ones, identified by
 * their code, without ever creating duplicates. Countries are written in the
 * order given, so when a code appears several times the last name wins. All
 * writes happen in a savepoint: if one fails (e.g. a missing name), none of
 * them is kept and the error is propagated. A savepoint, unlike a plain
 * transaction, also works when the caller has already opened one.
 * @param database The SQLite database to write to.
 * @param countries The countries to insert or update; any iterable is accepted.
 */
export function upsertCountries(
  database: DatabaseSync,
  countries: Iterable<Country>,
): void {
  const statement = database.prepare(
    `INSERT INTO countries (code, name) VALUES (?, ?)
     ON CONFLICT (code) DO UPDATE SET name = excluded.name`,
  );

  database.exec('SAVEPOINT upsert_countries;');
  try {
    for (const country of countries) {
      statement.run(country.code, country.name);
    }
    database.exec('RELEASE upsert_countries;');
  } catch (error) {
    database.exec('ROLLBACK TO upsert_countries; RELEASE upsert_countries;');
    throw error;
  }
}

/**
 * Deletes every country that no movie references in `production_countries`,
 * keeping the countries still associated with at least one movie.
 * @param database The SQLite database to write to.
 * @returns The number of countries deleted.
 */
export function deleteUnusedCountries(database: DatabaseSync): number {
  const result = database
    .prepare(
      `DELETE FROM countries
       WHERE NOT EXISTS (
         SELECT 1 FROM production_countries
         WHERE production_countries.country_code = countries.code
       )`,
    )
    .run();
  return Number(result.changes);
}
