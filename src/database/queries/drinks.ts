import * as SQLite from 'expo-sqlite';
import { Drink, DrinkWithIngredients, DrinkFormData, FilterCategory } from '../../types';

export async function getAllDrinks(
  db: SQLite.SQLiteDatabase,
  filter: FilterCategory = 'all'
): Promise<Drink[]> {
  let query = `
    SELECT
      d.*,
      c.name as category_name,
      CASE WHEN f.drink_id IS NOT NULL THEN 1 ELSE 0 END as is_favorite
    FROM drinks d
    LEFT JOIN categories c ON d.category_id = c.id
    LEFT JOIN favorites f ON d.id = f.drink_id
  `;

  const conditions: string[] = [];
  if (filter === 'alcoholic') conditions.push('d.alcoholic = 1');
  if (filter === 'non-alcoholic') conditions.push('d.alcoholic = 0');
  if (filter === 'favorites') conditions.push('f.drink_id IS NOT NULL');
  if (filter === 'my-drinks') conditions.push('d.is_user_created = 1');

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY d.updated_at DESC';

  return await db.getAllAsync<Drink>(query);
}

export async function getDrinkById(
  db: SQLite.SQLiteDatabase,
  id: number
): Promise<DrinkWithIngredients | null> {
  const drink = await db.getFirstAsync<Drink>(`
    SELECT
      d.*,
      c.name as category_name,
      CASE WHEN f.drink_id IS NOT NULL THEN 1 ELSE 0 END as is_favorite
    FROM drinks d
    LEFT JOIN categories c ON d.category_id = c.id
    LEFT JOIN favorites f ON d.id = f.drink_id
    WHERE d.id = ?
  `, [id]);

  if (!drink) return null;

  const ingredients = await db.getAllAsync<{
    id: number;
    drink_id: number;
    ingredient_id: number;
    ingredient_name: string;
    amount: string;
    unit: string;
  }>(`
    SELECT
      di.id,
      di.drink_id,
      di.ingredient_id,
      i.name as ingredient_name,
      di.amount,
      di.unit
    FROM drink_ingredients di
    JOIN ingredients i ON di.ingredient_id = i.id
    WHERE di.drink_id = ?
    ORDER BY di.id ASC
  `, [id]);

  return { ...drink, ingredients };
}

export async function searchDrinks(
  db: SQLite.SQLiteDatabase,
  query: string
): Promise<Drink[]> {
  const term = `%${query}%`;
  return await db.getAllAsync<Drink>(`
    SELECT DISTINCT
      d.*,
      c.name as category_name,
      CASE WHEN f.drink_id IS NOT NULL THEN 1 ELSE 0 END as is_favorite
    FROM drinks d
    LEFT JOIN categories c ON d.category_id = c.id
    LEFT JOIN favorites f ON d.id = f.drink_id
    LEFT JOIN drink_ingredients di ON d.id = di.drink_id
    LEFT JOIN ingredients i ON di.ingredient_id = i.id
    WHERE d.name LIKE ?
      OR d.description LIKE ?
      OR c.name LIKE ?
      OR i.name LIKE ?
    ORDER BY d.name ASC
  `, [term, term, term, term]);
}

export async function createDrink(
  db: SQLite.SQLiteDatabase,
  data: DrinkFormData
): Promise<number> {
  const result = await db.runAsync(`
    INSERT INTO drinks (name, description, image, category_id, alcoholic, glass_type, garnish, instructions, is_user_created)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
  `, [
    data.name,
    data.description || '',
    data.image || null,
    data.category_id || null,
    data.alcoholic ? 1 : 0,
    data.glass_type || '',
    data.garnish || '',
    data.instructions || '',
  ]);

  const drinkId = result.lastInsertRowId;

  for (const item of data.ingredients) {
    if (!item.ingredient_name.trim()) continue;
    const ingredientId = await ensureIngredient(db, item.ingredient_name.trim());
    await db.runAsync(`
      INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
      VALUES (?, ?, ?, ?)
    `, [drinkId, ingredientId, item.amount || '', item.unit || '']);
  }

  return drinkId;
}

export async function updateDrink(
  db: SQLite.SQLiteDatabase,
  id: number,
  data: DrinkFormData
): Promise<void> {
  await db.runAsync(`
    UPDATE drinks
    SET name = ?, description = ?, image = ?, category_id = ?, alcoholic = ?,
        glass_type = ?, garnish = ?, instructions = ?, updated_at = datetime('now')
    WHERE id = ?
  `, [
    data.name,
    data.description || '',
    data.image || null,
    data.category_id || null,
    data.alcoholic ? 1 : 0,
    data.glass_type || '',
    data.garnish || '',
    data.instructions || '',
    id,
  ]);

  await db.runAsync('DELETE FROM drink_ingredients WHERE drink_id = ?', [id]);

  for (const item of data.ingredients) {
    if (!item.ingredient_name.trim()) continue;
    const ingredientId = await ensureIngredient(db, item.ingredient_name.trim());
    await db.runAsync(`
      INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
      VALUES (?, ?, ?, ?)
    `, [id, ingredientId, item.amount || '', item.unit || '']);
  }
}

export async function deleteDrink(
  db: SQLite.SQLiteDatabase,
  id: number
): Promise<void> {
  await db.runAsync('DELETE FROM drinks WHERE id = ?', [id]);
}

async function ensureIngredient(
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

export async function getDrinksByIngredients(
  db: SQLite.SQLiteDatabase,
  ingredientIds: number[]
): Promise<Drink[]> {
  if (ingredientIds.length === 0) return [];
  const placeholders = ingredientIds.map(() => '?').join(',');
  return await db.getAllAsync<Drink>(`
    SELECT DISTINCT
      d.*,
      c.name as category_name,
      CASE WHEN f.drink_id IS NOT NULL THEN 1 ELSE 0 END as is_favorite
    FROM drinks d
    LEFT JOIN categories c ON d.category_id = c.id
    LEFT JOIN favorites f ON d.id = f.drink_id
    JOIN drink_ingredients di ON d.id = di.drink_id
    WHERE di.ingredient_id IN (${placeholders})
    ORDER BY d.name ASC
  `, ingredientIds);
}

export async function getAllDrinksWithIngredients(
  db: SQLite.SQLiteDatabase
): Promise<DrinkWithIngredients[]> {
  const drinks = await db.getAllAsync<Drink>(`
    SELECT
      d.*,
      c.name as category_name,
      CASE WHEN f.drink_id IS NOT NULL THEN 1 ELSE 0 END as is_favorite
    FROM drinks d
    LEFT JOIN categories c ON d.category_id = c.id
    LEFT JOIN favorites f ON d.id = f.drink_id
    ORDER BY d.name ASC
  `);

  const result: DrinkWithIngredients[] = [];
  for (const drink of drinks) {
    const ingredients = await db.getAllAsync<{
      id: number;
      drink_id: number;
      ingredient_id: number;
      ingredient_name: string;
      amount: string;
      unit: string;
    }>(`
      SELECT di.id, di.drink_id, di.ingredient_id, i.name as ingredient_name, di.amount, di.unit
      FROM drink_ingredients di
      JOIN ingredients i ON di.ingredient_id = i.id
      WHERE di.drink_id = ?
    `, [drink.id]);
    result.push({ ...drink, ingredients });
  }
  return result;
}
