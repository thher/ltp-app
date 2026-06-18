import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/context/ThemeContext';
import { useLanguage } from '../../src/context/LanguageContext';
import { useDrinks } from '../../src/hooks/useDrinks';
import { useFavorites } from '../../src/hooks/useFavorites';
import { SearchBar } from '../../src/components/search/SearchBar';
import { DrinkCard } from '../../src/components/drinks/DrinkCard';
import { CategoryPill } from '../../src/components/categories/CategoryPill';
import { Empty } from '../../src/components/ui/Empty';
import { LoadingSpinner } from '../../src/components/ui/LoadingSpinner';
import { Drink, FilterCategory } from '../../src/types';

const FILTER_CATEGORIES: { key: FilterCategory; labelKey: string }[] = [
  { key: 'all', labelKey: 'allDrinks' },
  { key: 'alcoholic', labelKey: 'alcoholic' },
  { key: 'non-alcoholic', labelKey: 'nonAlcoholic' },
  { key: 'favorites', labelKey: 'favorites' },
  { key: 'my-drinks', labelKey: 'myDrinks' },
];

export default function DrinksScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { colors, spacing, typography, radius } = theme;
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('all');
  const [displayedDrinks, setDisplayedDrinks] = useState<Drink[]>([]);

  const { drinks, loading, fetchDrinks, search } = useDrinks();
  const { favoriteIds, fetchFavoriteIds, toggleFavorite, checkIsFavorite } = useFavorites();

  useEffect(() => {
    fetchDrinks(activeFilter);
    fetchFavoriteIds();
  }, [activeFilter]);

  useEffect(() => {
    if (searchQuery.trim().length >= 2) {
      search(searchQuery).then(setDisplayedDrinks);
    } else {
      setDisplayedDrinks(drinks);
    }
  }, [searchQuery, drinks]);

  const handleFavorite = useCallback(async (drink: Drink) => {
    await toggleFavorite(drink.id);
    if (activeFilter === 'favorites') fetchDrinks('favorites');
  }, [toggleFavorite, activeFilter]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
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
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
          <Text style={[typography.headlineLarge, { color: colors.text, flex: 1 }]}>
            {t.drinks.title}
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/drink/add')}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.primary,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              borderRadius: radius.md,
              gap: spacing.xs,
            }}
          >
            <Ionicons name="add" size={20} color={colors.textInverse} />
            <Text style={[typography.labelMedium, { color: colors.textInverse }]}>Ny</Text>
          </TouchableOpacity>
        </View>

        <SearchBar
          placeholder={t.home.searchPlaceholder}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />

        <View style={{ marginTop: spacing.md }}>
          <FlatList
            data={FILTER_CATEGORIES}
            keyExtractor={(item) => item.key}
            horizontal
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <CategoryPill
                label={t.home[item.labelKey as keyof typeof t.home] as string}
                value={item.key}
                selected={activeFilter === item.key}
                onPress={(v) => { setActiveFilter(v); setSearchQuery(''); }}
              />
            )}
          />
        </View>
      </View>

      {/* List */}
      {loading ? (
        <LoadingSpinner fullScreen />
      ) : displayedDrinks.length === 0 ? (
        <Empty
          icon="wine-outline"
          title={t.drinks.noDrinks}
          description={t.drinks.noDrinksDesc}
        />
      ) : (
        <FlatList
          data={displayedDrinks}
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
