import * as SQLite from 'expo-sqlite';
import { Ingredient } from '../../types';

export async function getAllIngredients(db: SQLite.SQLiteDatabase): Promise<Ingredient[]> {
  return await db.getAllAsync<Ingredient>(
    'SELECT * FROM ingredients ORDER BY name ASC'
  );
}

export async function searchIngredients(
  db: SQLite.SQLiteDatabase,
  query: string
): Promise<Ingredient[]> {
  return await db.getAllAsync<Ingredient>(
    'SELECT * FROM ingredients WHERE name LIKE ? ORDER BY name ASC',
    [`%${query}%`]
  );
}

export async function createIngredient(
  db: SQLite.SQLiteDatabase,
  name: string
): Promise<number> {
  const existing = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM ingredients WHERE name = ? COLLATE NOCASE',
    [name]
  );
  if (existing) return existing.id;

  const result = await db.runAsync(
    'INSERT INTO ingredients (name) VALUES (?)',
    [name]
  );
  return result.lastInsertRowId;
}
