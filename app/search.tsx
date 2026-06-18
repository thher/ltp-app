import { useState, useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useTheme } from '../src/context/ThemeContext';
import { useLanguage } from '../src/context/LanguageContext';
import { useDrinks } from '../src/hooks/useDrinks';
import { useFavorites } from '../src/hooks/useFavorites';
import { SearchBar } from '../src/components/search/SearchBar';
import { DrinkCard } from '../src/components/drinks/DrinkCard';
import { Empty } from '../src/components/ui/Empty';
import { Drink } from '../src/types';
import { searchCocktailDb, CocktailDbDrink } from '../src/services/cocktailDbService';

export default function SearchScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { colors, spacing, typography, radius } = theme;
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [query, setQuery] = useState('');
  const [localResults, setLocalResults] = useState<Drink[]>([]);
  const [onlineResults, setOnlineResults] = useState<CocktailDbDrink[]>([]);
  const [loadingOnline, setLoadingOnline] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const { search } = useDrinks();
  const { favoriteIds, fetchFavoriteIds, toggleFavorite, checkIsFavorite } = useFavorites();

  const handleSearch = useCallback(async (text: string) => {
    setQuery(text);
    if (text.trim().length >= 2) {
      setHasSearched(true);
      // Local search (instant)
      const local = await search(text);
      setLocalResults(local);
      // Online search (async)
      setLoadingOnline(true);
      searchCocktailDb(text).then(online => {
        // Filter out drinks already in local results
        const localNames = new Set(local.map(d => d.name.toLowerCase()));
        setOnlineResults(online.filter(d => !localNames.has(d.strDrink.toLowerCase())));
        setLoadingOnline(false);
      });
    } else {
      setLocalResults([]);
      setOnlineResults([]);
      setLoadingOnline(false);
      setHasSearched(false);
    }
  }, [search]);

  const handleFavorite = useCallback(async (drink: Drink) => {
    await toggleFavorite(drink.id);
    await fetchFavoriteIds();
  }, [toggleFavorite, fetchFavoriteIds]);

  const totalCount = localResults.length + onlineResults.length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Search bar */}
      <View style={{
        paddingTop: insets.top + spacing.sm,
        paddingHorizontal: spacing.base,
        paddingBottom: spacing.md,
        flexDirection: 'row', alignItems: 'center', gap: spacing.md,
        borderBottomWidth: 1, borderBottomColor: colors.borderSubtle,
      }}>
        <View style={{ flex: 1 }}>
          <SearchBar
            placeholder={t.search.placeholder}
            value={query}
            onChangeText={handleSearch}
            autoFocus
          />
        </View>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[typography.bodyMedium, { color: colors.primary }]}>{t.common.cancel}</Text>
        </TouchableOpacity>
      </View>

      {/* Result count */}
      {hasSearched && (
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.base, paddingVertical: spacing.sm }}>
          <Text style={[typography.bodySmall, { color: colors.textMuted }]}>
            {totalCount} {t.search.results}
          </Text>
          {loadingOnline && (
            <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: spacing.sm }} />
          )}
        </View>
      )}

      {hasSearched && totalCount === 0 && !loadingOnline ? (
        <Empty icon="search-outline" title={t.search.noResults} description={t.search.noResultsDesc} />
      ) : (
        <FlatList
          data={[]}
          renderItem={null}
          ListHeaderComponent={
            <>
              {/* Local results */}
              {localResults.length > 0 && (
                <View style={{ paddingHorizontal: spacing.base, paddingTop: spacing.sm }}>
                  {localResults.map(item => (
                    <DrinkCard
                      key={item.id}
                      drink={item}
                      onPress={d => router.push(`/drink/${d.id}`)}
                      onFavoritePress={handleFavorite}
                      isFavorite={checkIsFavorite(item.id)}
                    />
                  ))}
                </View>
              )}

              {/* Online results header */}
              {onlineResults.length > 0 && (
                <View style={{ paddingHorizontal: spacing.base, paddingTop: spacing.lg }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
                    <Ionicons name="globe-outline" size={16} color={colors.primary} />
                    <Text style={[typography.headlineSmall, { color: colors.text }]}>
                      Fra thecocktaildb
                    </Text>
                  </View>
                  {onlineResults.map(item => (
                    <OnlineDrinkCard
                      key={item.idDrink}
                      drink={item}
                      onPress={() => router.push(`/explore/${item.idDrink}`)}
                      colors={colors}
                      spacing={spacing}
                      typography={typography}
                      radius={radius}
                    />
                  ))}
                </View>
              )}
            </>
          }
          contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
          showsVerticalScrollIndicator={false}
          keyExtractor={() => 'header'}
        />
      )}
    </View>
  );
}

function OnlineDrinkCard({ drink, onPress, colors, spacing, typography, radius }: {
  drink: CocktailDbDrink;
  onPress: () => void;
  colors: any; spacing: any; typography: any; radius: any;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        marginBottom: spacing.md,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        flexDirection: 'row',
      }}
    >
      {drink.strDrinkThumb ? (
        <Image
          source={{ uri: drink.strDrinkThumb + '/preview' }}
          style={{ width: 90, height: 90 }}
          contentFit="cover"
        />
      ) : (
        <View style={{ width: 90, height: 90, backgroundColor: colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="wine-outline" size={32} color={colors.textMuted} />
        </View>
      )}
      <View style={{ flex: 1, padding: spacing.md, justifyContent: 'center' }}>
        <Text style={[typography.titleMedium, { color: colors.text }]} numberOfLines={1}>
          {drink.strDrink}
        </Text>
        <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: spacing.xxs }]}>
          {drink.strCategory} · {drink.strAlcoholic === 'Non alcoholic' ? 'Alkoholfri' : 'Alkohol'}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs }}>
          <Ionicons name="add-circle-outline" size={14} color={colors.primary} />
          <Text style={[typography.labelSmall, { color: colors.primary }]}>Trykk for å legge til</Text>
        </View>
      </View>
      <View style={{ justifyContent: 'center', paddingRight: spacing.md }}>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </View>
    </TouchableOpacity>
  );
}
