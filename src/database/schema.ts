import * as SQLite from 'expo-sqlite';

export const SCHEMA_VERSION = 1;

// Used when the bundled DB asset is copied on fresh install — only ensures tables exist
export async function ensureSchema(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, name_en TEXT NOT NULL, icon TEXT NOT NULL DEFAULT 'wine-glass', created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS ingredients (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE COLLATE NOCASE, created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS drinks (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT DEFAULT '', image TEXT, category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL, alcoholic INTEGER DEFAULT 1, glass_type TEXT DEFAULT '', garnish TEXT DEFAULT '', instructions TEXT DEFAULT '', is_user_created INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS drink_ingredients (id INTEGER PRIMARY KEY AUTOINCREMENT, drink_id INTEGER NOT NULL REFERENCES drinks(id) ON DELETE CASCADE, ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE, amount TEXT DEFAULT '', unit TEXT DEFAULT '');
    CREATE TABLE IF NOT EXISTS favorites (id INTEGER PRIMARY KEY AUTOINCREMENT, drink_id INTEGER NOT NULL REFERENCES drinks(id) ON DELETE CASCADE, created_at TEXT DEFAULT (datetime('now')), UNIQUE(drink_id));
    CREATE TABLE IF NOT EXISTS user_inventory (id INTEGER PRIMARY KEY AUTOINCREMENT, ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE, created_at TEXT DEFAULT (datetime('now')), UNIQUE(ingredient_id));

    CREATE INDEX IF NOT EXISTS idx_drinks_category ON drinks(category_id);
    CREATE INDEX IF NOT EXISTS idx_drinks_alcoholic ON drinks(alcoholic);
    CREATE INDEX IF NOT EXISTS idx_drinks_user_created ON drinks(is_user_created);
    CREATE INDEX IF NOT EXISTS idx_drink_ingredients_drink ON drink_ingredients(drink_id);
    CREATE INDEX IF NOT EXISTS idx_drink_ingredients_ingredient ON drink_ingredients(ingredient_id);
    CREATE INDEX IF NOT EXISTS idx_favorites_drink ON favorites(drink_id);
    CREATE INDEX IF NOT EXISTS idx_inventory_ingredient ON user_inventory(ingredient_id);
  `);
  // Fallback: if copied DB somehow had no drinks, seed them now
  await seedCategories(db);
  await seedDrinks(db);
}

// Used as fallback if asset copy fails
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
  await seedDrinks(db);
}

async function seedCategories(db: SQLite.SQLiteDatabase): Promise<void> {
  const existing = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM categories'
  );
  if (existing && existing.count > 0) return;

  await db.runAsync('INSERT INTO categories (name, name_en, icon) VALUES (?, ?, ?)', ['Cocktail', 'Cocktail', 'wine-glass']);
  await db.runAsync('INSERT INTO categories (name, name_en, icon) VALUES (?, ?, ?)', ['Alkoholfri', 'Mocktail', 'glass-water']);
  await db.runAsync('INSERT INTO categories (name, name_en, icon) VALUES (?, ?, ?)', ['Shot', 'Shot', 'flask']);
  await db.runAsync('INSERT INTO categories (name, name_en, icon) VALUES (?, ?, ?)', ['Longdrink', 'Long drink', 'glass-water']);
  await db.runAsync('INSERT INTO categories (name, name_en, icon) VALUES (?, ?, ?)', ['Punch', 'Punch', 'bowl-food']);
  await db.runAsync('INSERT INTO categories (name, name_en, icon) VALUES (?, ?, ?)', ['Smoothie', 'Smoothie', 'blender']);
  await db.runAsync('INSERT INTO categories (name, name_en, icon) VALUES (?, ?, ?)', ['Annet', 'Other', 'star']);
}

type SeedIngredient = { name: string; amount: string; unit: string };

interface SeedDrink {
  name: string;
  description: string;
  image: string;
  category_id: number;
  alcoholic: boolean;
  glass_type: string;
  garnish: string;
  instructions: string;
  ingredients: SeedIngredient[];
}

async function seedDrinks(db: SQLite.SQLiteDatabase): Promise<void> {
  const existing = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM drinks'
  );
  if (existing && existing.count > 0) return;

  async function ing(name: string): Promise<number> {
    await db.runAsync('INSERT OR IGNORE INTO ingredients (name) VALUES (?)', [name]);
    const row = await db.getFirstAsync<{ id: number }>(
      'SELECT id FROM ingredients WHERE name = ? COLLATE NOCASE',
      [name]
    );
    return row!.id;
  }

  async function insert(d: SeedDrink): Promise<void> {
    const r = await db.runAsync(
      `INSERT INTO drinks (name, description, image, category_id, alcoholic, glass_type, garnish, instructions, is_user_created)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [d.name, d.description, d.image, d.category_id, d.alcoholic ? 1 : 0, d.glass_type, d.garnish, d.instructions]
    );
    const drinkId = r.lastInsertRowId;
    for (const i of d.ingredients) {
      const ingId = await ing(i.name);
      await db.runAsync(
        'INSERT INTO drink_ingredients (drink_id, ingredient_id, amount, unit) VALUES (?, ?, ?, ?)',
        [drinkId, ingId, i.amount, i.unit]
      );
    }
  }

  // Categories: 1=Cocktail 2=Alkoholfri 3=Shot 4=Longdrink 5=Punch 6=Smoothie 7=Annet
  const IMG = 'https://www.thecocktaildb.com/images/media/drink/';

  await insert({
    name: 'Mojito',
    description: 'Klassisk cubansk forfriskende cocktail med fersk mynte og lime. Lett, syrlig og perfekt til sommervarmen.',
    image: IMG + 'metwgh1606770327.jpg',
    category_id: 1, alcoholic: true,
    glass_type: 'Highball-glass', garnish: 'Frisk myntekvast og limeskive',
    instructions: '1. Legg limebåter og sukker i glasset og knus dem lett med en pestel.\n2. Fyll glasset halvfullt med knust is.\n3. Hell over hvit rom og rør godt.\n4. Fyll opp med sodavann.\n5. Pynt med myntekvast og limeskive.',
    ingredients: [
      { name: 'Hvit rom', amount: '5', unit: 'cl' },
      { name: 'Limejuice', amount: '3', unit: 'cl' },
      { name: 'Sukker', amount: '2', unit: 'ts' },
      { name: 'Fersk mynte', amount: '8', unit: 'blader' },
      { name: 'Sodavann', amount: '10', unit: 'cl' },
    ],
  });

  await insert({
    name: 'Margarita',
    description: 'Ikonisk mexicansk cocktail med tequila, triple sec og frisk limejuice. Klassisk servert med saltkant.',
    image: IMG + '5noda61589575158.jpg',
    category_id: 1, alcoholic: true,
    glass_type: 'Margarita-glass', garnish: 'Saltkant og limeskive',
    instructions: '1. Fukt kanten av glasset med lime og dypp det i salt.\n2. Fyll en shaker med is.\n3. Tilsett tequila, triple sec og limejuice.\n4. Rist godt i 15 sekunder.\n5. Sil over i glasset.',
    ingredients: [
      { name: 'Tequila', amount: '5', unit: 'cl' },
      { name: 'Triple sec', amount: '2', unit: 'cl' },
      { name: 'Limejuice', amount: '2', unit: 'cl' },
      { name: 'Salt', amount: '', unit: 'til kanten' },
    ],
  });

  await insert({
    name: 'Negroni',
    description: 'Balansert og kompleks italiensk aperitiff med lik del gin, Campari og søt vermouth.',
    image: IMG + 'qgdu971561574065.jpg',
    category_id: 1, alcoholic: true,
    glass_type: 'Rocks-glass', garnish: 'Appelsinskive',
    instructions: '1. Fyll glasset med store isbiter.\n2. Hell over gin, Campari og vermouth.\n3. Rør forsiktig i 20–30 sekunder til det er godt avkjølt.\n4. Pynt med en skive appelsinskal.',
    ingredients: [
      { name: 'Gin', amount: '3', unit: 'cl' },
      { name: 'Campari', amount: '3', unit: 'cl' },
      { name: 'Søt vermouth', amount: '3', unit: 'cl' },
    ],
  });

  await insert({
    name: 'Old Fashioned',
    description: 'En av verdens eldste cocktailoppskrifter. Bourbon, sukker og bitters — enkelt og tidløst.',
    image: IMG + 'vrwquq1461769560.jpg',
    category_id: 1, alcoholic: true,
    glass_type: 'Rocks-glass', garnish: 'Appelsinskall og kirsebær',
    instructions: '1. Legg sukkerbiten i glasset og fukt den med angostura bitters og et par dråper vann.\n2. Knus sukkerbiten lett.\n3. Tilsett bourbon og rør godt.\n4. Fyll med én stor isklump.\n5. Pynt med appelsinskall og maraschino-kirsebær.',
    ingredients: [
      { name: 'Bourbon whiskey', amount: '6', unit: 'cl' },
      { name: 'Angostura bitters', amount: '2', unit: 'dråper' },
      { name: 'Sukker', amount: '1', unit: 'bit' },
      { name: 'Vann', amount: '1', unit: 'ts' },
    ],
  });

  await insert({
    name: 'Aperol Spritz',
    description: 'Sommerens favorittdrink fra Italia. Lys, frisk og perfekt til en varm kveld ute.',
    image: IMG + 'ikg2ax1504372491.jpg',
    category_id: 1, alcoholic: true,
    glass_type: 'Vinglass', garnish: 'Appelsinskive',
    instructions: '1. Fyll et stort vinglass med isbiter.\n2. Hell over prosecco.\n3. Tilsett Aperol.\n4. Fyll opp med et skvett sodavann.\n5. Rør forsiktig og pynt med appelsinskive.',
    ingredients: [
      { name: 'Aperol', amount: '6', unit: 'cl' },
      { name: 'Prosecco', amount: '9', unit: 'cl' },
      { name: 'Sodavann', amount: '3', unit: 'cl' },
    ],
  });

  await insert({
    name: 'Cosmopolitan',
    description: 'Rosa og elegant — en moderne klassiker popularisert av Sex and the City. Søt, syrlig og vodkabasert.',
    image: IMG + 'kpsajh1504368362.jpg',
    category_id: 1, alcoholic: true,
    glass_type: 'Cocktailglass', garnish: 'Limeskive eller appelsinskall',
    instructions: '1. Fyll en shaker med is.\n2. Tilsett vodka, triple sec, tranebærjuice og limejuice.\n3. Rist energisk i 15 sekunder.\n4. Sil over i et avkjølt cocktailglass.\n5. Pynt med limeskive.',
    ingredients: [
      { name: 'Vodka', amount: '4', unit: 'cl' },
      { name: 'Triple sec', amount: '2', unit: 'cl' },
      { name: 'Tranebærjuice', amount: '3', unit: 'cl' },
      { name: 'Limejuice', amount: '1', unit: 'cl' },
    ],
  });

  await insert({
    name: 'Gin & Tonic',
    description: 'Enkel og forfriskende — alltid et godt valg. Gin og tonic er et klassisk par som aldri går av moten.',
    image: IMG + 'z0omyp1582477529.jpg',
    category_id: 4, alcoholic: true,
    glass_type: 'Highball-glass', garnish: 'Limeskive og isbiter',
    instructions: '1. Fyll et høyt glass med store isbiter.\n2. Hell over gin.\n3. Fyll forsiktig opp med kjølt tonic for å bevare bobblene.\n4. Rør én gang forsiktig.\n5. Pynt med limeskive.',
    ingredients: [
      { name: 'Gin', amount: '5', unit: 'cl' },
      { name: 'Tonic water', amount: '15', unit: 'cl' },
    ],
  });

  await insert({
    name: 'Moscow Mule',
    description: 'Forfriskende vodkacocktail med ingefærøl og lime, tradisjonelt servert i et koppmug av kobber.',
    image: IMG + '3pylqc1504370988.jpg',
    category_id: 1, alcoholic: true,
    glass_type: 'Kobbermug', garnish: 'Limeskive og fersk mynte',
    instructions: '1. Fyll et kobbermug med knust is.\n2. Tilsett vodka og limejuice.\n3. Fyll opp med ingefærøl.\n4. Rør forsiktig.\n5. Pynt med limeskive og myntekvist.',
    ingredients: [
      { name: 'Vodka', amount: '5', unit: 'cl' },
      { name: 'Ingefærøl', amount: '15', unit: 'cl' },
      { name: 'Limejuice', amount: '2', unit: 'cl' },
    ],
  });

  await insert({
    name: 'Whiskey Sour',
    description: 'Søt og syrlig whiskeyklassiker med eggehvite for et silkemykt skum på toppen.',
    image: IMG + 'vydxpo1468878515.jpg',
    category_id: 1, alcoholic: true,
    glass_type: 'Rocks-glass', garnish: 'Sitronskal og kirsebær',
    instructions: '1. Ha alle ingredienser i shakeren UTEN is (dry shake) og rist i 10 sekunder for å emulgere eggehviten.\n2. Tilsett is og rist igjen kraftig i 15 sekunder.\n3. Sil over i glass med is.\n4. Pynt med sitronskal og kirsebær.',
    ingredients: [
      { name: 'Bourbon whiskey', amount: '5', unit: 'cl' },
      { name: 'Sitronsaft', amount: '3', unit: 'cl' },
      { name: 'Sukkersirup', amount: '2', unit: 'cl' },
      { name: 'Eggehvite', amount: '1', unit: 'stk' },
    ],
  });

  await insert({
    name: 'Daiquiri',
    description: 'Enkel og elegant rombasert klassiker. Bare tre ingredienser, men perfekt balanse mellom syrlig og søtt.',
    image: IMG + 'mrz9091589574515.jpg',
    category_id: 1, alcoholic: true,
    glass_type: 'Cocktailglass', garnish: 'Limeskive',
    instructions: '1. Fyll en shaker med is.\n2. Tilsett rom, limejuice og sukkersirup.\n3. Rist godt i 15 sekunder.\n4. Sil over i et avkjølt cocktailglass.\n5. Pynt med en limeskive.',
    ingredients: [
      { name: 'Hvit rom', amount: '5', unit: 'cl' },
      { name: 'Limejuice', amount: '3', unit: 'cl' },
      { name: 'Sukkersirup', amount: '2', unit: 'cl' },
    ],
  });

  await insert({
    name: 'Piña Colada',
    description: 'Tropisk drøm i et glass. Rom, kokosnøtt og ananas — smaken av ferie og solskinn.',
    image: IMG + 'upgsue1668419912.jpg',
    category_id: 1, alcoholic: true,
    glass_type: 'Hurricane-glass', garnish: 'Ananasbit og kirsebær',
    instructions: '1. Ha rom, kokosnøttkrem og ananasjuice i en blender.\n2. Tilsett 1 kopp knust is.\n3. Bland på høy hastighet til glatt.\n4. Hell over i glass.\n5. Pynt med ananasbit og kirsebær.',
    ingredients: [
      { name: 'Hvit rom', amount: '5', unit: 'cl' },
      { name: 'Kokosnøttkrem', amount: '3', unit: 'cl' },
      { name: 'Ananasjuice', amount: '10', unit: 'cl' },
    ],
  });

  await insert({
    name: 'Long Island Iced Tea',
    description: 'Sterkere enn den ser ut! Fem ulike spriter blandet med sitrus og cola gir smaken av is-te.',
    image: IMG + 'nkwr4c1606770558.jpg',
    category_id: 4, alcoholic: true,
    glass_type: 'Highball-glass', garnish: 'Sitronskive',
    instructions: '1. Fyll et highball-glass med isbiter.\n2. Tilsett vodka, gin, rom, tequila, triple sec og sitronsaft.\n3. Rør godt.\n4. Fyll forsiktig opp med cola.\n5. Pynt med sitronskive.',
    ingredients: [
      { name: 'Vodka', amount: '1.5', unit: 'cl' },
      { name: 'Gin', amount: '1.5', unit: 'cl' },
      { name: 'Hvit rom', amount: '1.5', unit: 'cl' },
      { name: 'Tequila', amount: '1.5', unit: 'cl' },
      { name: 'Triple sec', amount: '1.5', unit: 'cl' },
      { name: 'Sitronsaft', amount: '2.5', unit: 'cl' },
      { name: 'Cola', amount: '10', unit: 'cl' },
    ],
  });

  await insert({
    name: 'Sex on the Beach',
    description: 'Fargerik og tropisk sommerdrink med vodka, persikoschnaps og en deilig blanding av juicer.',
    image: IMG + 'bx8ob21504366839.jpg',
    category_id: 1, alcoholic: true,
    glass_type: 'Highball-glass', garnish: 'Appelsinskive og kirsebær',
    instructions: '1. Fyll et highball-glass med isbiter.\n2. Hell over vodka og persikoschnaps.\n3. Tilsett appelsinjuice og tranebærjuice.\n4. Rør forsiktig for å skape en fin fargeeffekt.\n5. Pynt med appelsinskive og kirsebær.',
    ingredients: [
      { name: 'Vodka', amount: '4', unit: 'cl' },
      { name: 'Persikoschnaps', amount: '2', unit: 'cl' },
      { name: 'Appelsinjuice', amount: '6', unit: 'cl' },
      { name: 'Tranebærjuice', amount: '6', unit: 'cl' },
    ],
  });

  await insert({
    name: 'Tequila Sunrise',
    description: 'Vakker soloppgangseffekt i glasset. Appelsinjuice og grenadine skaper et spektakulært fargespill.',
    image: IMG + 'tqyrpw1439905311.jpg',
    category_id: 1, alcoholic: true,
    glass_type: 'Highball-glass', garnish: 'Appelsinskive og kirsebær',
    instructions: '1. Fyll et glass med isbiter.\n2. Hell over tequila og appelsinjuice og rør lett.\n3. Hell forsiktig grenadinen ned langs kanten eller med en skje slik at den synker til bunnen.\n4. IKKE rør — la "soloppgangen" vises.\n5. Pynt med appelsinskive og kirsebær.',
    ingredients: [
      { name: 'Tequila', amount: '5', unit: 'cl' },
      { name: 'Appelsinjuice', amount: '10', unit: 'cl' },
      { name: 'Grenadine', amount: '1.5', unit: 'cl' },
    ],
  });

  await insert({
    name: 'Espresso Martini',
    description: 'For de som vil ha kaffe og cocktail i ett. Vodka og kahlúa møter fersk espresso — kraftfull og velsmakende.',
    image: IMG + 'n0sx8g1504366923.jpg',
    category_id: 1, alcoholic: true,
    glass_type: 'Cocktailglass', garnish: '3 kaffebønner',
    instructions: '1. Trekk en espresso og la den avkjøle seg litt.\n2. Fyll en shaker med is.\n3. Tilsett vodka, kahlúa, espresso og sukkersirup.\n4. Rist KRAFTIG i 20 sekunder for å skape skum.\n5. Sil over i avkjølt cocktailglass og pynt med 3 kaffebønner.',
    ingredients: [
      { name: 'Vodka', amount: '5', unit: 'cl' },
      { name: 'Kahlúa', amount: '2', unit: 'cl' },
      { name: 'Espresso', amount: '3', unit: 'cl' },
      { name: 'Sukkersirup', amount: '1', unit: 'cl' },
    ],
  });

  await insert({
    name: 'Manhattan',
    description: 'Tidløs og sofistikert klassiker fra New York. Whiskey, vermouth og bitters i perfekt harmoni.',
    image: IMG + 'yk70e31606771240.jpg',
    category_id: 1, alcoholic: true,
    glass_type: 'Cocktailglass', garnish: 'Maraschino-kirsebær',
    instructions: '1. Fyll en røreglass med isbiter.\n2. Tilsett whiskey, søt vermouth og angostura bitters.\n3. Rør rolig i 30 sekunder til det er godt avkjølt.\n4. Sil over i avkjølt cocktailglass.\n5. Pynt med maraschino-kirsebær.',
    ingredients: [
      { name: 'Rye whiskey', amount: '6', unit: 'cl' },
      { name: 'Søt vermouth', amount: '3', unit: 'cl' },
      { name: 'Angostura bitters', amount: '2', unit: 'dråper' },
    ],
  });

  await insert({
    name: 'Paloma',
    description: 'Meksikos mest elskede cocktail — tequila med frisk grapefrukt. Lettere og friskere enn en margarita.',
    image: IMG + 'tsssxr1454511116.jpg',
    category_id: 1, alcoholic: true,
    glass_type: 'Highball-glass', garnish: 'Saltkant og grapefruktskive',
    instructions: '1. Fukt kanten av glasset med lime og dypp i salt.\n2. Fyll glasset med isbiter.\n3. Tilsett tequila og limejuice.\n4. Fyll opp med grapefruktbrus.\n5. Rør forsiktig og pynt med grapefruktskive.',
    ingredients: [
      { name: 'Tequila', amount: '5', unit: 'cl' },
      { name: 'Grapefruktbrus', amount: '15', unit: 'cl' },
      { name: 'Limejuice', amount: '1', unit: 'cl' },
      { name: 'Salt', amount: '', unit: 'til kanten' },
    ],
  });

  await insert({
    name: 'Dark \'n\' Stormy',
    description: 'Kraftig og forfriskende med mørk rom og sprudlende ingefærøl. En storm i et glass.',
    image: IMG + 'a8a6e21606769727.jpg',
    category_id: 1, alcoholic: true,
    glass_type: 'Highball-glass', garnish: 'Limeskive',
    instructions: '1. Fyll et highball-glass med isbiter.\n2. Tilsett limejuice.\n3. Fyll opp med ingefærøl.\n4. Hell forsiktig mørk rom over en skje slik at det flyter på toppen.\n5. Pynt med limeskive.',
    ingredients: [
      { name: 'Mørk rom', amount: '6', unit: 'cl' },
      { name: 'Ingefærøl', amount: '15', unit: 'cl' },
      { name: 'Limejuice', amount: '1', unit: 'cl' },
    ],
  });

  await insert({
    name: 'Hugo Spritz',
    description: 'Skandinavias favorittspritz med hylleblomst og mynte. Lett og blomstrende — perfekt sommerdrikk.',
    image: IMG + 'ikg2ax1504372491.jpg',
    category_id: 1, alcoholic: true,
    glass_type: 'Vinglass', garnish: 'Fersk mynte og limeskive',
    instructions: '1. Fyll et stort vinglass med isbiter.\n2. Tilsett hylleblomstsaft.\n3. Hell over prosecco.\n4. Fyll opp med et skvett sodavann.\n5. Rør forsiktig og pynt med fersk mynte og limeskive.',
    ingredients: [
      { name: 'Prosecco', amount: '10', unit: 'cl' },
      { name: 'Hylleblomstsaft', amount: '4', unit: 'cl' },
      { name: 'Sodavann', amount: '3', unit: 'cl' },
      { name: 'Fersk mynte', amount: '4', unit: 'blader' },
    ],
  });

  await insert({
    name: 'Singapore Sling',
    description: 'Eksotisk og fargerik signaturdrink fra Raffles Hotel i Singapore. Fruktig og festlig.',
    image: IMG + '2ck7of1606771765.jpg',
    category_id: 1, alcoholic: true,
    glass_type: 'Hurricane-glass', garnish: 'Ananasbit og kirsebær',
    instructions: '1. Fyll en shaker med is.\n2. Tilsett gin, kirsebærlikør, Cointreau, Benedictine, ananasjuice, limejuice og grenadine.\n3. Rist godt.\n4. Sil over i glass med is.\n5. Pynt med ananasbit og kirsebær.',
    ingredients: [
      { name: 'Gin', amount: '4', unit: 'cl' },
      { name: 'Kirsebærlikør', amount: '2', unit: 'cl' },
      { name: 'Cointreau', amount: '0.75', unit: 'cl' },
      { name: 'Ananasjuice', amount: '12', unit: 'cl' },
      { name: 'Limejuice', amount: '1.5', unit: 'cl' },
      { name: 'Grenadine', amount: '1', unit: 'cl' },
    ],
  });

  await insert({
    name: 'Jordbær Daiquiri',
    description: 'Fruktfull og frisk variant av klassisk daiquiri. Rom og ferske jordbær blandet til en vakker rosa drink.',
    image: IMG + 'fqfuty1469881395.jpg',
    category_id: 1, alcoholic: true,
    glass_type: 'Cocktailglass', garnish: 'Jordbær på kanten',
    instructions: '1. Ha rom, jordbær, limejuice og sukkersirup i en blender.\n2. Tilsett en kopp knust is.\n3. Bland til glatt og kremaktig.\n4. Hell over i glass.\n5. Pynt med et jordbær på kanten.',
    ingredients: [
      { name: 'Hvit rom', amount: '5', unit: 'cl' },
      { name: 'Ferske jordbær', amount: '6', unit: 'stk' },
      { name: 'Limejuice', amount: '2', unit: 'cl' },
      { name: 'Sukkersirup', amount: '2', unit: 'cl' },
    ],
  });

  // Shots
  await insert({
    name: 'B-52',
    description: 'Imponerende trelags skudd med kaffe, irsk krem og appelsinlikør. Server lagvis — ikke rør!',
    image: IMG + 'touyuv1483475555.jpg',
    category_id: 3, alcoholic: true,
    glass_type: 'Shotglass', garnish: '',
    instructions: '1. Hell Kahlúa forsiktig i bunnen av shotglasset.\n2. Legg en teskje baklengs mot innsiden av glasset og hell Baileys sakte over for å lage et nytt lag.\n3. Gjør det samme med Grand Marnier øverst.\n4. Server med en fyrstikk for å tenne på toppen — valgfritt!',
    ingredients: [
      { name: 'Kahlúa', amount: '1.5', unit: 'cl' },
      { name: 'Baileys', amount: '1.5', unit: 'cl' },
      { name: 'Grand Marnier', amount: '1.5', unit: 'cl' },
    ],
  });

  await insert({
    name: 'Tequila Shot',
    description: 'Den klassiske måten å drikke tequila på — salt, shot og lime. Enkel og effektiv.',
    image: IMG + '3mss4a1606771260.jpg',
    category_id: 3, alcoholic: true,
    glass_type: 'Shotglass', garnish: 'Limebåt og salt',
    instructions: '1. Slipp litt salt på håndryggen mellom tommel og pekefinger.\n2. Hold limebåten klar.\n3. Slikk saltet, drikk tequila-shoten, bit i limen.',
    ingredients: [
      { name: 'Tequila', amount: '4', unit: 'cl' },
      { name: 'Salt', amount: '1', unit: 'klype' },
      { name: 'Limejuice', amount: '1', unit: 'båt' },
    ],
  });

  // Alkoholfri
  await insert({
    name: 'Virgin Mojito',
    description: 'Alle mojito-smakene uten alkohol. Like forfriskende og full av mynte og lime.',
    image: IMG + 'xvqvqq1441245317.jpg',
    category_id: 2, alcoholic: false,
    glass_type: 'Highball-glass', garnish: 'Myntekvast og limeskive',
    instructions: '1. Legg limebåter og sukker i glasset og knus dem lett.\n2. Tilsett fersk mynte og knus den forsiktig.\n3. Fyll glasset med knust is.\n4. Hell over limejuice og fyll opp med sodavann.\n5. Rør og pynt med myntekvast.',
    ingredients: [
      { name: 'Limejuice', amount: '4', unit: 'cl' },
      { name: 'Sukker', amount: '2', unit: 'ts' },
      { name: 'Fersk mynte', amount: '10', unit: 'blader' },
      { name: 'Sodavann', amount: '20', unit: 'cl' },
    ],
  });

  await insert({
    name: 'Shirley Temple',
    description: 'Søt og festlig alkoholfri brusdrink oppkalt etter barnestjernen Shirley Temple. Populær blant alle aldre.',
    image: IMG + 'fp1uu91515792973.jpg',
    category_id: 2, alcoholic: false,
    glass_type: 'Highball-glass', garnish: 'Kirsebær og appelsinskive',
    instructions: '1. Fyll et glass med isbiter.\n2. Hell over ginger ale.\n3. Tilsett appelsinjuice.\n4. Drypp grenadine forsiktig ned slik at det synker til bunnen.\n5. Pynt med kirsebær og appelsinskive.',
    ingredients: [
      { name: 'Ginger ale', amount: '20', unit: 'cl' },
      { name: 'Grenadine', amount: '2', unit: 'cl' },
      { name: 'Appelsinjuice', amount: '5', unit: 'cl' },
    ],
  });

  await insert({
    name: 'Alkoholfri Aperol Spritz',
    description: 'Den populære spritze-smaken uten alkohol. Frisk, fruktig og like flott å se på.',
    image: IMG + 'ikg2ax1504372491.jpg',
    category_id: 2, alcoholic: false,
    glass_type: 'Vinglass', garnish: 'Appelsinskive og mynte',
    instructions: '1. Fyll et stort vinglass med isbiter.\n2. Tilsett alkoholfri aperitiff (f.eks. Lyre\'s Italian Orange).\n3. Fyll opp med alkoholfri musserende vin eller sodavann.\n4. Rør forsiktig og pynt med appelsinskive.',
    ingredients: [
      { name: 'Alkoholfri aperitiff', amount: '6', unit: 'cl' },
      { name: 'Alkoholfri musserende vin', amount: '12', unit: 'cl' },
      { name: 'Sodavann', amount: '3', unit: 'cl' },
    ],
  });

  // Smoothies
  await insert({
    name: 'Jordbær Banan Smoothie',
    description: 'Sunn, kremaktig og deilig smoothie. Perfekt til frokost eller som en rask snack.',
    image: 'https://images.unsplash.com/photo-1553530666-dbf51e00f8a6?auto=format&fit=crop&w=800&q=80',
    category_id: 6, alcoholic: false,
    glass_type: 'Smoothieglass', garnish: 'Jordbær på kanten',
    instructions: '1. Ha alle ingredienser i en blender.\n2. Bland på høy hastighet til glatt og kremaktig.\n3. Smak til og tilsett mer honning om ønskelig.\n4. Hell over i glass og server umiddelbart.',
    ingredients: [
      { name: 'Jordbær', amount: '150', unit: 'g' },
      { name: 'Banan', amount: '1', unit: 'stk' },
      { name: 'Gresk yoghurt', amount: '100', unit: 'g' },
      { name: 'Honning', amount: '1', unit: 'ss' },
      { name: 'Melk', amount: '10', unit: 'cl' },
    ],
  });

  await insert({
    name: 'Grønn Detox Smoothie',
    description: 'Energigivende grønn smoothie med spinat, eple og ingefær. Frisk og full av næringsstoffer.',
    image: 'https://images.unsplash.com/photo-1610970881699-44a5587cabec?auto=format&fit=crop&w=800&q=80',
    category_id: 6, alcoholic: false,
    glass_type: 'Smoothieglass', garnish: 'Agurk og mynteskive',
    instructions: '1. Ha spinat, eple og agurk i blender med halvparten av vannet.\n2. Bland til glatt.\n3. Tilsett resten av ingrediensene og blend igjen.\n4. Server med is og pynt med agurk og mynte.',
    ingredients: [
      { name: 'Spinat', amount: '50', unit: 'g' },
      { name: 'Eple', amount: '1', unit: 'stk' },
      { name: 'Agurk', amount: '0.5', unit: 'stk' },
      { name: 'Frisk ingefær', amount: '1', unit: 'cm' },
      { name: 'Sitronsaft', amount: '2', unit: 'cl' },
      { name: 'Vann', amount: '20', unit: 'cl' },
    ],
  });

  // --- Gin-baserte klassikere ---
  await insert({
    name: 'French 75',
    description: 'Elegant og festlig — gin møter champagne med sitrus. Oppkalt etter en fransk kanon fra 1. verdenskrig.',
    image: IMG + '3tsm501587659720.jpg',
    category_id: 1, alcoholic: true,
    glass_type: 'Champagneglass', garnish: 'Sitronskall',
    instructions: '1. Fyll en shaker med is.\n2. Tilsett gin, sitronsaft og sukkersirup.\n3. Rist godt i 15 sekunder.\n4. Sil over i et avkjølt champagneglass.\n5. Fyll forsiktig opp med champagne eller prosecco.\n6. Pynt med sitronskall.',
    ingredients: [
      { name: 'Gin', amount: '4', unit: 'cl' },
      { name: 'Sitronsaft', amount: '2', unit: 'cl' },
      { name: 'Sukkersirup', amount: '1', unit: 'cl' },
      { name: 'Champagne', amount: '10', unit: 'cl' },
    ],
  });

  await insert({
    name: 'Tom Collins',
    description: 'Klassisk og forfriskende longdrink med gin, sitron og sodavann. En favoritt siden 1800-tallet.',
    image: IMG + 'hbkfzu1574797234.jpg',
    category_id: 4, alcoholic: true,
    glass_type: 'Collins-glass', garnish: 'Sitronskive og kirsebær',
    instructions: '1. Fyll et Collins-glass med isbiter.\n2. Tilsett gin, sitronsaft og sukkersirup.\n3. Rør lett.\n4. Fyll opp med sodavann.\n5. Pynt med sitronskive og kirsebær.',
    ingredients: [
      { name: 'Gin', amount: '5', unit: 'cl' },
      { name: 'Sitronsaft', amount: '3', unit: 'cl' },
      { name: 'Sukkersirup', amount: '1.5', unit: 'cl' },
      { name: 'Sodavann', amount: '10', unit: 'cl' },
    ],
  });

  await insert({
    name: 'Gimlet',
    description: 'Enkel og smakfull gin-cocktail med limekordial. Skarp, søt og tidløs.',
    image: IMG + 'e8ytqp1504338726.jpg',
    category_id: 1, alcoholic: true,
    glass_type: 'Cocktailglass', garnish: 'Limeskive',
    instructions: '1. Fyll en shaker med is.\n2. Tilsett gin og limekordial.\n3. Rist godt i 15 sekunder.\n4. Sil over i avkjølt cocktailglass.\n5. Pynt med limeskive.',
    ingredients: [
      { name: 'Gin', amount: '6', unit: 'cl' },
      { name: 'Limekordial', amount: '2', unit: 'cl' },
    ],
  });

  await insert({
    name: "Bee's Knees",
    description: 'Forbudstidens elegante gin-cocktail. Honning erstatter sukker og gir en rund, blomstrende sødme.',
    image: IMG + 'j6ywwu1504367908.jpg',
    category_id: 1, alcoholic: true,
    glass_type: 'Cocktailglass', garnish: 'Sitronskall',
    instructions: '1. Rør honning og sitronsaft sammen til honningen er oppløst.\n2. Fyll en shaker med is.\n3. Tilsett gin og honning-sitronsaft-blandingen.\n4. Rist godt.\n5. Sil over i avkjølt cocktailglass.',
    ingredients: [
      { name: 'Gin', amount: '6', unit: 'cl' },
      { name: 'Sitronsaft', amount: '2', unit: 'cl' },
      { name: 'Honning', amount: '2', unit: 'cl' },
    ],
  });

  await insert({
    name: 'Clover Club',
    description: 'Vakkert rosa gin-cocktail med bringebær og eggehvite. Silkemyk og fruktig — en pre-forbudstidens klassiker.',
    image: IMG + 'aptjup1504370835.jpg',
    category_id: 1, alcoholic: true,
    glass_type: 'Cocktailglass', garnish: 'Ferske bringebær',
    instructions: '1. Ha alle ingredienser i shaker UTEN is og rist (dry shake) i 10 sek.\n2. Tilsett is og rist igjen kraftig.\n3. Sil over i avkjølt cocktailglass.\n4. Pynt med ferske bringebær.',
    ingredients: [
      { name: 'Gin', amount: '5', unit: 'cl' },
      { name: 'Sitronsaft', amount: '2', unit: 'cl' },
      { name: 'Bringebærsirup', amount: '2', unit: 'cl' },
      { name: 'Eggehvite', amount: '1', unit: 'stk' },
    ],
  });

  await insert({
    name: 'White Lady',
    description: 'Ren og elegant gin Sidecar-variant. Gin, Cointreau og sitron i perfekt balanse.',
    image: IMG + 'vm5p1l1504500045.jpg',
    category_id: 1, alcoholic: true,
    glass_type: 'Cocktailglass', garnish: 'Sitronskall',
    instructions: '1. Fyll en shaker med is.\n2. Tilsett gin, Cointreau og sitronsaft.\n3. Rist godt.\n4. Sil over i avkjølt cocktailglass.\n5. Pynt med sitronskall.',
    ingredients: [
      { name: 'Gin', amount: '4', unit: 'cl' },
      { name: 'Cointreau', amount: '2', unit: 'cl' },
      { name: 'Sitronsaft', amount: '2', unit: 'cl' },
    ],
  });

  // --- Cognac/Brandy ---
  await insert({
    name: 'Sidecar',
    description: 'Cognac-klassiker fra Paris på 1920-tallet. Tørr, syrlig og sofistikert med sukkerkant.',
    image: IMG + 'louvg31582476556.jpg',
    category_id: 1, alcoholic: true,
    glass_type: 'Cocktailglass', garnish: 'Sukkerkant og appelsinskall',
    instructions: '1. Fukt kanten av glasset og dypp i sukker.\n2. Fyll shaker med is.\n3. Tilsett cognac, Cointreau og sitronsaft.\n4. Rist godt.\n5. Sil over i glasset.\n6. Pynt med appelsinskall.',
    ingredients: [
      { name: 'Cognac', amount: '5', unit: 'cl' },
      { name: 'Cointreau', amount: '2', unit: 'cl' },
      { name: 'Sitronsaft', amount: '2', unit: 'cl' },
    ],
  });

  await insert({
    name: 'Brandy Alexander',
    description: 'Luksuriøs og kremet dessertdrink med cognac, kakaol ikør og fløte. Sjokolademyk og uimotståelig.',
    image: IMG + 'oj3the1606770258.jpg',
    category_id: 1, alcoholic: true,
    glass_type: 'Cocktailglass', garnish: 'Revet muskatnøtt',
    instructions: '1. Fyll en shaker med is.\n2. Tilsett cognac, mørk kakaol ikør og kremfløte.\n3. Rist godt.\n4. Sil over i avkjølt cocktailglass.\n5. Dryss revet muskatnøtt på toppen.',
    ingredients: [
      { name: 'Cognac', amount: '4', unit: 'cl' },
      { name: 'Mørk kakaol ikør', amount: '2', unit: 'cl' },
      { name: 'Kremfløte', amount: '2', unit: 'cl' },
    ],
  });

  // --- Whiskey / Bourbon ---
  await insert({
    name: 'Mint Julep',
    description: 'Kentucky Derbys offisielle cocktail. Bourbon, fersk mynte og knust is — sommer i et sølvbeger.',
    image: IMG + 'llbwop1560862781.jpg',
    category_id: 1, alcoholic: true,
    glass_type: 'Sølvbeger eller rocks-glass', garnish: 'Stor myntekvast',
    instructions: '1. Ha mynteblader og sukkersirup i bunnen av glasset.\n2. Knus mynte forsiktig med pestel — ikke overstimulér den.\n3. Fyll glasset med knust is.\n4. Hell over bourbon og rør godt.\n5. Pynt med en stor myntekvast.\n6. Dryss litt melis på mynte om ønskelig.',
    ingredients: [
      { name: 'Bourbon whiskey', amount: '6', unit: 'cl' },
      { name: 'Sukkersirup', amount: '1.5', unit: 'cl' },
      { name: 'Fersk mynte', amount: '8', unit: 'blader' },
    ],
  });

  await insert({
    name: 'Paper Plane',
    description: 'Moderne klassiker fra 2008 med fire like deler — bourbon, Aperol, Amaro og sitron. Perfekt balansert.',
    image: IMG + 'xbqg461504372761.jpg',
    category_id: 1, alcoholic: true,
    glass_type: 'Cocktailglass', garnish: 'Sitronskall',
    instructions: '1. Fyll en shaker med is.\n2. Tilsett like deler bourbon, Aperol, Amaro Nonino og sitronsaft.\n3. Rist godt i 15 sekunder.\n4. Sil over i avkjølt cocktailglass.',
    ingredients: [
      { name: 'Bourbon whiskey', amount: '2.25', unit: 'cl' },
      { name: 'Aperol', amount: '2.25', unit: 'cl' },
      { name: 'Amaro Nonino', amount: '2.25', unit: 'cl' },
      { name: 'Sitronsaft', amount: '2.25', unit: 'cl' },
    ],
  });

  await insert({
    name: 'Rob Roy',
    description: 'Skotsk variant av Manhattan — Scotch whisky i stedet for rye. Røykfull, rik og raffinert.',
    image: IMG + 'yk70e31606771240.jpg',
    category_id: 1, alcoholic: true,
    glass_type: 'Cocktailglass', garnish: 'Maraschino-kirsebær',
    instructions: '1. Fyll et røreglass med isbiter.\n2. Tilsett Scotch whisky, søt vermouth og angostura bitters.\n3. Rør i 30 sekunder til godt avkjølt.\n4. Sil over i avkjølt cocktailglass.\n5. Pynt med maraschino-kirsebær.',
    ingredients: [
      { name: 'Scotch whisky', amount: '6', unit: 'cl' },
      { name: 'Søt vermouth', amount: '3', unit: 'cl' },
      { name: 'Angostura bitters', amount: '2', unit: 'dråper' },
    ],
  });

  await insert({
    name: 'Rusty Nail',
    description: 'Enkel skotsk klassiker med Drambuie — honninglikør basert på whisky og urter. Varm og inntil.',
    image: IMG + 'tusezp1582475771.jpg',
    category_id: 1, alcoholic: true,
    glass_type: 'Rocks-glass', garnish: 'Sitronskall',
    instructions: '1. Fyll et rocks-glass med en stor isklump.\n2. Hell over Scotch whisky.\n3. Tilsett Drambuie.\n4. Rør forsiktig.\n5. Pynt med sitronskall.',
    ingredients: [
      { name: 'Scotch whisky', amount: '5', unit: 'cl' },
      { name: 'Drambuie', amount: '2', unit: 'cl' },
    ],
  });

  await insert({
    name: 'Amaretto Sour',
    description: 'Søt og syrlig med mandel-aroma fra amaretto. Eggehvite gir det kremete skumet på toppen.',
    image: IMG + 'yyzs2i1504366743.jpg',
    category_id: 1, alcoholic: true,
    glass_type: 'Rocks-glass', garnish: 'Kirsebær og appelsinskive',
    instructions: '1. Ha alle ingredienser i shaker uten is og rist (dry shake) i 10 sek.\n2. Tilsett is og rist igjen kraftig.\n3. Sil over i glass med is.\n4. Pynt med kirsebær og appelsinskive.',
    ingredients: [
      { name: 'Amaretto', amount: '5', unit: 'cl' },
      { name: 'Sitronsaft', amount: '3', unit: 'cl' },
      { name: 'Sukkersirup', amount: '1', unit: 'cl' },
      { name: 'Eggehvite', amount: '1', unit: 'stk' },
    ],
  });

  // --- Rom-baserte ---
  await insert({
    name: 'Mai Tai',
    description: 'Tropisk tiki-klassiker fra 1944 med aged rom, lime og mandelsirup. Transporterer deg rett til Polynesia.',
    image: IMG + 'quyUts1587558534.jpg',
    category_id: 1, alcoholic: true,
    glass_type: 'Rocks-glass eller tiki-glass', garnish: 'Myntekvast, limeskive og kirsebær',
    instructions: '1. Fyll en shaker med knust is.\n2. Tilsett rom, appelsinlikør, limejuice og mandelsirup.\n3. Rist godt.\n4. Hell med isen over i tiki-glass.\n5. Pynt med myntekvast, limeskive og kirsebær.',
    ingredients: [
      { name: 'Aged rom', amount: '4', unit: 'cl' },
      { name: 'Mørk rom', amount: '2', unit: 'cl' },
      { name: 'Appelsinlikør', amount: '2', unit: 'cl' },
      { name: 'Limejuice', amount: '2', unit: 'cl' },
      { name: 'Mandelsirup (orgeat)', amount: '1.5', unit: 'cl' },
    ],
  });

  await insert({
    name: 'Painkiller',
    description: 'Kremaktig tropisk rom-drink fra British Virgin Islands. Kokos og ananas med en smule muskatnøtt på toppen.',
    image: IMG + 'uqxqjs1504348237.jpg',
    category_id: 1, alcoholic: true,
    glass_type: 'Rocks-glass', garnish: 'Revet muskatnøtt og ananasbit',
    instructions: '1. Fyll en shaker med is.\n2. Tilsett rom, ananasjuice, appelsinjuice og kokoskrem.\n3. Rist godt.\n4. Hell over knust is i glass.\n5. Dryss revet muskatnøtt på toppen og pynt med ananasbit.',
    ingredients: [
      { name: 'Mørk rom', amount: '6', unit: 'cl' },
      { name: 'Ananasjuice', amount: '12', unit: 'cl' },
      { name: 'Appelsinjuice', amount: '3', unit: 'cl' },
      { name: 'Kokoskrem', amount: '3', unit: 'cl' },
    ],
  });

  await insert({
    name: 'Hemingway Daiquiri',
    description: 'Ernest Hemingways favorittdrink — tørr og syrlig daiquiri med grapefrukt og maraschino. Dobbel porsjon, halfparten sukker.',
    image: IMG + 'mrz9091589574515.jpg',
    category_id: 1, alcoholic: true,
    glass_type: 'Cocktailglass', garnish: 'Limeskive',
    instructions: '1. Fyll en shaker med is.\n2. Tilsett rom, grapefruktjuice, limejuice og maraschino-likør.\n3. Rist kraftig i 15 sekunder.\n4. Sil over i avkjølt cocktailglass.\n5. Pynt med limeskive.',
    ingredients: [
      { name: 'Hvit rom', amount: '6', unit: 'cl' },
      { name: 'Grapefruktjuice', amount: '4', unit: 'cl' },
      { name: 'Limejuice', amount: '1.5', unit: 'cl' },
      { name: 'Maraschino-likør', amount: '1.5', unit: 'cl' },
    ],
  });

  await insert({
    name: 'Jungle Bird',
    description: 'Uventet kombinasjon av mørk rom og Campari med ananas — bittert, søtt og tropisk på én gang.',
    image: IMG + 'rt5huu1606769556.jpg',
    category_id: 1, alcoholic: true,
    glass_type: 'Rocks-glass', garnish: 'Ananasbit og kirsebær',
    instructions: '1. Fyll en shaker med is.\n2. Tilsett mørk rom, Campari, ananasjuice, limejuice og sukkersirup.\n3. Rist godt.\n4. Sil over i glass med is.\n5. Pynt med ananasbit.',
    ingredients: [
      { name: 'Mørk rom', amount: '4.5', unit: 'cl' },
      { name: 'Campari', amount: '2', unit: 'cl' },
      { name: 'Ananasjuice', amount: '4.5', unit: 'cl' },
      { name: 'Limejuice', amount: '1.5', unit: 'cl' },
      { name: 'Sukkersirup', amount: '1', unit: 'cl' },
    ],
  });

  // --- Vodka-baserte ---
  await insert({
    name: 'Pornstar Martini',
    description: 'Britisk bartender-hit fra 2002. Pasjonsfrukt og vanilje møter vodka — server med liten prosecco-shot på siden.',
    image: IMG + 'b6czzn1504366899.jpg',
    category_id: 1, alcoholic: true,
    glass_type: 'Cocktailglass', garnish: 'Halvt pasjonsfrukt og prosecco-shot',
    instructions: '1. Fyll en shaker med is.\n2. Tilsett vodka, passoa, pasjonsfruktpuré og vaniljesukkersirup.\n3. Rist kraftig.\n4. Sil over i avkjølt cocktailglass.\n5. Legg halvt pasjonsfrukt på toppen.\n6. Server med et shot-glass prosecco på siden.',
    ingredients: [
      { name: 'Vodka', amount: '5', unit: 'cl' },
      { name: 'Passoa', amount: '2', unit: 'cl' },
      { name: 'Pasjonsfruktpuré', amount: '3', unit: 'cl' },
      { name: 'Vaniljesukkersirup', amount: '1', unit: 'cl' },
      { name: 'Prosecco', amount: '5', unit: 'cl' },
    ],
  });

  await insert({
    name: 'Black Russian',
    description: 'Enkel og kraftig — vodka og kaffe-likør over is. Klassikeren fra 1949.',
    image: IMG + 'p7uucu1472720107.jpg',
    category_id: 1, alcoholic: true,
    glass_type: 'Rocks-glass', garnish: '',
    instructions: '1. Fyll et rocks-glass med isbiter.\n2. Hell over vodka.\n3. Tilsett Kahlúa og rør forsiktig.',
    ingredients: [
      { name: 'Vodka', amount: '5', unit: 'cl' },
      { name: 'Kahlúa', amount: '2', unit: 'cl' },
    ],
  });

  await insert({
    name: 'White Russian',
    description: 'The Dudes drink! Black Russian med kremfløte på toppen — myk, rik og uimotståelig god.',
    image: IMG + 'esme2u1582475856.jpg',
    category_id: 1, alcoholic: true,
    glass_type: 'Rocks-glass', garnish: '',
    instructions: '1. Fyll et rocks-glass med isbiter.\n2. Hell over vodka og Kahlúa.\n3. Rør forsiktig.\n4. Hell kremfløten sakte over en skje slik at den flyter på toppen.',
    ingredients: [
      { name: 'Vodka', amount: '5', unit: 'cl' },
      { name: 'Kahlúa', amount: '2', unit: 'cl' },
      { name: 'Kremfløte', amount: '3', unit: 'cl' },
    ],
  });

  await insert({
    name: 'Lemon Drop',
    description: 'Syrlig og frisk vodka-shot/cocktail med sukkerkant. Enkelt, friskt og alltid populært.',
    image: IMG + 'slaog81504366699.jpg',
    category_id: 1, alcoholic: true,
    glass_type: 'Cocktailglass', garnish: 'Sukkerkant og sitronskive',
    instructions: '1. Fukt kanten av glasset og dypp i sukker.\n2. Fyll en shaker med is.\n3. Tilsett vodka, triple sec og sitronsaft.\n4. Rist godt.\n5. Sil over i glasset.',
    ingredients: [
      { name: 'Vodka', amount: '5', unit: 'cl' },
      { name: 'Triple sec', amount: '2', unit: 'cl' },
      { name: 'Sitronsaft', amount: '2.5', unit: 'cl' },
    ],
  });

  await insert({
    name: 'French Martini',
    description: 'Fruktfull og elegant vodka-martini med Chambord bringebærlikør og ananas. Vakker rosa farge.',
    image: IMG + '6looc01504349547.jpg',
    category_id: 1, alcoholic: true,
    glass_type: 'Cocktailglass', garnish: 'Bringebær',
    instructions: '1. Fyll en shaker med is.\n2. Tilsett vodka, Chambord og ananasjuice.\n3. Rist kraftig i 15 sekunder.\n4. Sil over i avkjølt cocktailglass.\n5. Pynt med ferske bringebær.',
    ingredients: [
      { name: 'Vodka', amount: '5', unit: 'cl' },
      { name: 'Chambord', amount: '1.5', unit: 'cl' },
      { name: 'Ananasjuice', amount: '4', unit: 'cl' },
    ],
  });

  await insert({
    name: 'Screwdriver',
    description: 'Det kan ikke bli enklere — vodka og appelsinjuice. Sagt å ha blitt laget av oljearbeidere som rørte med skrutrekkeren.',
    image: IMG + 'tqyrpw1439905311.jpg',
    category_id: 4, alcoholic: true,
    glass_type: 'Highball-glass', garnish: 'Appelsinskive',
    instructions: '1. Fyll et glass med isbiter.\n2. Hell over vodka.\n3. Fyll opp med fersk appelsinjuice.\n4. Rør forsiktig og pynt med appelsinskive.',
    ingredients: [
      { name: 'Vodka', amount: '5', unit: 'cl' },
      { name: 'Appelsinjuice', amount: '15', unit: 'cl' },
    ],
  });

  // --- Champagne/Prosecco ---
  await insert({
    name: 'Bellini',
    description: 'Harry\'s Bar i Venezias signaturdrink siden 1948. Ferskenpuré og prosecco — frisk, fruktig og festlig.',
    image: IMG + 'eosoe71699705668.jpg',
    category_id: 1, alcoholic: true,
    glass_type: 'Champagneglass', garnish: 'Ferskenbit',
    instructions: '1. Hell ferskenpuré i bunnen av et avkjølt champagneglass.\n2. Fyll forsiktig opp med kjølt prosecco.\n3. Rør én gang forsiktig.\n4. Pynt med en liten ferskenbit.',
    ingredients: [
      { name: 'Ferskenpuré', amount: '5', unit: 'cl' },
      { name: 'Prosecco', amount: '10', unit: 'cl' },
    ],
  });

  await insert({
    name: 'Kir Royale',
    description: 'Fransk aperitiff med champagne og crème de cassis. Elegant, enkel og alltid stilfull.',
    image: IMG + '6looc01504349547.jpg',
    category_id: 1, alcoholic: true,
    glass_type: 'Champagneglass', garnish: 'Friske rips',
    instructions: '1. Hell crème de cassis i bunnen av et champagneglass.\n2. Fyll forsiktig opp med kjølt champagne.\n3. Pynt med friske rips.',
    ingredients: [
      { name: 'Crème de cassis', amount: '1.5', unit: 'cl' },
      { name: 'Champagne', amount: '12', unit: 'cl' },
    ],
  });

  // --- Tequila/Mezcal ---
  await insert({
    name: 'Tommy\'s Margarita',
    description: 'Moderne margarita-klassiker fra San Francisco som bruker agavenektar i stedet for triple sec. Renere og mer tequila-fokusert.',
    image: IMG + '5noda61589575158.jpg',
    category_id: 1, alcoholic: true,
    glass_type: 'Rocks-glass', garnish: 'Limeskive og saltkant',
    instructions: '1. Fukt kanten og dypp i salt.\n2. Fyll en shaker med is.\n3. Tilsett tequila, limejuice og agavenektar.\n4. Rist godt.\n5. Sil over i glasset med is.',
    ingredients: [
      { name: 'Tequila', amount: '6', unit: 'cl' },
      { name: 'Limejuice', amount: '3', unit: 'cl' },
      { name: 'Agavenektar', amount: '2', unit: 'cl' },
    ],
  });

  await insert({
    name: 'El Diablo',
    description: 'Djevelens cocktail — tequila med solbærlikør og ingefærøl. Søtt, spicy og overraskende godt.',
    image: IMG + 'rt5huu1606769556.jpg',
    category_id: 1, alcoholic: true,
    glass_type: 'Highball-glass', garnish: 'Limeskive og kirsebær',
    instructions: '1. Fyll et highball-glass med isbiter.\n2. Tilsett tequila og limejuice.\n3. Hell over crème de cassis.\n4. Fyll opp med ingefærøl.\n5. Pynt med limeskive.',
    ingredients: [
      { name: 'Tequila', amount: '4.5', unit: 'cl' },
      { name: 'Crème de cassis', amount: '1.5', unit: 'cl' },
      { name: 'Limejuice', amount: '1.5', unit: 'cl' },
      { name: 'Ingefærøl', amount: '10', unit: 'cl' },
    ],
  });

  // --- Shots ---
  await insert({
    name: 'Kamikaze',
    description: 'Klassisk shot med vodka, triple sec og lime. Raskt, friskt og kraftig.',
    image: IMG + 'wwpqmu1472720780.jpg',
    category_id: 3, alcoholic: true,
    glass_type: 'Shotglass', garnish: 'Limeskive',
    instructions: '1. Fyll en shaker med is.\n2. Tilsett vodka, triple sec og limejuice.\n3. Rist godt.\n4. Sil over i shotglass.',
    ingredients: [
      { name: 'Vodka', amount: '2', unit: 'cl' },
      { name: 'Triple sec', amount: '2', unit: 'cl' },
      { name: 'Limejuice', amount: '2', unit: 'cl' },
    ],
  });

  await insert({
    name: 'Jagerbomb',
    description: 'Energidrikk-klassiker på fest — Jägermeister drukket i energidrikk. Kraftig og populær.',
    image: IMG + 'touyuv1483475555.jpg',
    category_id: 3, alcoholic: true,
    glass_type: 'Shotglass + pint-glass', garnish: '',
    instructions: '1. Fyll halvparten av et pint-glass med energidrikk.\n2. Hell Jägermeister i et shotglass.\n3. Slipp shotglasset ned i pint-glasset.\n4. Drikk raskt!',
    ingredients: [
      { name: 'Jägermeister', amount: '4', unit: 'cl' },
      { name: 'Energidrikk', amount: '15', unit: 'cl' },
    ],
  });

  // --- Alkoholfri ---
  await insert({
    name: 'Arnold Palmer',
    description: 'Halvt iskald te, halvt limonade — oppkalt etter golflegenden. Forfriskende og perfekt til sport og sommer.',
    image: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=800&q=80',
    category_id: 2, alcoholic: false,
    glass_type: 'Highball-glass', garnish: 'Sitronskive og mynteblader',
    instructions: '1. Brygg svart te og la det avkjøle seg.\n2. Lag enkel limonade med sitronjuice, sukkersirup og vann.\n3. Fyll et glass med is.\n4. Hell halvparten te og halvparten limonade.\n5. Rør og pynt med sitronskive.',
    ingredients: [
      { name: 'Iskald svart te', amount: '15', unit: 'cl' },
      { name: 'Sitronsaft', amount: '4', unit: 'cl' },
      { name: 'Sukkersirup', amount: '2', unit: 'cl' },
      { name: 'Vann', amount: '9', unit: 'cl' },
    ],
  });

  await insert({
    name: 'Vannmelon Limonade',
    description: 'Frisk og sommerlig alkoholfri drink med saftig vannmelon og sitron. Vakker rød farge.',
    image: 'https://images.unsplash.com/photo-1523677011781-c91d1bbe2f9e?auto=format&fit=crop&w=800&q=80',
    category_id: 2, alcoholic: false,
    glass_type: 'Highball-glass', garnish: 'Vannmelonbit og mynteblad',
    instructions: '1. Bland vannmelonbiter i en blender til glatt.\n2. Sil gjennom en sil for å fjerne frø og fruktkjøtt.\n3. Bland med sitronsaft og sukkersirup.\n4. Server over is og fyll opp med sodavann.\n5. Pynt med vannmelonbit og mynteblad.',
    ingredients: [
      { name: 'Vannmelon', amount: '300', unit: 'g' },
      { name: 'Sitronsaft', amount: '3', unit: 'cl' },
      { name: 'Sukkersirup', amount: '2', unit: 'cl' },
      { name: 'Sodavann', amount: '10', unit: 'cl' },
    ],
  });

  await insert({
    name: 'Agurk Cooler',
    description: 'Ekstremt forfriskende alkoholfri drink med agurk, mynte og lime. Spa-vann tatt til neste nivå.',
    image: 'https://images.unsplash.com/photo-1582056479830-31e7d9de91eb?auto=format&fit=crop&w=800&q=80',
    category_id: 2, alcoholic: false,
    glass_type: 'Highball-glass', garnish: 'Agurk-ribbon og mynteblad',
    instructions: '1. Blend agurk til puré og sil.\n2. Fyll et glass med knust is.\n3. Tilsett agurkmix, limejuice og sukkersirup.\n4. Fyll opp med tonic water.\n5. Rør lett og pynt med agurk og mynte.',
    ingredients: [
      { name: 'Agurk', amount: '0.5', unit: 'stk' },
      { name: 'Limejuice', amount: '3', unit: 'cl' },
      { name: 'Sukkersirup', amount: '2', unit: 'cl' },
      { name: 'Tonic water', amount: '15', unit: 'cl' },
      { name: 'Fersk mynte', amount: '5', unit: 'blader' },
    ],
  });

  // --- Smoothies ---
  await insert({
    name: 'Mango Lassi',
    description: 'Indisk klassiker med mango og yoghurt. Kremet, eksotisk og utrolig tilfredsstillende.',
    image: 'https://images.unsplash.com/photo-1527661591475-527312dd65f5?auto=format&fit=crop&w=800&q=80',
    category_id: 6, alcoholic: false,
    glass_type: 'Smoothieglass', garnish: 'Mangobit og litt kardemomme',
    instructions: '1. Ha mango, yoghurt, melk og honning i blender.\n2. Tilsett en klype kardemomme.\n3. Bland til glatt og kremaktig.\n4. Hell over glass med is.\n5. Dryss litt kardemomme og pynt med mangobit.',
    ingredients: [
      { name: 'Mango', amount: '200', unit: 'g' },
      { name: 'Gresk yoghurt', amount: '150', unit: 'g' },
      { name: 'Melk', amount: '10', unit: 'cl' },
      { name: 'Honning', amount: '1', unit: 'ss' },
      { name: 'Kardemomme', amount: '1', unit: 'klype' },
    ],
  });

  await insert({
    name: 'Blåbær Havre Smoothie',
    description: 'Mettende og næringsrik smoothie med blåbær, havre og banan. Perfekt som frokostmåltid.',
    image: 'https://images.unsplash.com/photo-1571748982800-fa51082c2224?auto=format&fit=crop&w=800&q=80',
    category_id: 6, alcoholic: false,
    glass_type: 'Smoothieglass', garnish: 'Ferske blåbær og havregryn',
    instructions: '1. Ha alle ingredienser i blender.\n2. Bland til glatt konsistens.\n3. Tilsett mer melk om den er for tykk.\n4. Hell over i glass.\n5. Pynt med blåbær og litt havregryn.',
    ingredients: [
      { name: 'Blåbær', amount: '150', unit: 'g' },
      { name: 'Banan', amount: '1', unit: 'stk' },
      { name: 'Havregryn', amount: '3', unit: 'ss' },
      { name: 'Melk', amount: '15', unit: 'cl' },
      { name: 'Honning', amount: '1', unit: 'ts' },
    ],
  });
}
