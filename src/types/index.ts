export interface Category {
  id: number;
  name: string;
  name_en: string;
  icon: string;
  created_at: string;
}

export interface Ingredient {
  id: number;
  name: string;
  created_at: string;
}

export interface DrinkIngredient {
  id: number;
  drink_id: number;
  ingredient_id: number;
  ingredient_name: string;
  amount: string;
  unit: string;
}

export interface Drink {
  id: number;
  name: string;
  description: string;
  image: string | null;
  category_id: number | null;
  category_name: string | null;
  alcoholic: number;
  glass_type: string;
  garnish: string;
  instructions: string;
  is_user_created: number;
  is_favorite: number;
  created_at: string;
  updated_at: string;
}

export interface DrinkWithIngredients extends Drink {
  ingredients: DrinkIngredient[];
}

export interface DrinkFormData {
  name: string;
  description: string;
  image: string | null;
  category_id: number | null;
  alcoholic: boolean;
  glass_type: string;
  garnish: string;
  instructions: string;
  ingredients: IngredientFormItem[];
}

export interface IngredientFormItem {
  key: string;
  ingredient_id: number | null;
  ingredient_name: string;
  amount: string;
  unit: string;
}

export interface InventoryItem {
  id: number;
  ingredient_id: number;
  ingredient_name: string;
  created_at: string;
}

export interface DrinkMatch {
  drink: Drink;
  matchPercent: number;
  missingIngredients: string[];
  availableCount: number;
  totalCount: number;
}

export type FilterCategory = 'all' | 'alcoholic' | 'non-alcoholic' | 'favorites' | 'my-drinks';

export type Language = 'nb' | 'en';

export type ColorScheme = 'dark' | 'light';
