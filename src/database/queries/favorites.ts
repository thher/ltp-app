import * as SQLite from 'expo-sqlite';

export async function addFavorite(db: SQLite.SQLiteDatabase, drinkId: number): Promise<void> {
  await db.runAsync(
    'INSERT OR IGNORE INTO favorites (drink_id) VALUES (?)',
    [drinkId]
  );
}

export async function removeFavorite(db: SQLite.SQLiteDatabase, drinkId: number): Promise<void> {
  await db.runAsync('DELETE FROM favorites WHERE drink_id = ?', [drinkId]);
}

export async function isFavorite(db: SQLite.SQLiteDatabase, drinkId: number): Promise<boolean> {
  const result = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM favorites WHERE drink_id = ?',
    [drinkId]
  );
  return (result?.count ?? 0) > 0;
}

export async function getAllFavoriteIds(db: SQLite.SQLiteDatabase): Promise<number[]> {
  const rows = await db.getAllAsync<{ drink_id: number }>(
    'SELECT drink_id FROM favorites'
  );
  return rows.map(r => r.drink_id);
}
