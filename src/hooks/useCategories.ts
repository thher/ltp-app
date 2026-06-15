import { useState, useCallback } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { Category } from '../types';
import { getAllCategories } from '../database';

export function useCategories() {
  const db = useSQLiteContext();
  const [categories, setCategories] = useState<Category[]>([]);

  const fetchCategories = useCallback(async () => {
    const data = await getAllCategories(db);
    setCategories(data);
  }, [db]);

  return { categories, fetchCategories };
}
