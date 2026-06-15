import { useState, useCallback } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { InventoryItem } from '../types';
import {
  getInventory,
  addToInventory,
  removeFromInventory,
  getInventoryIngredientIds,
} from '../database';
import { createIngredient } from '../database/queries/ingredients';

export function useInventory() {
  const db = useSQLiteContext();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [inventoryIds, setInventoryIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    try {
      const items = await getInventory(db);
      setInventory(items);
      const ids = items.map(i => i.ingredient_id);
      setInventoryIds(new Set(ids));
    } finally {
      setLoading(false);
    }
  }, [db]);

  const addIngredient = useCallback(async (name: string): Promise<void> => {
    const id = await createIngredient(db, name);
    await addToInventory(db, id);
    await fetchInventory();
  }, [db, fetchInventory]);

  const removeIngredient = useCallback(async (ingredientId: number): Promise<void> => {
    await removeFromInventory(db, ingredientId);
    setInventory(prev => prev.filter(i => i.ingredient_id !== ingredientId));
    setInventoryIds(prev => {
      const next = new Set(prev);
      next.delete(ingredientId);
      return next;
    });
  }, [db]);

  return {
    inventory,
    inventoryIds,
    loading,
    fetchInventory,
    addIngredient,
    removeIngredient,
  };
}
