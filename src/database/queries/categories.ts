import * as SQLite from 'expo-sqlite';
import { Category } from '../../types';

export async function getAllCategories(db: SQLite.SQLiteDatabase): Promise<Category[]> {
  return await db.getAllAsync<Category>(
    'SELECT * FROM categories ORDER BY name ASC'
  );
}
