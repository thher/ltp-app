import * as SQLite from 'expo-sqlite';
import { InventoryItem } from '../../types';

export async function getInventory(db: SQLite.SQLiteDatabase): Promise<InventoryItem[]> {
  return await db.getAllAsync<InventoryItem>(`
    SELECT ui.id, ui.ingredient_id, i.name as ingredient_name, ui.created_at
    FROM user_inventory ui
    JOIN ingredients i ON ui.ingredient_id = i.id
    ORDER BY i.name ASC
  `);
}

export async function addToInventory(
  db: SQLite.SQLiteDatabase,
  ingredientId: number
): Promise<void> {
  await db.runAsync(
    'INSERT OR IGNORE INTO user_inventory (ingredient_id) VALUES (?)',
    [ingredientId]
  );
}

export async function removeFromInventory(
  db: SQLite.SQLiteDatabase,
  ingredientId: number
): Promise<void> {
  await db.runAsync(
    'DELETE FROM user_inventory WHERE ingredient_id = ?',
    [ingredientId]
  );
}

export async function getInventoryIngredientIds(
  db: SQLite.SQLiteDatabase
): Promise<number[]> {
  const rows = await db.getAllAsync<{ ingredient_id: number }>(
    'SELECT ingredient_id FROM user_inventory'
  );
  return rows.map(r => r.ingredient_id);
}

export async function isInInventory(
  db: SQLite.SQLiteDatabase,
  ingredientId: number
): Promise<boolean> {
  const result = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM user_inventory WHERE ingredient_id = ?',
    [ingredientId]
  );
  return (result?.count ?? 0) > 0;
}
