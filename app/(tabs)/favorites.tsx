import { useEffect, useCallback } from 'react';
import { View, Text, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/context/ThemeContext';
import { useLanguage } from '../../src/context/LanguageContext';
import { useDrinks } from '../../src/hooks/useDrinks';
import { useFavorites } from '../../src/hooks/useFavorites';
import { DrinkCard } from '../../src/components/drinks/DrinkCard';
import { Empty } from '../../src/components/ui/Empty';
import { LoadingSpinner } from '../../src/components/ui/LoadingSpinner';
import { Drink } from '../../src/types';

export default function FavoritesScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { colors, spacing, typography } = theme;
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { drinks, loading, fetchDrinks } = useDrinks();
  const { fetchFavoriteIds, toggleFavorite, checkIsFavorite } = useFavorites();

  useEffect(() => {
    fetchDrinks('favorites');
    fetchFavoriteIds();
  }, []);

  const handleFavorite = useCallback(async (drink: Drink) => {
    await toggleFavorite(drink.id);
    fetchDrinks('favorites');
  }, [toggleFavorite, fetchDrinks]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={{
          paddingTop: insets.top + spacing.md,
          paddingHorizontal: spacing.base,
          paddingBottom: spacing.md,
          backgroundColor: colors.background,
          borderBottomWidth: 1,
          borderBottomColor: colors.borderSubtle,
        }}
      >
        <Text style={[typography.headlineLarge, { color: colors.text }]}>
          {t.favorites.title}
        </Text>
        {drinks.length > 0 && (
          <Text style={[typography.bodyMedium, { color: colors.textMuted, marginTop: spacing.xs }]}>
            {drinks.length} {t.search.results}
          </Text>
        )}
      </View>

      {loading ? (
        <LoadingSpinner fullScreen />
      ) : drinks.length === 0 ? (
        <Empty
          icon="heart-outline"
          title={t.favorites.noFavorites}
          description={t.favorites.noFavoritesDesc}
        />
      ) : (
        <FlatList
          data={drinks}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <DrinkCard
              drink={item}
              onPress={(d) => router.push(`/drink/${d.id}`)}
              onFavoritePress={handleFavorite}
              isFavorite={checkIsFavorite(item.id)}
            />
          )}
          contentContainerStyle={{
            padding: spacing.base,
            paddingBottom: insets.bottom + spacing.xl,
          }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}
