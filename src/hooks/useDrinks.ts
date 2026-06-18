import { useState, useCallback } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { Drink, DrinkWithIngredients, DrinkFormData, FilterCategory } from '../types';
import {
  getAllDrinks,
  getDrinkById,
  searchDrinks,
  createDrink,
  updateDrink,
  deleteDrink,
} from '../database';

export function useDrinks() {
  const db = useSQLiteContext();
  const [drinks, setDrinks] = useState<Drink[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDrinks = useCallback(async (filter: FilterCategory = 'all') => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAllDrinks(db, filter);
      setDrinks(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [db]);

  const getDrink = useCallback(async (id: number): Promise<DrinkWithIngredients | null> => {
    try {
      return await getDrinkById(db, id);
    } catch {
      return null;
    }
  }, [db]);

  const search = useCallback(async (query: string): Promise<Drink[]> => {
    if (!query.trim()) return [];
    try {
      return await searchDrinks(db, query);
    } catch {
      return [];
    }
  }, [db]);

  const addDrink = useCallback(async (data: DrinkFormData): Promise<number> => {
    const id = await createDrink(db, data);
    await fetchDrinks();
    return id;
  }, [db, fetchDrinks]);

  const editDrink = useCallback(async (id: number, data: DrinkFormData): Promise<void> => {
    await updateDrink(db, id, data);
    await fetchDrinks();
  }, [db, fetchDrinks]);

  const removeDrink = useCallback(async (id: number): Promise<void> => {
    await deleteDrink(db, id);
    setDrinks(prev => prev.filter(d => d.id !== id));
  }, [db]);

  return {
    drinks,
    loading,
    error,
    fetchDrinks,
    getDrink,
    search,
    addDrink,
    editDrink,
    removeDrink,
  };
}
