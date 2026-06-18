import { DrinkWithIngredients, DrinkMatch } from '../types';

export function calculateDrinkMatches(
  drinks: DrinkWithIngredients[],
  inventoryIngredientIds: Set<number>
): DrinkMatch[] {
  const matches: DrinkMatch[] = [];

  for (const drink of drinks) {
    if (drink.ingredients.length === 0) continue;

    const totalCount = drink.ingredients.length;
    let availableCount = 0;
    const missingIngredients: string[] = [];

    for (const ingredient of drink.ingredients) {
      if (inventoryIngredientIds.has(ingredient.ingredient_id)) {
        availableCount++;
      } else {
        missingIngredients.push(ingredient.ingredient_name);
      }
    }

    const matchPercent = Math.round((availableCount / totalCount) * 100);

    matches.push({
      drink,
      matchPercent,
      missingIngredients,
      availableCount,
      totalCount,
    });
  }

  return matches.sort((a, b) => {
    if (b.matchPercent !== a.matchPercent) return b.matchPercent - a.matchPercent;
    return a.missingIngredients.length - b.missingIngredients.length;
  });
}

export function filterMatchesByThreshold(
  matches: DrinkMatch[],
  minPercent: number
): DrinkMatch[] {
  return matches.filter(m => m.matchPercent >= minPercent);
}
