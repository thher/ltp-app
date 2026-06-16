import * as SQLite from 'expo-sqlite';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const starterData = require('../../assets/drinkmix_starter_database.json');

interface JsonIngredient {
  name: string;
  amount: string;
  unit: string;
}

interface JsonDrink {
  name: string;
  description: string;
  image: string;
  category: string;
  alcoholic: boolean;
  glass_type: string;
  garnish: string;
  instructions: string | string[];
  ingredients: JsonIngredient[];
}

const CATEGORY_DEFAULTS: Record<string, { name_en: string; icon: string }> = {
  Cocktail:   { name_en: 'Cocktail',   icon: 'wine-glass'  },
  Alkoholfri: { name_en: 'Mocktail',   icon: 'glass-water' },
  Mocktail:   { name_en: 'Mocktail',   icon: 'glass-water' },
  Shot:       { name_en: 'Shot',       icon: 'flask'       },
  Longdrink:  { name_en: 'Long drink', icon: 'glass-water' },
  Punch:      { name_en: 'Punch',      icon: 'bowl-food'   },
  Smoothie:   { name_en: 'Smoothie',   icon: 'blender'     },
  Annet:      { name_en: 'Other',      icon: 'star'        },
};

async function ensureCategory(db: SQLite.SQLiteDatabase, categoryName: string): Promise<number> {
  const existing = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM categories WHERE name = ? COLLATE NOCASE',
    [categoryName]
  );
  if (existing) return existing.id;

  const meta = CATEGORY_DEFAULTS[categoryName] ?? { name_en: categoryName, icon: 'star' };
  const result = await db.runAsync(
    'INSERT INTO categories (name, name_en, icon) VALUES (?, ?, ?)',
    [categoryName, meta.name_en, meta.icon]
  );
  return result.lastInsertRowId;
}

async function ensureIngredient(db: SQLite.SQLiteDatabase, name: string): Promise<number> {
  await db.runAsync('INSERT OR IGNORE INTO ingredients (name) VALUES (?)', [name]);
  const row = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM ingredients WHERE name = ? COLLATE NOCASE',
    [name]
  );
  return row!.id;
}

/**
 * Seeds the database from drinkmix_starter_database.json.
 * @param force  If false (default), skips if drinks already exist.
 * @returns number of drinks inserted.
 */
export async function seedFromJson(
  db: SQLite.SQLiteDatabase,
  force = false
): Promise<number> {
  console.log('[DrinkMix] seed started');

  const drinks: JsonDrink[] = starterData.data.drinks;

  if (!force) {
    const existing = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM drinks'
    );
    if (existing && existing.count > 0) {
      console.log(`[DrinkMix] seed skipped — ${existing.count} drinks already in database`);
      return 0;
    }
  }

  let inserted = 0;

  for (const drink of drinks) {
    const dup = await db.getFirstAsync<{ id: number }>(
      'SELECT id FROM drinks WHERE name = ? COLLATE NOCASE',
      [drink.name]
    );
    if (dup) continue;

    const categoryId = await ensureCategory(db, drink.category ?? 'Annet');

    const instructions = Array.isArray(drink.instructions)
      ? drink.instructions.join('\n')
      : (drink.instructions ?? '');

    const result = await db.runAsync(
      `INSERT INTO drinks (name, description, image, category_id, alcoholic, glass_type, garnish, instructions, is_user_created)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        drink.name,
        drink.description ?? '',
        drink.image ?? null,
        categoryId,
        drink.alcoholic ? 1 : 0,
        drink.glass_type ?? '',
        drink.garnish ?? '',
        instructions,
      ]
    );

    const drinkId = result.lastInsertRowId;

    for (const ing of drink.ingredients ?? []) {
      if (!ing.name?.trim()) continue;
      const ingId = await ensureIngredient(db, ing.name.trim());
      await db.runAsync(
        'INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit) VALUES (?, ?, ?, ?)',
        [drinkId, ingId, ing.amount ?? '', ing.unit ?? '']
      );
    }

    inserted++;
    console.log(`[DrinkMix] drinks inserted: ${inserted} — ${drink.name}`);
  }

  console.log(`[DrinkMix] seed completed — ${inserted} drinks inserted`);
  return inserted;
}
