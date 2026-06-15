import { useState, useCallback } from 'react';
import { View, Text, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native';
import { useTheme } from '../src/context/ThemeContext';
import { useLanguage } from '../src/context/LanguageContext';
import { useDrinks } from '../src/hooks/useDrinks';
import { useFavorites } from '../src/hooks/useFavorites';
import { SearchBar } from '../src/components/search/SearchBar';
import { DrinkCard } from '../src/components/drinks/DrinkCard';
import { Empty } from '../src/components/ui/Empty';
import { Drink } from '../src/types';

export default function SearchScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { colors, spacing, typography } = theme;
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Drink[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const { search } = useDrinks();
  const { favoriteIds, fetchFavoriteIds, toggleFavorite, checkIsFavorite } = useFavorites();

  const handleSearch = useCallback(async (text: string) => {
    setQuery(text);
    if (text.trim().length >= 1) {
      const data = await search(text);
      setResults(data);
      setHasSearched(true);
    } else {
      setResults([]);
      setHasSearched(false);
    }
  }, [search]);

  const handleFavorite = useCallback(async (drink: Drink) => {
    await toggleFavorite(drink.id);
    await fetchFavoriteIds();
  }, [toggleFavorite, fetchFavoriteIds]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={{
          paddingTop: insets.top + spacing.sm,
          paddingHorizontal: spacing.base,
          paddingBottom: spacing.md,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.borderSubtle,
        }}
      >
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

      {hasSearched && (
        <Text
          style={[
            typography.bodySmall,
            { color: colors.textMuted, paddingHorizontal: spacing.base, paddingVertical: spacing.sm },
          ]}
        >
          {results.length} {t.search.results}
        </Text>
      )}

      {hasSearched && results.length === 0 ? (
        <Empty
          icon="search-outline"
          title={t.search.noResults}
          description={t.search.noResultsDesc}
        />
      ) : (
        <FlatList
          data={results}
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
