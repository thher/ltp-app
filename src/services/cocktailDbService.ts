const BASE = 'https://www.thecocktaildb.com/api/json/v1/1';

export interface CocktailDbDrink {
  idDrink: string;
  strDrink: string;
  strDrinkThumb: string | null;
  strCategory: string;
  strAlcoholic: string;
  strGlass: string;
  strInstructions: string;
  strInstructionsNO?: string | null;
  [key: string]: string | null | undefined;
}

export interface CocktailDbIngredient {
  name: string;
  measure: string;
}

export function getIngredients(drink: CocktailDbDrink): CocktailDbIngredient[] {
  const result: CocktailDbIngredient[] = [];
  for (let i = 1; i <= 15; i++) {
    const name = drink[`strIngredient${i}`];
    if (!name) break;
    result.push({
      name: name.trim(),
      measure: (drink[`strMeasure${i}`] ?? '').trim(),
    });
  }
  return result;
}

export function mapCategory(strCategory: string): string {
  switch (strCategory) {
    case 'Cocktail':            return 'Cocktail';
    case 'Shot':                return 'Shot';
    case 'Punch / Party Drink': return 'Punch';
    case 'Beer':                return 'Longdrink';
    case 'Ordinary Drink':      return 'Longdrink';
    case 'Soft Drink':          return 'Alkoholfri';
    case 'Coffee / Tea':        return 'Annet';
    default:                    return 'Cocktail';
  }
}

async function fetchJson(url: string) {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`CocktailDB ${res.status}`);
  return res.json();
}

export async function searchCocktailDb(query: string): Promise<CocktailDbDrink[]> {
  if (!query.trim()) return [];
  try {
    const data = await fetchJson(`${BASE}/search.php?s=${encodeURIComponent(query)}`);
    return (data?.drinks as CocktailDbDrink[]) ?? [];
  } catch {
    return [];
  }
}

export async function lookupCocktailById(id: string): Promise<CocktailDbDrink | null> {
  try {
    const data = await fetchJson(`${BASE}/lookup.php?i=${id}`);
    return (data?.drinks?.[0] as CocktailDbDrink) ?? null;
  } catch {
    return null;
  }
}

export async function getRandomCocktails(count = 8): Promise<CocktailDbDrink[]> {
  const results: CocktailDbDrink[] = [];
  const seen = new Set<string>();
  const promises = Array.from({ length: count * 2 }).map(() =>
    fetchJson(`${BASE}/random.php`).then(d => d?.drinks?.[0] as CocktailDbDrink).catch(() => null)
  );
  const all = await Promise.allSettled(promises);
  for (const r of all) {
    if (r.status === 'fulfilled' && r.value && !seen.has(r.value.idDrink)) {
      seen.add(r.value.idDrink);
      results.push(r.value);
      if (results.length >= count) break;
    }
  }
  return results;
}
