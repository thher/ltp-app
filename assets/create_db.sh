#!/usr/bin/env bash
# Build pre-populated drinkmix.db from schema.ts seed data
# Handles Norwegian characters (ø, æ, å) via UTF-8 locale

export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8

DB="/home/user/ltp-app/assets/drinkmix.db"

# Remove existing database
rm -f "$DB"

sqlite3 "$DB" <<'ENDSQL'
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

INSERT INTO schema_version (version) VALUES (1);

-- ============================================================
-- CATEGORIES
-- ============================================================
INSERT INTO categories (name, name_en, icon) VALUES ('Cocktail', 'Cocktail', 'wine-glass');
INSERT INTO categories (name, name_en, icon) VALUES ('Alkoholfri', 'Mocktail', 'glass-water');
INSERT INTO categories (name, name_en, icon) VALUES ('Shot', 'Shot', 'flask');
INSERT INTO categories (name, name_en, icon) VALUES ('Longdrink', 'Long drink', 'glass-water');
INSERT INTO categories (name, name_en, icon) VALUES ('Punch', 'Punch', 'bowl-food');
INSERT INTO categories (name, name_en, icon) VALUES ('Smoothie', 'Smoothie', 'blender');
INSERT INTO categories (name, name_en, icon) VALUES ('Annet', 'Other', 'star');

-- ============================================================
-- INGREDIENTS (all unique, inserted with INSERT OR IGNORE)
-- ============================================================
INSERT OR IGNORE INTO ingredients (name) VALUES ('Hvit rom');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Limejuice');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Sukker');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Fersk mynte');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Sodavann');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Tequila');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Triple sec');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Salt');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Gin');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Campari');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Søt vermouth');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Bourbon whiskey');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Angostura bitters');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Vann');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Aperol');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Prosecco');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Vodka');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Tranebærjuice');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Tonic water');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Ingefærøl');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Sitronsaft');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Sukkersirup');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Eggehvite');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Kokosnøttkrem');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Ananasjuice');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Cola');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Persikoschnaps');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Appelsinjuice');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Grenadine');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Kahlúa');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Espresso');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Rye whiskey');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Grapefruktbrus');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Mørk rom');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Hylleblomstsaft');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Kirsebærlikør');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Cointreau');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Ferske jordbær');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Baileys');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Grand Marnier');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Ginger ale');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Alkoholfri aperitiff');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Alkoholfri musserende vin');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Jordbær');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Banan');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Gresk yoghurt');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Honning');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Melk');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Spinat');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Eple');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Agurk');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Frisk ingefær');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Champagne');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Limekordial');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Bringebærsirup');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Cognac');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Mørk kakaol ikør');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Kremfløte');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Aged rom');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Appelsinlikør');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Mandelsirup (orgeat)');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Kokoskrem');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Grapefruktjuice');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Maraschino-likør');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Passoa');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Pasjonsfruktpuré');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Vaniljesukkersirup');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Chambord');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Ferskenpuré');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Crème de cassis');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Agavenektar');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Jägermeister');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Energidrikk');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Iskald svart te');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Vannmelon');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Mango');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Kardemomme');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Blåbær');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Havregryn');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Scotch whisky');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Drambuie');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Amaretto');
INSERT OR IGNORE INTO ingredients (name) VALUES ('Amaro Nonino');

-- ============================================================
-- DRINKS + DRINK_INGREDIENTS
-- ============================================================

-- 1. Mojito (category_id=1, alcoholic=1)
INSERT INTO drinks (name, description, image, category_id, alcoholic, glass_type, garnish, instructions, is_user_created)
VALUES (
  'Mojito',
  'Klassisk cubansk forfriskende cocktail med fersk mynte og lime. Lett, syrlig og perfekt til sommervarmen.',
  'https://www.thecocktaildb.com/images/media/drink/metwgh1606770327.jpg',
  1, 1,
  'Highball-glass',
  'Frisk myntekvast og limeskive',
  '1. Legg limebåter og sukker i glasset og knus dem lett med en pestel.' || char(10) || '2. Fyll glasset halvfullt med knust is.' || char(10) || '3. Hell over hvit rom og rør godt.' || char(10) || '4. Fyll opp med sodavann.' || char(10) || '5. Pynt med myntekvast og limeskive.',
  0
);
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT last_insert_rowid(), id, '5', 'cl' FROM ingredients WHERE name='Hvit rom';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Mojito'), id, '3', 'cl' FROM ingredients WHERE name='Limejuice';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Mojito'), id, '2', 'ts' FROM ingredients WHERE name='Sukker';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Mojito'), id, '8', 'blader' FROM ingredients WHERE name='Fersk mynte';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Mojito'), id, '10', 'cl' FROM ingredients WHERE name='Sodavann';

-- 2. Margarita (category_id=1, alcoholic=1)
INSERT INTO drinks (name, description, image, category_id, alcoholic, glass_type, garnish, instructions, is_user_created)
VALUES (
  'Margarita',
  'Ikonisk mexicansk cocktail med tequila, triple sec og frisk limejuice. Klassisk servert med saltkant.',
  'https://www.thecocktaildb.com/images/media/drink/5noda61589575158.jpg',
  1, 1,
  'Margarita-glass',
  'Saltkant og limeskive',
  '1. Fukt kanten av glasset med lime og dypp det i salt.' || char(10) || '2. Fyll en shaker med is.' || char(10) || '3. Tilsett tequila, triple sec og limejuice.' || char(10) || '4. Rist godt i 15 sekunder.' || char(10) || '5. Sil over i glasset.',
  0
);
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT last_insert_rowid(), id, '5', 'cl' FROM ingredients WHERE name='Tequila';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Margarita'), id, '2', 'cl' FROM ingredients WHERE name='Triple sec';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Margarita'), id, '2', 'cl' FROM ingredients WHERE name='Limejuice';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Margarita'), id, '', 'til kanten' FROM ingredients WHERE name='Salt';

-- 3. Negroni (category_id=1, alcoholic=1)
INSERT INTO drinks (name, description, image, category_id, alcoholic, glass_type, garnish, instructions, is_user_created)
VALUES (
  'Negroni',
  'Balansert og kompleks italiensk aperitiff med lik del gin, Campari og søt vermouth.',
  'https://www.thecocktaildb.com/images/media/drink/qgdu971561574065.jpg',
  1, 1,
  'Rocks-glass',
  'Appelsinskive',
  '1. Fyll glasset med store isbiter.' || char(10) || '2. Hell over gin, Campari og vermouth.' || char(10) || '3. Rør forsiktig i 20–30 sekunder til det er godt avkjølt.' || char(10) || '4. Pynt med en skive appelsinskal.',
  0
);
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT last_insert_rowid(), id, '3', 'cl' FROM ingredients WHERE name='Gin';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Negroni'), id, '3', 'cl' FROM ingredients WHERE name='Campari';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Negroni'), id, '3', 'cl' FROM ingredients WHERE name='Søt vermouth';

-- 4. Old Fashioned (category_id=1, alcoholic=1)
INSERT INTO drinks (name, description, image, category_id, alcoholic, glass_type, garnish, instructions, is_user_created)
VALUES (
  'Old Fashioned',
  'En av verdens eldste cocktailoppskrifter. Bourbon, sukker og bitters — enkelt og tidløst.',
  'https://www.thecocktaildb.com/images/media/drink/vrwquq1461769560.jpg',
  1, 1,
  'Rocks-glass',
  'Appelsinskall og kirsebær',
  '1. Legg sukkerbiten i glasset og fukt den med angostura bitters og et par dråper vann.' || char(10) || '2. Knus sukkerbiten lett.' || char(10) || '3. Tilsett bourbon og rør godt.' || char(10) || '4. Fyll med én stor isklump.' || char(10) || '5. Pynt med appelsinskall og maraschino-kirsebær.',
  0
);
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT last_insert_rowid(), id, '6', 'cl' FROM ingredients WHERE name='Bourbon whiskey';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Old Fashioned'), id, '2', 'dråper' FROM ingredients WHERE name='Angostura bitters';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Old Fashioned'), id, '1', 'bit' FROM ingredients WHERE name='Sukker';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Old Fashioned'), id, '1', 'ts' FROM ingredients WHERE name='Vann';

-- 5. Aperol Spritz (category_id=1, alcoholic=1)
INSERT INTO drinks (name, description, image, category_id, alcoholic, glass_type, garnish, instructions, is_user_created)
VALUES (
  'Aperol Spritz',
  'Sommerens favorittdrink fra Italia. Lys, frisk og perfekt til en varm kveld ute.',
  'https://www.thecocktaildb.com/images/media/drink/ikg2ax1504372491.jpg',
  1, 1,
  'Vinglass',
  'Appelsinskive',
  '1. Fyll et stort vinglass med isbiter.' || char(10) || '2. Hell over prosecco.' || char(10) || '3. Tilsett Aperol.' || char(10) || '4. Fyll opp med et skvett sodavann.' || char(10) || '5. Rør forsiktig og pynt med appelsinskive.',
  0
);
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT last_insert_rowid(), id, '6', 'cl' FROM ingredients WHERE name='Aperol';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Aperol Spritz'), id, '9', 'cl' FROM ingredients WHERE name='Prosecco';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Aperol Spritz'), id, '3', 'cl' FROM ingredients WHERE name='Sodavann';

-- 6. Cosmopolitan (category_id=1, alcoholic=1)
INSERT INTO drinks (name, description, image, category_id, alcoholic, glass_type, garnish, instructions, is_user_created)
VALUES (
  'Cosmopolitan',
  'Rosa og elegant — en moderne klassiker popularisert av Sex and the City. Søt, syrlig og vodkabasert.',
  'https://www.thecocktaildb.com/images/media/drink/kpsajh1504368362.jpg',
  1, 1,
  'Cocktailglass',
  'Limeskive eller appelsinskall',
  '1. Fyll en shaker med is.' || char(10) || '2. Tilsett vodka, triple sec, tranebærjuice og limejuice.' || char(10) || '3. Rist energisk i 15 sekunder.' || char(10) || '4. Sil over i et avkjølt cocktailglass.' || char(10) || '5. Pynt med limeskive.',
  0
);
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT last_insert_rowid(), id, '4', 'cl' FROM ingredients WHERE name='Vodka';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Cosmopolitan'), id, '2', 'cl' FROM ingredients WHERE name='Triple sec';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Cosmopolitan'), id, '3', 'cl' FROM ingredients WHERE name='Tranebærjuice';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Cosmopolitan'), id, '1', 'cl' FROM ingredients WHERE name='Limejuice';

-- 7. Gin & Tonic (category_id=4, alcoholic=1)
INSERT INTO drinks (name, description, image, category_id, alcoholic, glass_type, garnish, instructions, is_user_created)
VALUES (
  'Gin & Tonic',
  'Enkel og forfriskende — alltid et godt valg. Gin og tonic er et klassisk par som aldri går av moten.',
  'https://www.thecocktaildb.com/images/media/drink/z0omyp1582477529.jpg',
  4, 1,
  'Highball-glass',
  'Limeskive og isbiter',
  '1. Fyll et høyt glass med store isbiter.' || char(10) || '2. Hell over gin.' || char(10) || '3. Fyll forsiktig opp med kjølt tonic for å bevare bobblene.' || char(10) || '4. Rør én gang forsiktig.' || char(10) || '5. Pynt med limeskive.',
  0
);
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT last_insert_rowid(), id, '5', 'cl' FROM ingredients WHERE name='Gin';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Gin & Tonic'), id, '15', 'cl' FROM ingredients WHERE name='Tonic water';

-- 8. Moscow Mule (category_id=1, alcoholic=1)
INSERT INTO drinks (name, description, image, category_id, alcoholic, glass_type, garnish, instructions, is_user_created)
VALUES (
  'Moscow Mule',
  'Forfriskende vodkacocktail med ingefærøl og lime, tradisjonelt servert i et koppmug av kobber.',
  'https://www.thecocktaildb.com/images/media/drink/3pylqc1504370988.jpg',
  1, 1,
  'Kobbermug',
  'Limeskive og fersk mynte',
  '1. Fyll et kobbermug med knust is.' || char(10) || '2. Tilsett vodka og limejuice.' || char(10) || '3. Fyll opp med ingefærøl.' || char(10) || '4. Rør forsiktig.' || char(10) || '5. Pynt med limeskive og myntekvist.',
  0
);
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT last_insert_rowid(), id, '5', 'cl' FROM ingredients WHERE name='Vodka';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Moscow Mule'), id, '15', 'cl' FROM ingredients WHERE name='Ingefærøl';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Moscow Mule'), id, '2', 'cl' FROM ingredients WHERE name='Limejuice';

-- 9. Whiskey Sour (category_id=1, alcoholic=1)
INSERT INTO drinks (name, description, image, category_id, alcoholic, glass_type, garnish, instructions, is_user_created)
VALUES (
  'Whiskey Sour',
  'Søt og syrlig whiskeyklassiker med eggehvite for et silkemykt skum på toppen.',
  'https://www.thecocktaildb.com/images/media/drink/vydxpo1468878515.jpg',
  1, 1,
  'Rocks-glass',
  'Sitronskal og kirsebær',
  '1. Ha alle ingredienser i shakeren UTEN is (dry shake) og rist i 10 sekunder for å emulgere eggehviten.' || char(10) || '2. Tilsett is og rist igjen kraftig i 15 sekunder.' || char(10) || '3. Sil over i glass med is.' || char(10) || '4. Pynt med sitronskal og kirsebær.',
  0
);
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT last_insert_rowid(), id, '5', 'cl' FROM ingredients WHERE name='Bourbon whiskey';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Whiskey Sour'), id, '3', 'cl' FROM ingredients WHERE name='Sitronsaft';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Whiskey Sour'), id, '2', 'cl' FROM ingredients WHERE name='Sukkersirup';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Whiskey Sour'), id, '1', 'stk' FROM ingredients WHERE name='Eggehvite';

-- 10. Daiquiri (category_id=1, alcoholic=1)
INSERT INTO drinks (name, description, image, category_id, alcoholic, glass_type, garnish, instructions, is_user_created)
VALUES (
  'Daiquiri',
  'Enkel og elegant rombasert klassiker. Bare tre ingredienser, men perfekt balanse mellom syrlig og søtt.',
  'https://www.thecocktaildb.com/images/media/drink/mrz9091589574515.jpg',
  1, 1,
  'Cocktailglass',
  'Limeskive',
  '1. Fyll en shaker med is.' || char(10) || '2. Tilsett rom, limejuice og sukkersirup.' || char(10) || '3. Rist godt i 15 sekunder.' || char(10) || '4. Sil over i et avkjølt cocktailglass.' || char(10) || '5. Pynt med en limeskive.',
  0
);
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT last_insert_rowid(), id, '5', 'cl' FROM ingredients WHERE name='Hvit rom';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Daiquiri'), id, '3', 'cl' FROM ingredients WHERE name='Limejuice';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Daiquiri'), id, '2', 'cl' FROM ingredients WHERE name='Sukkersirup';

-- 11. Piña Colada (category_id=1, alcoholic=1)
INSERT INTO drinks (name, description, image, category_id, alcoholic, glass_type, garnish, instructions, is_user_created)
VALUES (
  'Piña Colada',
  'Tropisk drøm i et glass. Rom, kokosnøtt og ananas — smaken av ferie og solskinn.',
  'https://www.thecocktaildb.com/images/media/drink/upgsue1668419912.jpg',
  1, 1,
  'Hurricane-glass',
  'Ananasbit og kirsebær',
  '1. Ha rom, kokosnøttkrem og ananasjuice i en blender.' || char(10) || '2. Tilsett 1 kopp knust is.' || char(10) || '3. Bland på høy hastighet til glatt.' || char(10) || '4. Hell over i glass.' || char(10) || '5. Pynt med ananasbit og kirsebær.',
  0
);
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT last_insert_rowid(), id, '5', 'cl' FROM ingredients WHERE name='Hvit rom';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Piña Colada'), id, '3', 'cl' FROM ingredients WHERE name='Kokosnøttkrem';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Piña Colada'), id, '10', 'cl' FROM ingredients WHERE name='Ananasjuice';

-- 12. Long Island Iced Tea (category_id=4, alcoholic=1)
INSERT INTO drinks (name, description, image, category_id, alcoholic, glass_type, garnish, instructions, is_user_created)
VALUES (
  'Long Island Iced Tea',
  'Sterkere enn den ser ut! Fem ulike spriter blandet med sitrus og cola gir smaken av is-te.',
  'https://www.thecocktaildb.com/images/media/drink/nkwr4c1606770558.jpg',
  4, 1,
  'Highball-glass',
  'Sitronskive',
  '1. Fyll et highball-glass med isbiter.' || char(10) || '2. Tilsett vodka, gin, rom, tequila, triple sec og sitronsaft.' || char(10) || '3. Rør godt.' || char(10) || '4. Fyll forsiktig opp med cola.' || char(10) || '5. Pynt med sitronskive.',
  0
);
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT last_insert_rowid(), id, '1.5', 'cl' FROM ingredients WHERE name='Vodka';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Long Island Iced Tea'), id, '1.5', 'cl' FROM ingredients WHERE name='Gin';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Long Island Iced Tea'), id, '1.5', 'cl' FROM ingredients WHERE name='Hvit rom';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Long Island Iced Tea'), id, '1.5', 'cl' FROM ingredients WHERE name='Tequila';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Long Island Iced Tea'), id, '1.5', 'cl' FROM ingredients WHERE name='Triple sec';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Long Island Iced Tea'), id, '2.5', 'cl' FROM ingredients WHERE name='Sitronsaft';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Long Island Iced Tea'), id, '10', 'cl' FROM ingredients WHERE name='Cola';

-- 13. Sex on the Beach (category_id=1, alcoholic=1)
INSERT INTO drinks (name, description, image, category_id, alcoholic, glass_type, garnish, instructions, is_user_created)
VALUES (
  'Sex on the Beach',
  'Fargerik og tropisk sommerdrink med vodka, persikoschnaps og en deilig blanding av juicer.',
  'https://www.thecocktaildb.com/images/media/drink/bx8ob21504366839.jpg',
  1, 1,
  'Highball-glass',
  'Appelsinskive og kirsebær',
  '1. Fyll et highball-glass med isbiter.' || char(10) || '2. Hell over vodka og persikoschnaps.' || char(10) || '3. Tilsett appelsinjuice og tranebærjuice.' || char(10) || '4. Rør forsiktig for å skape en fin fargeeffekt.' || char(10) || '5. Pynt med appelsinskive og kirsebær.',
  0
);
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT last_insert_rowid(), id, '4', 'cl' FROM ingredients WHERE name='Vodka';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Sex on the Beach'), id, '2', 'cl' FROM ingredients WHERE name='Persikoschnaps';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Sex on the Beach'), id, '6', 'cl' FROM ingredients WHERE name='Appelsinjuice';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Sex on the Beach'), id, '6', 'cl' FROM ingredients WHERE name='Tranebærjuice';

-- 14. Tequila Sunrise (category_id=1, alcoholic=1)
INSERT INTO drinks (name, description, image, category_id, alcoholic, glass_type, garnish, instructions, is_user_created)
VALUES (
  'Tequila Sunrise',
  'Vakker soloppgangseffekt i glasset. Appelsinjuice og grenadine skaper et spektakulært fargespill.',
  'https://www.thecocktaildb.com/images/media/drink/tqyrpw1439905311.jpg',
  1, 1,
  'Highball-glass',
  'Appelsinskive og kirsebær',
  '1. Fyll et glass med isbiter.' || char(10) || '2. Hell over tequila og appelsinjuice og rør lett.' || char(10) || '3. Hell forsiktig grenadinen ned langs kanten eller med en skje slik at den synker til bunnen.' || char(10) || '4. IKKE rør — la "soloppgangen" vises.' || char(10) || '5. Pynt med appelsinskive og kirsebær.',
  0
);
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT last_insert_rowid(), id, '5', 'cl' FROM ingredients WHERE name='Tequila';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Tequila Sunrise'), id, '10', 'cl' FROM ingredients WHERE name='Appelsinjuice';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Tequila Sunrise'), id, '1.5', 'cl' FROM ingredients WHERE name='Grenadine';

-- 15. Espresso Martini (category_id=1, alcoholic=1)
INSERT INTO drinks (name, description, image, category_id, alcoholic, glass_type, garnish, instructions, is_user_created)
VALUES (
  'Espresso Martini',
  'For de som vil ha kaffe og cocktail i ett. Vodka og kahlúa møter fersk espresso — kraftfull og velsmakende.',
  'https://www.thecocktaildb.com/images/media/drink/n0sx8g1504366923.jpg',
  1, 1,
  'Cocktailglass',
  '3 kaffebønner',
  '1. Trekk en espresso og la den avkjøle seg litt.' || char(10) || '2. Fyll en shaker med is.' || char(10) || '3. Tilsett vodka, kahlúa, espresso og sukkersirup.' || char(10) || '4. Rist KRAFTIG i 20 sekunder for å skape skum.' || char(10) || '5. Sil over i avkjølt cocktailglass og pynt med 3 kaffebønner.',
  0
);
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT last_insert_rowid(), id, '5', 'cl' FROM ingredients WHERE name='Vodka';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Espresso Martini'), id, '2', 'cl' FROM ingredients WHERE name='Kahlúa';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Espresso Martini'), id, '3', 'cl' FROM ingredients WHERE name='Espresso';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Espresso Martini'), id, '1', 'cl' FROM ingredients WHERE name='Sukkersirup';

-- 16. Manhattan (category_id=1, alcoholic=1)
INSERT INTO drinks (name, description, image, category_id, alcoholic, glass_type, garnish, instructions, is_user_created)
VALUES (
  'Manhattan',
  'Tidløs og sofistikert klassiker fra New York. Whiskey, vermouth og bitters i perfekt harmoni.',
  'https://www.thecocktaildb.com/images/media/drink/yk70e31606771240.jpg',
  1, 1,
  'Cocktailglass',
  'Maraschino-kirsebær',
  '1. Fyll en røreglass med isbiter.' || char(10) || '2. Tilsett whiskey, søt vermouth og angostura bitters.' || char(10) || '3. Rør rolig i 30 sekunder til det er godt avkjølt.' || char(10) || '4. Sil over i avkjølt cocktailglass.' || char(10) || '5. Pynt med maraschino-kirsebær.',
  0
);
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT last_insert_rowid(), id, '6', 'cl' FROM ingredients WHERE name='Rye whiskey';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Manhattan'), id, '3', 'cl' FROM ingredients WHERE name='Søt vermouth';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Manhattan'), id, '2', 'dråper' FROM ingredients WHERE name='Angostura bitters';

-- 17. Paloma (category_id=1, alcoholic=1)
INSERT INTO drinks (name, description, image, category_id, alcoholic, glass_type, garnish, instructions, is_user_created)
VALUES (
  'Paloma',
  'Meksikos mest elskede cocktail — tequila med frisk grapefrukt. Lettere og friskere enn en margarita.',
  'https://www.thecocktaildb.com/images/media/drink/tsssxr1454511116.jpg',
  1, 1,
  'Highball-glass',
  'Saltkant og grapefruktskive',
  '1. Fukt kanten av glasset med lime og dypp i salt.' || char(10) || '2. Fyll glasset med isbiter.' || char(10) || '3. Tilsett tequila og limejuice.' || char(10) || '4. Fyll opp med grapefruktbrus.' || char(10) || '5. Rør forsiktig og pynt med grapefruktskive.',
  0
);
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT last_insert_rowid(), id, '5', 'cl' FROM ingredients WHERE name='Tequila';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Paloma'), id, '15', 'cl' FROM ingredients WHERE name='Grapefruktbrus';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Paloma'), id, '1', 'cl' FROM ingredients WHERE name='Limejuice';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Paloma'), id, '', 'til kanten' FROM ingredients WHERE name='Salt';

-- 18. Dark 'n' Stormy (category_id=1, alcoholic=1)
INSERT INTO drinks (name, description, image, category_id, alcoholic, glass_type, garnish, instructions, is_user_created)
VALUES (
  'Dark ''n'' Stormy',
  'Kraftig og forfriskende med mørk rom og sprudlende ingefærøl. En storm i et glass.',
  'https://www.thecocktaildb.com/images/media/drink/a8a6e21606769727.jpg',
  1, 1,
  'Highball-glass',
  'Limeskive',
  '1. Fyll et highball-glass med isbiter.' || char(10) || '2. Tilsett limejuice.' || char(10) || '3. Fyll opp med ingefærøl.' || char(10) || '4. Hell forsiktig mørk rom over en skje slik at det flyter på toppen.' || char(10) || '5. Pynt med limeskive.',
  0
);
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT last_insert_rowid(), id, '6', 'cl' FROM ingredients WHERE name='Mørk rom';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Dark ''n'' Stormy'), id, '15', 'cl' FROM ingredients WHERE name='Ingefærøl';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Dark ''n'' Stormy'), id, '1', 'cl' FROM ingredients WHERE name='Limejuice';

-- 19. Hugo Spritz (category_id=1, alcoholic=1)
INSERT INTO drinks (name, description, image, category_id, alcoholic, glass_type, garnish, instructions, is_user_created)
VALUES (
  'Hugo Spritz',
  'Skandinavias favorittspritz med hylleblomst og mynte. Lett og blomstrende — perfekt sommerdrikk.',
  'https://www.thecocktaildb.com/images/media/drink/ikg2ax1504372491.jpg',
  1, 1,
  'Vinglass',
  'Fersk mynte og limeskive',
  '1. Fyll et stort vinglass med isbiter.' || char(10) || '2. Tilsett hylleblomstsaft.' || char(10) || '3. Hell over prosecco.' || char(10) || '4. Fyll opp med et skvett sodavann.' || char(10) || '5. Rør forsiktig og pynt med fersk mynte og limeskive.',
  0
);
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT last_insert_rowid(), id, '10', 'cl' FROM ingredients WHERE name='Prosecco';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Hugo Spritz'), id, '4', 'cl' FROM ingredients WHERE name='Hylleblomstsaft';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Hugo Spritz'), id, '3', 'cl' FROM ingredients WHERE name='Sodavann';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Hugo Spritz'), id, '4', 'blader' FROM ingredients WHERE name='Fersk mynte';

-- 20. Singapore Sling (category_id=1, alcoholic=1)
INSERT INTO drinks (name, description, image, category_id, alcoholic, glass_type, garnish, instructions, is_user_created)
VALUES (
  'Singapore Sling',
  'Eksotisk og fargerik signaturdrink fra Raffles Hotel i Singapore. Fruktig og festlig.',
  'https://www.thecocktaildb.com/images/media/drink/2ck7of1606771765.jpg',
  1, 1,
  'Hurricane-glass',
  'Ananasbit og kirsebær',
  '1. Fyll en shaker med is.' || char(10) || '2. Tilsett gin, kirsebærlikør, Cointreau, Benedictine, ananasjuice, limejuice og grenadine.' || char(10) || '3. Rist godt.' || char(10) || '4. Sil over i glass med is.' || char(10) || '5. Pynt med ananasbit og kirsebær.',
  0
);
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT last_insert_rowid(), id, '4', 'cl' FROM ingredients WHERE name='Gin';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Singapore Sling'), id, '2', 'cl' FROM ingredients WHERE name='Kirsebærlikør';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Singapore Sling'), id, '0.75', 'cl' FROM ingredients WHERE name='Cointreau';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Singapore Sling'), id, '12', 'cl' FROM ingredients WHERE name='Ananasjuice';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Singapore Sling'), id, '1.5', 'cl' FROM ingredients WHERE name='Limejuice';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Singapore Sling'), id, '1', 'cl' FROM ingredients WHERE name='Grenadine';

-- 21. Jordbær Daiquiri (category_id=1, alcoholic=1)
INSERT INTO drinks (name, description, image, category_id, alcoholic, glass_type, garnish, instructions, is_user_created)
VALUES (
  'Jordbær Daiquiri',
  'Fruktfull og frisk variant av klassisk daiquiri. Rom og ferske jordbær blandet til en vakker rosa drink.',
  'https://www.thecocktaildb.com/images/media/drink/fqfuty1469881395.jpg',
  1, 1,
  'Cocktailglass',
  'Jordbær på kanten',
  '1. Ha rom, jordbær, limejuice og sukkersirup i en blender.' || char(10) || '2. Tilsett en kopp knust is.' || char(10) || '3. Bland til glatt og kremaktig.' || char(10) || '4. Hell over i glass.' || char(10) || '5. Pynt med et jordbær på kanten.',
  0
);
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT last_insert_rowid(), id, '5', 'cl' FROM ingredients WHERE name='Hvit rom';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Jordbær Daiquiri'), id, '6', 'stk' FROM ingredients WHERE name='Ferske jordbær';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Jordbær Daiquiri'), id, '2', 'cl' FROM ingredients WHERE name='Limejuice';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Jordbær Daiquiri'), id, '2', 'cl' FROM ingredients WHERE name='Sukkersirup';

-- 22. B-52 (category_id=3, alcoholic=1)
INSERT INTO drinks (name, description, image, category_id, alcoholic, glass_type, garnish, instructions, is_user_created)
VALUES (
  'B-52',
  'Imponerende trelags skudd med kaffe, irsk krem og appelsinlikør. Server lagvis — ikke rør!',
  'https://www.thecocktaildb.com/images/media/drink/touyuv1483475555.jpg',
  3, 1,
  'Shotglass',
  '',
  '1. Hell Kahlúa forsiktig i bunnen av shotglasset.' || char(10) || '2. Legg en teskje baklengs mot innsiden av glasset og hell Baileys sakte over for å lage et nytt lag.' || char(10) || '3. Gjør det samme med Grand Marnier øverst.' || char(10) || '4. Server med en fyrstikk for å tenne på toppen — valgfritt!',
  0
);
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT last_insert_rowid(), id, '1.5', 'cl' FROM ingredients WHERE name='Kahlúa';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='B-52'), id, '1.5', 'cl' FROM ingredients WHERE name='Baileys';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='B-52'), id, '1.5', 'cl' FROM ingredients WHERE name='Grand Marnier';

-- 23. Tequila Shot (category_id=3, alcoholic=1)
INSERT INTO drinks (name, description, image, category_id, alcoholic, glass_type, garnish, instructions, is_user_created)
VALUES (
  'Tequila Shot',
  'Den klassiske måten å drikke tequila på — salt, shot og lime. Enkel og effektiv.',
  'https://www.thecocktaildb.com/images/media/drink/3mss4a1606771260.jpg',
  3, 1,
  'Shotglass',
  'Limebåt og salt',
  '1. Slipp litt salt på håndryggen mellom tommel og pekefinger.' || char(10) || '2. Hold limebåten klar.' || char(10) || '3. Slikk saltet, drikk tequila-shoten, bit i limen.',
  0
);
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT last_insert_rowid(), id, '4', 'cl' FROM ingredients WHERE name='Tequila';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Tequila Shot'), id, '1', 'klype' FROM ingredients WHERE name='Salt';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Tequila Shot'), id, '1', 'båt' FROM ingredients WHERE name='Limejuice';

-- 24. Virgin Mojito (category_id=2, alcoholic=0)
INSERT INTO drinks (name, description, image, category_id, alcoholic, glass_type, garnish, instructions, is_user_created)
VALUES (
  'Virgin Mojito',
  'Alle mojito-smakene uten alkohol. Like forfriskende og full av mynte og lime.',
  'https://www.thecocktaildb.com/images/media/drink/xvqvqq1441245317.jpg',
  2, 0,
  'Highball-glass',
  'Myntekvast og limeskive',
  '1. Legg limebåter og sukker i glasset og knus dem lett.' || char(10) || '2. Tilsett fersk mynte og knus den forsiktig.' || char(10) || '3. Fyll glasset med knust is.' || char(10) || '4. Hell over limejuice og fyll opp med sodavann.' || char(10) || '5. Rør og pynt med myntekvast.',
  0
);
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT last_insert_rowid(), id, '4', 'cl' FROM ingredients WHERE name='Limejuice';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Virgin Mojito'), id, '2', 'ts' FROM ingredients WHERE name='Sukker';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Virgin Mojito'), id, '10', 'blader' FROM ingredients WHERE name='Fersk mynte';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Virgin Mojito'), id, '20', 'cl' FROM ingredients WHERE name='Sodavann';

-- 25. Shirley Temple (category_id=2, alcoholic=0)
INSERT INTO drinks (name, description, image, category_id, alcoholic, glass_type, garnish, instructions, is_user_created)
VALUES (
  'Shirley Temple',
  'Søt og festlig alkoholfri brusdrink oppkalt etter barnestjernen Shirley Temple. Populær blant alle aldre.',
  'https://www.thecocktaildb.com/images/media/drink/fp1uu91515792973.jpg',
  2, 0,
  'Highball-glass',
  'Kirsebær og appelsinskive',
  '1. Fyll et glass med isbiter.' || char(10) || '2. Hell over ginger ale.' || char(10) || '3. Tilsett appelsinjuice.' || char(10) || '4. Drypp grenadine forsiktig ned slik at det synker til bunnen.' || char(10) || '5. Pynt med kirsebær og appelsinskive.',
  0
);
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT last_insert_rowid(), id, '20', 'cl' FROM ingredients WHERE name='Ginger ale';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Shirley Temple'), id, '2', 'cl' FROM ingredients WHERE name='Grenadine';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Shirley Temple'), id, '5', 'cl' FROM ingredients WHERE name='Appelsinjuice';

-- 26. Alkoholfri Aperol Spritz (category_id=2, alcoholic=0)
INSERT INTO drinks (name, description, image, category_id, alcoholic, glass_type, garnish, instructions, is_user_created)
VALUES (
  'Alkoholfri Aperol Spritz',
  'Den populære spritze-smaken uten alkohol. Frisk, fruktig og like flott å se på.',
  'https://www.thecocktaildb.com/images/media/drink/ikg2ax1504372491.jpg',
  2, 0,
  'Vinglass',
  'Appelsinskive og mynte',
  '1. Fyll et stort vinglass med isbiter.' || char(10) || '2. Tilsett alkoholfri aperitiff (f.eks. Lyre''s Italian Orange).' || char(10) || '3. Fyll opp med alkoholfri musserende vin eller sodavann.' || char(10) || '4. Rør forsiktig og pynt med appelsinskive.',
  0
);
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT last_insert_rowid(), id, '6', 'cl' FROM ingredients WHERE name='Alkoholfri aperitiff';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Alkoholfri Aperol Spritz'), id, '12', 'cl' FROM ingredients WHERE name='Alkoholfri musserende vin';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Alkoholfri Aperol Spritz'), id, '3', 'cl' FROM ingredients WHERE name='Sodavann';

-- 27. Jordbær Banan Smoothie (category_id=6, alcoholic=0)
INSERT INTO drinks (name, description, image, category_id, alcoholic, glass_type, garnish, instructions, is_user_created)
VALUES (
  'Jordbær Banan Smoothie',
  'Sunn, kremaktig og deilig smoothie. Perfekt til frokost eller som en rask snack.',
  'https://images.unsplash.com/photo-1553530666-dbf51e00f8a6?auto=format&fit=crop&w=800&q=80',
  6, 0,
  'Smoothieglass',
  'Jordbær på kanten',
  '1. Ha alle ingredienser i en blender.' || char(10) || '2. Bland på høy hastighet til glatt og kremaktig.' || char(10) || '3. Smak til og tilsett mer honning om ønskelig.' || char(10) || '4. Hell over i glass og server umiddelbart.',
  0
);
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT last_insert_rowid(), id, '150', 'g' FROM ingredients WHERE name='Jordbær';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Jordbær Banan Smoothie'), id, '1', 'stk' FROM ingredients WHERE name='Banan';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Jordbær Banan Smoothie'), id, '100', 'g' FROM ingredients WHERE name='Gresk yoghurt';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Jordbær Banan Smoothie'), id, '1', 'ss' FROM ingredients WHERE name='Honning';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Jordbær Banan Smoothie'), id, '10', 'cl' FROM ingredients WHERE name='Melk';

-- 28. Grønn Detox Smoothie (category_id=6, alcoholic=0)
INSERT INTO drinks (name, description, image, category_id, alcoholic, glass_type, garnish, instructions, is_user_created)
VALUES (
  'Grønn Detox Smoothie',
  'Energigivende grønn smoothie med spinat, eple og ingefær. Frisk og full av næringsstoffer.',
  'https://images.unsplash.com/photo-1610970881699-44a5587cabec?auto=format&fit=crop&w=800&q=80',
  6, 0,
  'Smoothieglass',
  'Agurk og mynteskive',
  '1. Ha spinat, eple og agurk i blender med halvparten av vannet.' || char(10) || '2. Bland til glatt.' || char(10) || '3. Tilsett resten av ingrediensene og blend igjen.' || char(10) || '4. Server med is og pynt med agurk og mynte.',
  0
);
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT last_insert_rowid(), id, '50', 'g' FROM ingredients WHERE name='Spinat';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Grønn Detox Smoothie'), id, '1', 'stk' FROM ingredients WHERE name='Eple';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Grønn Detox Smoothie'), id, '0.5', 'stk' FROM ingredients WHERE name='Agurk';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Grønn Detox Smoothie'), id, '1', 'cm' FROM ingredients WHERE name='Frisk ingefær';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Grønn Detox Smoothie'), id, '2', 'cl' FROM ingredients WHERE name='Sitronsaft';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Grønn Detox Smoothie'), id, '20', 'cl' FROM ingredients WHERE name='Vann';

-- 29. French 75 (category_id=1, alcoholic=1)
INSERT INTO drinks (name, description, image, category_id, alcoholic, glass_type, garnish, instructions, is_user_created)
VALUES (
  'French 75',
  'Elegant og festlig — gin møter champagne med sitrus. Oppkalt etter en fransk kanon fra 1. verdenskrig.',
  'https://www.thecocktaildb.com/images/media/drink/3tsm501587659720.jpg',
  1, 1,
  'Champagneglass',
  'Sitronskall',
  '1. Fyll en shaker med is.' || char(10) || '2. Tilsett gin, sitronsaft og sukkersirup.' || char(10) || '3. Rist godt i 15 sekunder.' || char(10) || '4. Sil over i et avkjølt champagneglass.' || char(10) || '5. Fyll forsiktig opp med champagne eller prosecco.' || char(10) || '6. Pynt med sitronskall.',
  0
);
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT last_insert_rowid(), id, '4', 'cl' FROM ingredients WHERE name='Gin';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='French 75'), id, '2', 'cl' FROM ingredients WHERE name='Sitronsaft';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='French 75'), id, '1', 'cl' FROM ingredients WHERE name='Sukkersirup';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='French 75'), id, '10', 'cl' FROM ingredients WHERE name='Champagne';

-- 30. Tom Collins (category_id=4, alcoholic=1)
INSERT INTO drinks (name, description, image, category_id, alcoholic, glass_type, garnish, instructions, is_user_created)
VALUES (
  'Tom Collins',
  'Klassisk og forfriskende longdrink med gin, sitron og sodavann. En favoritt siden 1800-tallet.',
  'https://www.thecocktaildb.com/images/media/drink/hbkfzu1574797234.jpg',
  4, 1,
  'Collins-glass',
  'Sitronskive og kirsebær',
  '1. Fyll et Collins-glass med isbiter.' || char(10) || '2. Tilsett gin, sitronsaft og sukkersirup.' || char(10) || '3. Rør lett.' || char(10) || '4. Fyll opp med sodavann.' || char(10) || '5. Pynt med sitronskive og kirsebær.',
  0
);
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT last_insert_rowid(), id, '5', 'cl' FROM ingredients WHERE name='Gin';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Tom Collins'), id, '3', 'cl' FROM ingredients WHERE name='Sitronsaft';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Tom Collins'), id, '1.5', 'cl' FROM ingredients WHERE name='Sukkersirup';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Tom Collins'), id, '10', 'cl' FROM ingredients WHERE name='Sodavann';

-- 31. Gimlet (category_id=1, alcoholic=1)
INSERT INTO drinks (name, description, image, category_id, alcoholic, glass_type, garnish, instructions, is_user_created)
VALUES (
  'Gimlet',
  'Enkel og smakfull gin-cocktail med limekordial. Skarp, søt og tidløs.',
  'https://www.thecocktaildb.com/images/media/drink/e8ytqp1504338726.jpg',
  1, 1,
  'Cocktailglass',
  'Limeskive',
  '1. Fyll en shaker med is.' || char(10) || '2. Tilsett gin og limekordial.' || char(10) || '3. Rist godt i 15 sekunder.' || char(10) || '4. Sil over i avkjølt cocktailglass.' || char(10) || '5. Pynt med limeskive.',
  0
);
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT last_insert_rowid(), id, '6', 'cl' FROM ingredients WHERE name='Gin';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Gimlet'), id, '2', 'cl' FROM ingredients WHERE name='Limekordial';

-- 32. Bee's Knees (category_id=1, alcoholic=1)
INSERT INTO drinks (name, description, image, category_id, alcoholic, glass_type, garnish, instructions, is_user_created)
VALUES (
  'Bee''s Knees',
  'Forbudstidens elegante gin-cocktail. Honning erstatter sukker og gir en rund, blomstrende sødme.',
  'https://www.thecocktaildb.com/images/media/drink/j6ywwu1504367908.jpg',
  1, 1,
  'Cocktailglass',
  'Sitronskall',
  '1. Rør honning og sitronsaft sammen til honningen er oppløst.' || char(10) || '2. Fyll en shaker med is.' || char(10) || '3. Tilsett gin og honning-sitronsaft-blandingen.' || char(10) || '4. Rist godt.' || char(10) || '5. Sil over i avkjølt cocktailglass.',
  0
);
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT last_insert_rowid(), id, '6', 'cl' FROM ingredients WHERE name='Gin';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Bee''s Knees'), id, '2', 'cl' FROM ingredients WHERE name='Sitronsaft';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Bee''s Knees'), id, '2', 'cl' FROM ingredients WHERE name='Honning';

-- 33. Clover Club (category_id=1, alcoholic=1)
INSERT INTO drinks (name, description, image, category_id, alcoholic, glass_type, garnish, instructions, is_user_created)
VALUES (
  'Clover Club',
  'Vakkert rosa gin-cocktail med bringebær og eggehvite. Silkemyk og fruktig — en pre-forbudstidens klassiker.',
  'https://www.thecocktaildb.com/images/media/drink/aptjup1504370835.jpg',
  1, 1,
  'Cocktailglass',
  'Ferske bringebær',
  '1. Ha alle ingredienser i shaker UTEN is og rist (dry shake) i 10 sek.' || char(10) || '2. Tilsett is og rist igjen kraftig.' || char(10) || '3. Sil over i avkjølt cocktailglass.' || char(10) || '4. Pynt med ferske bringebær.',
  0
);
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT last_insert_rowid(), id, '5', 'cl' FROM ingredients WHERE name='Gin';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Clover Club'), id, '2', 'cl' FROM ingredients WHERE name='Sitronsaft';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Clover Club'), id, '2', 'cl' FROM ingredients WHERE name='Bringebærsirup';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Clover Club'), id, '1', 'stk' FROM ingredients WHERE name='Eggehvite';

-- 34. White Lady (category_id=1, alcoholic=1)
INSERT INTO drinks (name, description, image, category_id, alcoholic, glass_type, garnish, instructions, is_user_created)
VALUES (
  'White Lady',
  'Ren og elegant gin Sidecar-variant. Gin, Cointreau og sitron i perfekt balanse.',
  'https://www.thecocktaildb.com/images/media/drink/vm5p1l1504500045.jpg',
  1, 1,
  'Cocktailglass',
  'Sitronskall',
  '1. Fyll en shaker med is.' || char(10) || '2. Tilsett gin, Cointreau og sitronsaft.' || char(10) || '3. Rist godt.' || char(10) || '4. Sil over i avkjølt cocktailglass.' || char(10) || '5. Pynt med sitronskall.',
  0
);
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT last_insert_rowid(), id, '4', 'cl' FROM ingredients WHERE name='Gin';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='White Lady'), id, '2', 'cl' FROM ingredients WHERE name='Cointreau';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='White Lady'), id, '2', 'cl' FROM ingredients WHERE name='Sitronsaft';

-- 35. Sidecar (category_id=1, alcoholic=1)
INSERT INTO drinks (name, description, image, category_id, alcoholic, glass_type, garnish, instructions, is_user_created)
VALUES (
  'Sidecar',
  'Cognac-klassiker fra Paris på 1920-tallet. Tørr, syrlig og sofistikert med sukkerkant.',
  'https://www.thecocktaildb.com/images/media/drink/louvg31582476556.jpg',
  1, 1,
  'Cocktailglass',
  'Sukkerkant og appelsinskall',
  '1. Fukt kanten av glasset og dypp i sukker.' || char(10) || '2. Fyll shaker med is.' || char(10) || '3. Tilsett cognac, Cointreau og sitronsaft.' || char(10) || '4. Rist godt.' || char(10) || '5. Sil over i glasset.' || char(10) || '6. Pynt med appelsinskall.',
  0
);
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT last_insert_rowid(), id, '5', 'cl' FROM ingredients WHERE name='Cognac';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Sidecar'), id, '2', 'cl' FROM ingredients WHERE name='Cointreau';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Sidecar'), id, '2', 'cl' FROM ingredients WHERE name='Sitronsaft';

-- 36. Brandy Alexander (category_id=1, alcoholic=1)
INSERT INTO drinks (name, description, image, category_id, alcoholic, glass_type, garnish, instructions, is_user_created)
VALUES (
  'Brandy Alexander',
  'Luksuriøs og kremet dessertdrink med cognac, kakaol ikør og fløte. Sjokolademyk og uimotståelig.',
  'https://www.thecocktaildb.com/images/media/drink/oj3the1606770258.jpg',
  1, 1,
  'Cocktailglass',
  'Revet muskatnøtt',
  '1. Fyll en shaker med is.' || char(10) || '2. Tilsett cognac, mørk kakaol ikør og kremfløte.' || char(10) || '3. Rist godt.' || char(10) || '4. Sil over i avkjølt cocktailglass.' || char(10) || '5. Dryss revet muskatnøtt på toppen.',
  0
);
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT last_insert_rowid(), id, '4', 'cl' FROM ingredients WHERE name='Cognac';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Brandy Alexander'), id, '2', 'cl' FROM ingredients WHERE name='Mørk kakaol ikør';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Brandy Alexander'), id, '2', 'cl' FROM ingredients WHERE name='Kremfløte';

-- 37. Mint Julep (category_id=1, alcoholic=1)
INSERT INTO drinks (name, description, image, category_id, alcoholic, glass_type, garnish, instructions, is_user_created)
VALUES (
  'Mint Julep',
  'Kentucky Derbys offisielle cocktail. Bourbon, fersk mynte og knust is — sommer i et sølvbeger.',
  'https://www.thecocktaildb.com/images/media/drink/llbwop1560862781.jpg',
  1, 1,
  'Sølvbeger eller rocks-glass',
  'Stor myntekvast',
  '1. Ha mynteblader og sukkersirup i bunnen av glasset.' || char(10) || '2. Knus mynte forsiktig med pestel — ikke overstimulér den.' || char(10) || '3. Fyll glasset med knust is.' || char(10) || '4. Hell over bourbon og rør godt.' || char(10) || '5. Pynt med en stor myntekvast.' || char(10) || '6. Dryss litt melis på mynte om ønskelig.',
  0
);
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT last_insert_rowid(), id, '6', 'cl' FROM ingredients WHERE name='Bourbon whiskey';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Mint Julep'), id, '1.5', 'cl' FROM ingredients WHERE name='Sukkersirup';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Mint Julep'), id, '8', 'blader' FROM ingredients WHERE name='Fersk mynte';

-- 38. Paper Plane (category_id=1, alcoholic=1)
INSERT INTO drinks (name, description, image, category_id, alcoholic, glass_type, garnish, instructions, is_user_created)
VALUES (
  'Paper Plane',
  'Moderne klassiker fra 2008 med fire like deler — bourbon, Aperol, Amaro og sitron. Perfekt balansert.',
  'https://www.thecocktaildb.com/images/media/drink/xbqg461504372761.jpg',
  1, 1,
  'Cocktailglass',
  'Sitronskall',
  '1. Fyll en shaker med is.' || char(10) || '2. Tilsett like deler bourbon, Aperol, Amaro Nonino og sitronsaft.' || char(10) || '3. Rist godt i 15 sekunder.' || char(10) || '4. Sil over i avkjølt cocktailglass.',
  0
);
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT last_insert_rowid(), id, '2.25', 'cl' FROM ingredients WHERE name='Bourbon whiskey';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Paper Plane'), id, '2.25', 'cl' FROM ingredients WHERE name='Aperol';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Paper Plane'), id, '2.25', 'cl' FROM ingredients WHERE name='Amaro Nonino';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Paper Plane'), id, '2.25', 'cl' FROM ingredients WHERE name='Sitronsaft';

-- 39. Rob Roy (category_id=1, alcoholic=1)
INSERT INTO drinks (name, description, image, category_id, alcoholic, glass_type, garnish, instructions, is_user_created)
VALUES (
  'Rob Roy',
  'Skotsk variant av Manhattan — Scotch whisky i stedet for rye. Røykfull, rik og raffinert.',
  'https://www.thecocktaildb.com/images/media/drink/yk70e31606771240.jpg',
  1, 1,
  'Cocktailglass',
  'Maraschino-kirsebær',
  '1. Fyll et røreglass med isbiter.' || char(10) || '2. Tilsett Scotch whisky, søt vermouth og angostura bitters.' || char(10) || '3. Rør i 30 sekunder til godt avkjølt.' || char(10) || '4. Sil over i avkjølt cocktailglass.' || char(10) || '5. Pynt med maraschino-kirsebær.',
  0
);
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT last_insert_rowid(), id, '6', 'cl' FROM ingredients WHERE name='Scotch whisky';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Rob Roy'), id, '3', 'cl' FROM ingredients WHERE name='Søt vermouth';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Rob Roy'), id, '2', 'dråper' FROM ingredients WHERE name='Angostura bitters';

-- 40. Rusty Nail (category_id=1, alcoholic=1)
INSERT INTO drinks (name, description, image, category_id, alcoholic, glass_type, garnish, instructions, is_user_created)
VALUES (
  'Rusty Nail',
  'Enkel skotsk klassiker med Drambuie — honninglikør basert på whisky og urter. Varm og inntil.',
  'https://www.thecocktaildb.com/images/media/drink/tusezp1582475771.jpg',
  1, 1,
  'Rocks-glass',
  'Sitronskall',
  '1. Fyll et rocks-glass med en stor isklump.' || char(10) || '2. Hell over Scotch whisky.' || char(10) || '3. Tilsett Drambuie.' || char(10) || '4. Rør forsiktig.' || char(10) || '5. Pynt med sitronskall.',
  0
);
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT last_insert_rowid(), id, '5', 'cl' FROM ingredients WHERE name='Scotch whisky';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Rusty Nail'), id, '2', 'cl' FROM ingredients WHERE name='Drambuie';

-- 41. Amaretto Sour (category_id=1, alcoholic=1)
INSERT INTO drinks (name, description, image, category_id, alcoholic, glass_type, garnish, instructions, is_user_created)
VALUES (
  'Amaretto Sour',
  'Søt og syrlig med mandel-aroma fra amaretto. Eggehvite gir det kremete skumet på toppen.',
  'https://www.thecocktaildb.com/images/media/drink/yyzs2i1504366743.jpg',
  1, 1,
  'Rocks-glass',
  'Kirsebær og appelsinskive',
  '1. Ha alle ingredienser i shaker uten is og rist (dry shake) i 10 sek.' || char(10) || '2. Tilsett is og rist igjen kraftig.' || char(10) || '3. Sil over i glass med is.' || char(10) || '4. Pynt med kirsebær og appelsinskive.',
  0
);
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT last_insert_rowid(), id, '5', 'cl' FROM ingredients WHERE name='Amaretto';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Amaretto Sour'), id, '3', 'cl' FROM ingredients WHERE name='Sitronsaft';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Amaretto Sour'), id, '1', 'cl' FROM ingredients WHERE name='Sukkersirup';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Amaretto Sour'), id, '1', 'stk' FROM ingredients WHERE name='Eggehvite';

-- 42. Mai Tai (category_id=1, alcoholic=1)
INSERT INTO drinks (name, description, image, category_id, alcoholic, glass_type, garnish, instructions, is_user_created)
VALUES (
  'Mai Tai',
  'Tropisk tiki-klassiker fra 1944 med aged rom, lime og mandelsirup. Transporterer deg rett til Polynesia.',
  'https://www.thecocktaildb.com/images/media/drink/quyUts1587558534.jpg',
  1, 1,
  'Rocks-glass eller tiki-glass',
  'Myntekvast, limeskive og kirsebær',
  '1. Fyll en shaker med knust is.' || char(10) || '2. Tilsett rom, appelsinlikør, limejuice og mandelsirup.' || char(10) || '3. Rist godt.' || char(10) || '4. Hell med isen over i tiki-glass.' || char(10) || '5. Pynt med myntekvast, limeskive og kirsebær.',
  0
);
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT last_insert_rowid(), id, '4', 'cl' FROM ingredients WHERE name='Aged rom';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Mai Tai'), id, '2', 'cl' FROM ingredients WHERE name='Mørk rom';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Mai Tai'), id, '2', 'cl' FROM ingredients WHERE name='Appelsinlikør';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Mai Tai'), id, '2', 'cl' FROM ingredients WHERE name='Limejuice';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Mai Tai'), id, '1.5', 'cl' FROM ingredients WHERE name='Mandelsirup (orgeat)';

-- 43. Painkiller (category_id=1, alcoholic=1)
INSERT INTO drinks (name, description, image, category_id, alcoholic, glass_type, garnish, instructions, is_user_created)
VALUES (
  'Painkiller',
  'Kremaktig tropisk rom-drink fra British Virgin Islands. Kokos og ananas med en smule muskatnøtt på toppen.',
  'https://www.thecocktaildb.com/images/media/drink/uqxqjs1504348237.jpg',
  1, 1,
  'Rocks-glass',
  'Revet muskatnøtt og ananasbit',
  '1. Fyll en shaker med is.' || char(10) || '2. Tilsett rom, ananasjuice, appelsinjuice og kokoskrem.' || char(10) || '3. Rist godt.' || char(10) || '4. Hell over knust is i glass.' || char(10) || '5. Dryss revet muskatnøtt på toppen og pynt med ananasbit.',
  0
);
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT last_insert_rowid(), id, '6', 'cl' FROM ingredients WHERE name='Mørk rom';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Painkiller'), id, '12', 'cl' FROM ingredients WHERE name='Ananasjuice';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Painkiller'), id, '3', 'cl' FROM ingredients WHERE name='Appelsinjuice';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Painkiller'), id, '3', 'cl' FROM ingredients WHERE name='Kokoskrem';

-- 44. Hemingway Daiquiri (category_id=1, alcoholic=1)
INSERT INTO drinks (name, description, image, category_id, alcoholic, glass_type, garnish, instructions, is_user_created)
VALUES (
  'Hemingway Daiquiri',
  'Ernest Hemingways favorittdrink — tørr og syrlig daiquiri med grapefrukt og maraschino. Dobbel porsjon, halfparten sukker.',
  'https://www.thecocktaildb.com/images/media/drink/mrz9091589574515.jpg',
  1, 1,
  'Cocktailglass',
  'Limeskive',
  '1. Fyll en shaker med is.' || char(10) || '2. Tilsett rom, grapefruktjuice, limejuice og maraschino-likør.' || char(10) || '3. Rist kraftig i 15 sekunder.' || char(10) || '4. Sil over i avkjølt cocktailglass.' || char(10) || '5. Pynt med limeskive.',
  0
);
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT last_insert_rowid(), id, '6', 'cl' FROM ingredients WHERE name='Hvit rom';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Hemingway Daiquiri'), id, '4', 'cl' FROM ingredients WHERE name='Grapefruktjuice';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Hemingway Daiquiri'), id, '1.5', 'cl' FROM ingredients WHERE name='Limejuice';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Hemingway Daiquiri'), id, '1.5', 'cl' FROM ingredients WHERE name='Maraschino-likør';

-- 45. Jungle Bird (category_id=1, alcoholic=1)
INSERT INTO drinks (name, description, image, category_id, alcoholic, glass_type, garnish, instructions, is_user_created)
VALUES (
  'Jungle Bird',
  'Uventet kombinasjon av mørk rom og Campari med ananas — bittert, søtt og tropisk på én gang.',
  'https://www.thecocktaildb.com/images/media/drink/rt5huu1606769556.jpg',
  1, 1,
  'Rocks-glass',
  'Ananasbit og kirsebær',
  '1. Fyll en shaker med is.' || char(10) || '2. Tilsett mørk rom, Campari, ananasjuice, limejuice og sukkersirup.' || char(10) || '3. Rist godt.' || char(10) || '4. Sil over i glass med is.' || char(10) || '5. Pynt med ananasbit.',
  0
);
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT last_insert_rowid(), id, '4.5', 'cl' FROM ingredients WHERE name='Mørk rom';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Jungle Bird'), id, '2', 'cl' FROM ingredients WHERE name='Campari';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Jungle Bird'), id, '4.5', 'cl' FROM ingredients WHERE name='Ananasjuice';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Jungle Bird'), id, '1.5', 'cl' FROM ingredients WHERE name='Limejuice';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Jungle Bird'), id, '1', 'cl' FROM ingredients WHERE name='Sukkersirup';

-- 46. Pornstar Martini (category_id=1, alcoholic=1)
INSERT INTO drinks (name, description, image, category_id, alcoholic, glass_type, garnish, instructions, is_user_created)
VALUES (
  'Pornstar Martini',
  'Britisk bartender-hit fra 2002. Pasjonsfrukt og vanilje møter vodka — server med liten prosecco-shot på siden.',
  'https://www.thecocktaildb.com/images/media/drink/b6czzn1504366899.jpg',
  1, 1,
  'Cocktailglass',
  'Halvt pasjonsfrukt og prosecco-shot',
  '1. Fyll en shaker med is.' || char(10) || '2. Tilsett vodka, passoa, pasjonsfruktpuré og vaniljesukkersirup.' || char(10) || '3. Rist kraftig.' || char(10) || '4. Sil over i avkjølt cocktailglass.' || char(10) || '5. Legg halvt pasjonsfrukt på toppen.' || char(10) || '6. Server med et shot-glass prosecco på siden.',
  0
);
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT last_insert_rowid(), id, '5', 'cl' FROM ingredients WHERE name='Vodka';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Pornstar Martini'), id, '2', 'cl' FROM ingredients WHERE name='Passoa';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Pornstar Martini'), id, '3', 'cl' FROM ingredients WHERE name='Pasjonsfruktpuré';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Pornstar Martini'), id, '1', 'cl' FROM ingredients WHERE name='Vaniljesukkersirup';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Pornstar Martini'), id, '5', 'cl' FROM ingredients WHERE name='Prosecco';

-- 47. Black Russian (category_id=1, alcoholic=1)
INSERT INTO drinks (name, description, image, category_id, alcoholic, glass_type, garnish, instructions, is_user_created)
VALUES (
  'Black Russian',
  'Enkel og kraftig — vodka og kaffe-likør over is. Klassikeren fra 1949.',
  'https://www.thecocktaildb.com/images/media/drink/p7uucu1472720107.jpg',
  1, 1,
  'Rocks-glass',
  '',
  '1. Fyll et rocks-glass med isbiter.' || char(10) || '2. Hell over vodka.' || char(10) || '3. Tilsett Kahlúa og rør forsiktig.',
  0
);
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT last_insert_rowid(), id, '5', 'cl' FROM ingredients WHERE name='Vodka';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Black Russian'), id, '2', 'cl' FROM ingredients WHERE name='Kahlúa';

-- 48. White Russian (category_id=1, alcoholic=1)
INSERT INTO drinks (name, description, image, category_id, alcoholic, glass_type, garnish, instructions, is_user_created)
VALUES (
  'White Russian',
  'The Dudes drink! Black Russian med kremfløte på toppen — myk, rik og uimotståelig god.',
  'https://www.thecocktaildb.com/images/media/drink/esme2u1582475856.jpg',
  1, 1,
  'Rocks-glass',
  '',
  '1. Fyll et rocks-glass med isbiter.' || char(10) || '2. Hell over vodka og Kahlúa.' || char(10) || '3. Rør forsiktig.' || char(10) || '4. Hell kremfløten sakte over en skje slik at den flyter på toppen.',
  0
);
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT last_insert_rowid(), id, '5', 'cl' FROM ingredients WHERE name='Vodka';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='White Russian'), id, '2', 'cl' FROM ingredients WHERE name='Kahlúa';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='White Russian'), id, '3', 'cl' FROM ingredients WHERE name='Kremfløte';

-- 49. Lemon Drop (category_id=1, alcoholic=1)
INSERT INTO drinks (name, description, image, category_id, alcoholic, glass_type, garnish, instructions, is_user_created)
VALUES (
  'Lemon Drop',
  'Syrlig og frisk vodka-shot/cocktail med sukkerkant. Enkelt, friskt og alltid populært.',
  'https://www.thecocktaildb.com/images/media/drink/slaog81504366699.jpg',
  1, 1,
  'Cocktailglass',
  'Sukkerkant og sitronskive',
  '1. Fukt kanten av glasset og dypp i sukker.' || char(10) || '2. Fyll en shaker med is.' || char(10) || '3. Tilsett vodka, triple sec og sitronsaft.' || char(10) || '4. Rist godt.' || char(10) || '5. Sil over i glasset.',
  0
);
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT last_insert_rowid(), id, '5', 'cl' FROM ingredients WHERE name='Vodka';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Lemon Drop'), id, '2', 'cl' FROM ingredients WHERE name='Triple sec';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Lemon Drop'), id, '2.5', 'cl' FROM ingredients WHERE name='Sitronsaft';

-- 50. French Martini (category_id=1, alcoholic=1)
INSERT INTO drinks (name, description, image, category_id, alcoholic, glass_type, garnish, instructions, is_user_created)
VALUES (
  'French Martini',
  'Fruktfull og elegant vodka-martini med Chambord bringebærlikør og ananas. Vakker rosa farge.',
  'https://www.thecocktaildb.com/images/media/drink/6looc01504349547.jpg',
  1, 1,
  'Cocktailglass',
  'Bringebær',
  '1. Fyll en shaker med is.' || char(10) || '2. Tilsett vodka, Chambord og ananasjuice.' || char(10) || '3. Rist kraftig i 15 sekunder.' || char(10) || '4. Sil over i avkjølt cocktailglass.' || char(10) || '5. Pynt med ferske bringebær.',
  0
);
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT last_insert_rowid(), id, '5', 'cl' FROM ingredients WHERE name='Vodka';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='French Martini'), id, '1.5', 'cl' FROM ingredients WHERE name='Chambord';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='French Martini'), id, '4', 'cl' FROM ingredients WHERE name='Ananasjuice';

-- 51. Screwdriver (category_id=4, alcoholic=1)
INSERT INTO drinks (name, description, image, category_id, alcoholic, glass_type, garnish, instructions, is_user_created)
VALUES (
  'Screwdriver',
  'Det kan ikke bli enklere — vodka og appelsinjuice. Sagt å ha blitt laget av oljearbeidere som rørte med skrutrekkeren.',
  'https://www.thecocktaildb.com/images/media/drink/tqyrpw1439905311.jpg',
  4, 1,
  'Highball-glass',
  'Appelsinskive',
  '1. Fyll et glass med isbiter.' || char(10) || '2. Hell over vodka.' || char(10) || '3. Fyll opp med fersk appelsinjuice.' || char(10) || '4. Rør forsiktig og pynt med appelsinskive.',
  0
);
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT last_insert_rowid(), id, '5', 'cl' FROM ingredients WHERE name='Vodka';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Screwdriver'), id, '15', 'cl' FROM ingredients WHERE name='Appelsinjuice';

-- 52. Bellini (category_id=1, alcoholic=1)
INSERT INTO drinks (name, description, image, category_id, alcoholic, glass_type, garnish, instructions, is_user_created)
VALUES (
  'Bellini',
  'Harry''s Bar i Venezias signaturdrink siden 1948. Ferskenpuré og prosecco — frisk, fruktig og festlig.',
  'https://www.thecocktaildb.com/images/media/drink/eosoe71699705668.jpg',
  1, 1,
  'Champagneglass',
  'Ferskenbit',
  '1. Hell ferskenpuré i bunnen av et avkjølt champagneglass.' || char(10) || '2. Fyll forsiktig opp med kjølt prosecco.' || char(10) || '3. Rør én gang forsiktig.' || char(10) || '4. Pynt med en liten ferskenbit.',
  0
);
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT last_insert_rowid(), id, '5', 'cl' FROM ingredients WHERE name='Ferskenpuré';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Bellini'), id, '10', 'cl' FROM ingredients WHERE name='Prosecco';

-- 53. Kir Royale (category_id=1, alcoholic=1)
INSERT INTO drinks (name, description, image, category_id, alcoholic, glass_type, garnish, instructions, is_user_created)
VALUES (
  'Kir Royale',
  'Fransk aperitiff med champagne og crème de cassis. Elegant, enkel og alltid stilfull.',
  'https://www.thecocktaildb.com/images/media/drink/6looc01504349547.jpg',
  1, 1,
  'Champagneglass',
  'Friske rips',
  '1. Hell crème de cassis i bunnen av et champagneglass.' || char(10) || '2. Fyll forsiktig opp med kjølt champagne.' || char(10) || '3. Pynt med friske rips.',
  0
);
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT last_insert_rowid(), id, '1.5', 'cl' FROM ingredients WHERE name='Crème de cassis';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Kir Royale'), id, '12', 'cl' FROM ingredients WHERE name='Champagne';

-- 54. Tommy's Margarita (category_id=1, alcoholic=1)
INSERT INTO drinks (name, description, image, category_id, alcoholic, glass_type, garnish, instructions, is_user_created)
VALUES (
  'Tommy''s Margarita',
  'Moderne margarita-klassiker fra San Francisco som bruker agavenektar i stedet for triple sec. Renere og mer tequila-fokusert.',
  'https://www.thecocktaildb.com/images/media/drink/5noda61589575158.jpg',
  1, 1,
  'Rocks-glass',
  'Limeskive og saltkant',
  '1. Fukt kanten og dypp i salt.' || char(10) || '2. Fyll en shaker med is.' || char(10) || '3. Tilsett tequila, limejuice og agavenektar.' || char(10) || '4. Rist godt.' || char(10) || '5. Sil over i glasset med is.',
  0
);
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT last_insert_rowid(), id, '6', 'cl' FROM ingredients WHERE name='Tequila';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Tommy''s Margarita'), id, '3', 'cl' FROM ingredients WHERE name='Limejuice';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Tommy''s Margarita'), id, '2', 'cl' FROM ingredients WHERE name='Agavenektar';

-- 55. El Diablo (category_id=1, alcoholic=1)
INSERT INTO drinks (name, description, image, category_id, alcoholic, glass_type, garnish, instructions, is_user_created)
VALUES (
  'El Diablo',
  'Djevelens cocktail — tequila med solbærlikør og ingefærøl. Søtt, spicy og overraskende godt.',
  'https://www.thecocktaildb.com/images/media/drink/rt5huu1606769556.jpg',
  1, 1,
  'Highball-glass',
  'Limeskive og kirsebær',
  '1. Fyll et highball-glass med isbiter.' || char(10) || '2. Tilsett tequila og limejuice.' || char(10) || '3. Hell over crème de cassis.' || char(10) || '4. Fyll opp med ingefærøl.' || char(10) || '5. Pynt med limeskive.',
  0
);
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT last_insert_rowid(), id, '4.5', 'cl' FROM ingredients WHERE name='Tequila';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='El Diablo'), id, '1.5', 'cl' FROM ingredients WHERE name='Crème de cassis';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='El Diablo'), id, '1.5', 'cl' FROM ingredients WHERE name='Limejuice';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='El Diablo'), id, '10', 'cl' FROM ingredients WHERE name='Ingefærøl';

-- 56. Kamikaze (category_id=3, alcoholic=1)
INSERT INTO drinks (name, description, image, category_id, alcoholic, glass_type, garnish, instructions, is_user_created)
VALUES (
  'Kamikaze',
  'Klassisk shot med vodka, triple sec og lime. Raskt, friskt og kraftig.',
  'https://www.thecocktaildb.com/images/media/drink/wwpqmu1472720780.jpg',
  3, 1,
  'Shotglass',
  'Limeskive',
  '1. Fyll en shaker med is.' || char(10) || '2. Tilsett vodka, triple sec og limejuice.' || char(10) || '3. Rist godt.' || char(10) || '4. Sil over i shotglass.',
  0
);
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT last_insert_rowid(), id, '2', 'cl' FROM ingredients WHERE name='Vodka';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Kamikaze'), id, '2', 'cl' FROM ingredients WHERE name='Triple sec';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Kamikaze'), id, '2', 'cl' FROM ingredients WHERE name='Limejuice';

-- 57. Jagerbomb (category_id=3, alcoholic=1)
INSERT INTO drinks (name, description, image, category_id, alcoholic, glass_type, garnish, instructions, is_user_created)
VALUES (
  'Jagerbomb',
  'Energidrikk-klassiker på fest — Jägermeister drukket i energidrikk. Kraftig og populær.',
  'https://www.thecocktaildb.com/images/media/drink/touyuv1483475555.jpg',
  3, 1,
  'Shotglass + pint-glass',
  '',
  '1. Fyll halvparten av et pint-glass med energidrikk.' || char(10) || '2. Hell Jägermeister i et shotglass.' || char(10) || '3. Slipp shotglasset ned i pint-glasset.' || char(10) || '4. Drikk raskt!',
  0
);
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT last_insert_rowid(), id, '4', 'cl' FROM ingredients WHERE name='Jägermeister';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Jagerbomb'), id, '15', 'cl' FROM ingredients WHERE name='Energidrikk';

-- 58. Arnold Palmer (category_id=2, alcoholic=0)
INSERT INTO drinks (name, description, image, category_id, alcoholic, glass_type, garnish, instructions, is_user_created)
VALUES (
  'Arnold Palmer',
  'Halvt iskald te, halvt limonade — oppkalt etter golflegenden. Forfriskende og perfekt til sport og sommer.',
  'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=800&q=80',
  2, 0,
  'Highball-glass',
  'Sitronskive og mynteblader',
  '1. Brygg svart te og la det avkjøle seg.' || char(10) || '2. Lag enkel limonade med sitronjuice, sukkersirup og vann.' || char(10) || '3. Fyll et glass med is.' || char(10) || '4. Hell halvparten te og halvparten limonade.' || char(10) || '5. Rør og pynt med sitronskive.',
  0
);
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT last_insert_rowid(), id, '15', 'cl' FROM ingredients WHERE name='Iskald svart te';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Arnold Palmer'), id, '4', 'cl' FROM ingredients WHERE name='Sitronsaft';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Arnold Palmer'), id, '2', 'cl' FROM ingredients WHERE name='Sukkersirup';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Arnold Palmer'), id, '9', 'cl' FROM ingredients WHERE name='Vann';

-- 59. Vannmelon Limonade (category_id=2, alcoholic=0)
INSERT INTO drinks (name, description, image, category_id, alcoholic, glass_type, garnish, instructions, is_user_created)
VALUES (
  'Vannmelon Limonade',
  'Frisk og sommerlig alkoholfri drink med saftig vannmelon og sitron. Vakker rød farge.',
  'https://images.unsplash.com/photo-1523677011781-c91d1bbe2f9e?auto=format&fit=crop&w=800&q=80',
  2, 0,
  'Highball-glass',
  'Vannmelonbit og mynteblad',
  '1. Bland vannmelonbiter i en blender til glatt.' || char(10) || '2. Sil gjennom en sil for å fjerne frø og fruktkjøtt.' || char(10) || '3. Bland med sitronsaft og sukkersirup.' || char(10) || '4. Server over is og fyll opp med sodavann.' || char(10) || '5. Pynt med vannmelonbit og mynteblad.',
  0
);
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT last_insert_rowid(), id, '300', 'g' FROM ingredients WHERE name='Vannmelon';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Vannmelon Limonade'), id, '3', 'cl' FROM ingredients WHERE name='Sitronsaft';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Vannmelon Limonade'), id, '2', 'cl' FROM ingredients WHERE name='Sukkersirup';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Vannmelon Limonade'), id, '10', 'cl' FROM ingredients WHERE name='Sodavann';

-- 60. Agurk Cooler (category_id=2, alcoholic=0)
INSERT INTO drinks (name, description, image, category_id, alcoholic, glass_type, garnish, instructions, is_user_created)
VALUES (
  'Agurk Cooler',
  'Ekstremt forfriskende alkoholfri drink med agurk, mynte og lime. Spa-vann tatt til neste nivå.',
  'https://images.unsplash.com/photo-1582056479830-31e7d9de91eb?auto=format&fit=crop&w=800&q=80',
  2, 0,
  'Highball-glass',
  'Agurk-ribbon og mynteblad',
  '1. Blend agurk til puré og sil.' || char(10) || '2. Fyll et glass med knust is.' || char(10) || '3. Tilsett agurkmix, limejuice og sukkersirup.' || char(10) || '4. Fyll opp med tonic water.' || char(10) || '5. Rør lett og pynt med agurk og mynte.',
  0
);
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT last_insert_rowid(), id, '0.5', 'stk' FROM ingredients WHERE name='Agurk';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Agurk Cooler'), id, '3', 'cl' FROM ingredients WHERE name='Limejuice';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Agurk Cooler'), id, '2', 'cl' FROM ingredients WHERE name='Sukkersirup';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Agurk Cooler'), id, '15', 'cl' FROM ingredients WHERE name='Tonic water';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Agurk Cooler'), id, '5', 'blader' FROM ingredients WHERE name='Fersk mynte';

-- 61. Mango Lassi (category_id=6, alcoholic=0)
INSERT INTO drinks (name, description, image, category_id, alcoholic, glass_type, garnish, instructions, is_user_created)
VALUES (
  'Mango Lassi',
  'Indisk klassiker med mango og yoghurt. Kremet, eksotisk og utrolig tilfredsstillende.',
  'https://images.unsplash.com/photo-1527661591475-527312dd65f5?auto=format&fit=crop&w=800&q=80',
  6, 0,
  'Smoothieglass',
  'Mangobit og litt kardemomme',
  '1. Ha mango, yoghurt, melk og honning i blender.' || char(10) || '2. Tilsett en klype kardemomme.' || char(10) || '3. Bland til glatt og kremaktig.' || char(10) || '4. Hell over glass med is.' || char(10) || '5. Dryss litt kardemomme og pynt med mangobit.',
  0
);
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT last_insert_rowid(), id, '200', 'g' FROM ingredients WHERE name='Mango';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Mango Lassi'), id, '150', 'g' FROM ingredients WHERE name='Gresk yoghurt';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Mango Lassi'), id, '10', 'cl' FROM ingredients WHERE name='Melk';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Mango Lassi'), id, '1', 'ss' FROM ingredients WHERE name='Honning';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Mango Lassi'), id, '1', 'klype' FROM ingredients WHERE name='Kardemomme';

-- 62. Blåbær Havre Smoothie (category_id=6, alcoholic=0)
INSERT INTO drinks (name, description, image, category_id, alcoholic, glass_type, garnish, instructions, is_user_created)
VALUES (
  'Blåbær Havre Smoothie',
  'Mettende og næringsrik smoothie med blåbær, havre og banan. Perfekt som frokostmåltid.',
  'https://images.unsplash.com/photo-1571748982800-fa51082c2224?auto=format&fit=crop&w=800&q=80',
  6, 0,
  'Smoothieglass',
  'Ferske blåbær og havregryn',
  '1. Ha alle ingredienser i blender.' || char(10) || '2. Bland til glatt konsistens.' || char(10) || '3. Tilsett mer melk om den er for tykk.' || char(10) || '4. Hell over i glass.' || char(10) || '5. Pynt med blåbær og litt havregryn.',
  0
);
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT last_insert_rowid(), id, '150', 'g' FROM ingredients WHERE name='Blåbær';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Blåbær Havre Smoothie'), id, '1', 'stk' FROM ingredients WHERE name='Banan';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Blåbær Havre Smoothie'), id, '3', 'ss' FROM ingredients WHERE name='Havregryn';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Blåbær Havre Smoothie'), id, '15', 'cl' FROM ingredients WHERE name='Melk';
INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit)
  SELECT (SELECT id FROM drinks WHERE name='Blåbær Havre Smoothie'), id, '1', 'ts' FROM ingredients WHERE name='Honning';

ENDSQL

echo "Database created successfully at $DB"
echo ""
echo "Verification:"
sqlite3 "$DB" "SELECT 'drinks: ' || COUNT(*) FROM drinks;"
sqlite3 "$DB" "SELECT 'ingredients: ' || COUNT(*) FROM ingredients;"
sqlite3 "$DB" "SELECT 'drink_ingredients: ' || COUNT(*) FROM drink_ingredients;"
sqlite3 "$DB" "SELECT 'categories: ' || COUNT(*) FROM categories;"
