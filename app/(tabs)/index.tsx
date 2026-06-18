import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useSQLiteContext } from 'expo-sqlite';
import { useTheme } from '../../src/context/ThemeContext';
import { useLanguage } from '../../src/context/LanguageContext';
import { useDrinks } from '../../src/hooks/useDrinks';
import { useFavorites } from '../../src/hooks/useFavorites';
import { SearchBar } from '../../src/components/search/SearchBar';
import { DrinkCard } from '../../src/components/drinks/DrinkCard';
import { CategoryPill } from '../../src/components/categories/CategoryPill';
import { LoadingSpinner } from '../../src/components/ui/LoadingSpinner';
import { Drink, FilterCategory } from '../../src/types';
import { refreshImagesFromCocktailDB } from '../../src/services/seedService';
import { getRandomCocktails, CocktailDbDrink } from '../../src/services/cocktailDbService';

const CATEGORIES: { key: FilterCategory; labelKey: string }[] = [
  { key: 'all', labelKey: 'allDrinks' },
  { key: 'alcoholic', labelKey: 'alcoholic' },
  { key: 'non-alcoholic', labelKey: 'nonAlcoholic' },
  { key: 'favorites', labelKey: 'favorites' },
  { key: 'my-drinks', labelKey: 'myDrinks' },
];

export default function HomeScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { colors, spacing, typography, radius } = theme;
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('all');
  const [searchResults, setSearchResults] = useState<Drink[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [exploreDrinks, setExploreDrinks] = useState<CocktailDbDrink[]>([]);

  const db = useSQLiteContext();
  const { drinks, loading, fetchDrinks, search } = useDrinks();
  const { favoriteIds, fetchFavoriteIds, toggleFavorite, checkIsFavorite } = useFavorites();

  useEffect(() => {
    fetchDrinks(activeFilter);
    fetchFavoriteIds();
  }, [activeFilter]);

  // Refresh missing images in background, then re-fetch to show them
  useEffect(() => {
    refreshImagesFromCocktailDB(db)
      .then(() => fetchDrinks('all'))
      .catch(() => {});
    // Load random cocktails for Explore section
    getRandomCocktails(8).then(setExploreDrinks).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (query.trim().length >= 2) {
      setIsSearching(true);
      const results = await search(query);
      setSearchResults(results);
    } else {
      setIsSearching(false);
      setSearchResults([]);
    }
  }, [search]);

  const handleFavorite = useCallback(async (drink: Drink) => {
    await toggleFavorite(drink.id);
    if (activeFilter === 'favorites') {
      fetchDrinks('favorites');
    }
  }, [toggleFavorite, activeFilter, fetchDrinks]);

  const displayedDrinks = isSearching ? searchResults : drinks;
  const recentDrinks = drinks.slice(0, 3);
  const featuredDrinks = drinks.slice(0, 5);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
      >
        {/* Hero Header */}
        <LinearGradient
          colors={[colors.surfaceElevated, colors.background]}
          style={{
            paddingTop: insets.top + spacing.lg,
            paddingHorizontal: spacing.base,
            paddingBottom: spacing.xl,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
            <View>
              <Text style={[typography.displaySmall, { color: colors.primary }]}>
                {t.home.title}
              </Text>
              <Text style={[typography.bodyMedium, { color: colors.textSecondary }]}>
                {t.home.subtitle}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push('/drink/add')}
              style={{
                width: 48,
                height: 48,
                borderRadius: radius.full,
                backgroundColor: colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="add" size={28} color={colors.textInverse} />
            </TouchableOpacity>
          </View>

          <SearchBar
            placeholder={t.home.searchPlaceholder}
            value={searchQuery}
            onChangeText={handleSearch}
            onFocus={() => router.push('/search')}
          />
        </LinearGradient>

        {/* Category Filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.base, paddingBottom: spacing.md }}
        >
          {CATEGORIES.map((cat) => (
            <CategoryPill
              key={cat.key}
              label={t.home[cat.labelKey as keyof typeof t.home] as string}
              value={cat.key}
              selected={activeFilter === cat.key}
              onPress={(v) => { setActiveFilter(v); setIsSearching(false); setSearchQuery(''); }}
            />
          ))}
        </ScrollView>

        {/* Loading */}
        {loading && (
          <View style={{ alignItems: 'center', paddingVertical: spacing.xxl }}>
            <LoadingSpinner />
          </View>
        )}

        {/* Search Results or Drink List */}
        {!loading && (
          <View style={{ paddingHorizontal: spacing.base }}>
            {isSearching ? (
              <>
                <Text style={[typography.titleMedium, { color: colors.textSecondary, marginBottom: spacing.md }]}>
                  {searchResults.length} {t.search.results}
                </Text>
                {searchResults.map((drink) => (
                  <DrinkCard
                    key={drink.id}
                    drink={drink}
                    onPress={(d) => router.push(`/drink/${d.id}`)}
                    onFavoritePress={handleFavorite}
                    isFavorite={checkIsFavorite(drink.id)}
                  />
                ))}
              </>
            ) : (
              <>
                {/* Featured Section */}
                {featuredDrinks.length > 0 && activeFilter === 'all' && (
                  <View style={{ marginBottom: spacing.xl }}>
                    <Text style={[typography.headlineSmall, { color: colors.text, marginBottom: spacing.md }]}>
                      {t.home.recentlyAdded}
                    </Text>
                    {recentDrinks.map((drink) => (
                      <DrinkCard
                        key={drink.id}
                        drink={drink}
                        onPress={(d) => router.push(`/drink/${d.id}`)}
                        onFavoritePress={handleFavorite}
                        isFavorite={checkIsFavorite(drink.id)}
                      />
                    ))}
                  </View>
                )}

                {/* All/filtered drinks */}
                {(activeFilter !== 'all' || drinks.length > 3) && (
                  <View>
                    {activeFilter !== 'all' && (
                      <Text style={[typography.headlineSmall, { color: colors.text, marginBottom: spacing.md }]}>
                        {drinks.length} {t.search.results}
                      </Text>
                    )}
                    {(activeFilter !== 'all' ? drinks : drinks.slice(3)).map((drink) => (
                      <DrinkCard
                        key={drink.id}
                        drink={drink}
                        onPress={(d) => router.push(`/drink/${d.id}`)}
                        onFavoritePress={handleFavorite}
                        isFavorite={checkIsFavorite(drink.id)}
                      />
                    ))}
                  </View>
                )}

                {/* Explore section — random drinks from thecocktaildb */}
                {activeFilter === 'all' && exploreDrinks.length > 0 && (
                  <View style={{ marginTop: spacing.xl }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
                      <Ionicons name="globe-outline" size={18} color={colors.primary} />
                      <Text style={[typography.headlineSmall, { color: colors.text }]}>
                        Utforsk nye drinker
                      </Text>
                    </View>
                    <Text style={[typography.bodySmall, { color: colors.textMuted, marginBottom: spacing.md }]}>
                      Fra thecocktaildb · Trykk for å legge til i din samling
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -spacing.base }}>
                      <View style={{ flexDirection: 'row', paddingHorizontal: spacing.base, gap: spacing.md }}>
                        {exploreDrinks.map(d => (
                          <TouchableOpacity
                            key={d.idDrink}
                            onPress={() => router.push(`/explore/${d.idDrink}`)}
                            activeOpacity={0.85}
                            style={{
                              width: 150,
                              backgroundColor: colors.surface,
                              borderRadius: radius.lg,
                              overflow: 'hidden',
                              borderWidth: 1,
                              borderColor: colors.borderSubtle,
                            }}
                          >
                            {d.strDrinkThumb ? (
                              <Image
                                source={{ uri: d.strDrinkThumb + '/preview' }}
                                style={{ width: 150, height: 110 }}
                                contentFit="cover"
                              />
                            ) : (
                              <View style={{ width: 150, height: 110, backgroundColor: colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' }}>
                                <Ionicons name="wine-outline" size={36} color={colors.textMuted} />
                              </View>
                            )}
                            <View style={{ padding: spacing.sm }}>
                              <Text style={[typography.labelMedium, { color: colors.text }]} numberOfLines={2}>
                                {d.strDrink}
                              </Text>
                              <Text style={[typography.labelSmall, { color: colors.textMuted, marginTop: spacing.xxs }]} numberOfLines={1}>
                                {d.strCategory}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>
                  </View>
                )}

                {/* Empty state */}
                {drinks.length === 0 && (
                  <View style={{ alignItems: 'center', paddingTop: spacing.massive }}>
                    <Ionicons name="wine-outline" size={80} color={colors.textMuted} />
                    <Text style={[typography.headlineSmall, { color: colors.textSecondary, marginTop: spacing.lg, textAlign: 'center' }]}>
                      {activeFilter === 'favorites' ? t.favorites.noFavorites : t.drinks.noDrinks}
                    </Text>
                    <Text style={[typography.bodyMedium, { color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center' }]}>
                      {activeFilter === 'favorites' ? t.favorites.noFavoritesDesc : t.drinks.noDrinksDesc}
                    </Text>
                    <TouchableOpacity
                      onPress={() => router.push('/drink/add')}
                      style={{
                        marginTop: spacing.xl,
                        backgroundColor: colors.primary,
                        paddingHorizontal: spacing.xl,
                        paddingVertical: spacing.md,
                        borderRadius: radius.md,
                      }}
                    >
                      <Text style={[typography.labelLarge, { color: colors.textInverse }]}>
                        + {t.drinks.addDrink}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
