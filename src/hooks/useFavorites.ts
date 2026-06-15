import { useState, useCallback } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { addFavorite, removeFavorite, getAllFavoriteIds } from '../database';

export function useFavorites() {
  const db = useSQLiteContext();
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());

  const fetchFavoriteIds = useCallback(async () => {
    const ids = await getAllFavoriteIds(db);
    setFavoriteIds(new Set(ids));
  }, [db]);

  const toggleFavorite = useCallback(async (drinkId: number): Promise<boolean> => {
    const isFav = favoriteIds.has(drinkId);
    if (isFav) {
      await removeFavorite(db, drinkId);
      setFavoriteIds(prev => {
        const next = new Set(prev);
        next.delete(drinkId);
        return next;
      });
      return false;
    } else {
      await addFavorite(db, drinkId);
      setFavoriteIds(prev => new Set(prev).add(drinkId));
      return true;
    }
  }, [db, favoriteIds]);

  const checkIsFavorite = useCallback((drinkId: number): boolean => {
    return favoriteIds.has(drinkId);
  }, [favoriteIds]);

  return { favoriteIds, fetchFavoriteIds, toggleFavorite, checkIsFavorite };
}
