import * as SQLite from 'expo-sqlite';

export const SCHEMA_VERSION = 1;

export async function initializeDatabase(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      name_en TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT 'wine-glass',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ingredients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS drinks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      image TEXT,
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      alcoholic INTEGER DEFAULT 1,
      glass_type TEXT DEFAULT '',
      garnish TEXT DEFAULT '',
      instructions TEXT DEFAULT '',
      is_user_created INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS drink_ingredients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      drink_id INTEGER NOT NULL REFERENCES drinks(id) ON DELETE CASCADE,
      ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
      amount TEXT DEFAULT '',
      unit TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      drink_id INTEGER NOT NULL REFERENCES drinks(id) ON DELETE CASCADE,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(drink_id)
    );

    CREATE TABLE IF NOT EXISTS user_inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(ingredient_id)
    );

    CREATE INDEX IF NOT EXISTS idx_drinks_category ON drinks(category_id);
    CREATE INDEX IF NOT EXISTS idx_drinks_alcoholic ON drinks(alcoholic);
    CREATE INDEX IF NOT EXISTS idx_drinks_user_created ON drinks(is_user_created);
    CREATE INDEX IF NOT EXISTS idx_drink_ingredients_drink ON drink_ingredients(drink_id);
    CREATE INDEX IF NOT EXISTS idx_drink_ingredients_ingredient ON drink_ingredients(ingredient_id);
    CREATE INDEX IF NOT EXISTS idx_favorites_drink ON favorites(drink_id);
    CREATE INDEX IF NOT EXISTS idx_inventory_ingredient ON user_inventory(ingredient_id);
  `);

  await seedCategories(db);
}

async function seedCategories(db: SQLite.SQLiteDatabase): Promise<void> {
  const existing = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM categories'
  );
  if (existing && existing.count > 0) return;

  await db.runAsync(
    'INSERT INTO categories (name, name_en, icon) VALUES (?, ?, ?)',
    ['Cocktail', 'Cocktail', 'wine-glass']
  );
  await db.runAsync(
    'INSERT INTO categories (name, name_en, icon) VALUES (?, ?, ?)',
    ['Alkoholfri', 'Mocktail', 'glass-water']
  );
  await db.runAsync(
    'INSERT INTO categories (name, name_en, icon) VALUES (?, ?, ?)',
    ['Shot', 'Shot', 'flask']
  );
  await db.runAsync(
    'INSERT INTO categories (name, name_en, icon) VALUES (?, ?, ?)',
    ['Longdrink', 'Long drink', 'glass-water']
  );
  await db.runAsync(
    'INSERT INTO categories (name, name_en, icon) VALUES (?, ?, ?)',
    ['Punch', 'Punch', 'bowl-food']
  );
  await db.runAsync(
    'INSERT INTO categories (name, name_en, icon) VALUES (?, ?, ?)',
    ['Smoothie', 'Smoothie', 'blender']
  );
  await db.runAsync(
    'INSERT INTO categories (name, name_en, icon) VALUES (?, ?, ?)',
    ['Annet', 'Other', 'star']
  );
}
