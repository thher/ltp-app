import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import { useTheme } from '../../src/context/ThemeContext';
import { useLanguage } from '../../src/context/LanguageContext';
import { Badge } from '../../src/components/ui/Badge';
import {
  lookupCocktailById,
  getIngredients,
  mapCategory,
  CocktailDbDrink,
} from '../../src/services/cocktailDbService';
import { getAllCategories } from '../../src/database';
import { createDrink } from '../../src/database/queries/drinks';

const IMAGE_HEIGHT = 300;

export default function ExploreDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { colors, spacing, typography, radius } = theme;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const db = useSQLiteContext();

  const [drink, setDrink] = useState<CocktailDbDrink | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    lookupCocktailById(id ?? '').then(d => {
      setDrink(d);
      setLoading(false);
    });
  }, [id]);

  const handleSave = useCallback(async () => {
    if (!drink || saving || saved) return;
    setSaving(true);
    try {
      const categories = await getAllCategories(db);
      const catName = mapCategory(drink.strCategory);
      const cat = categories.find(c => c.name === catName);
      const ingredients = getIngredients(drink);

      await createDrink(db, {
        name: drink.strDrink,
        description: '',
        image: drink.strDrinkThumb ?? null,
        category_id: cat?.id ?? null,
        alcoholic: drink.strAlcoholic !== 'Non alcoholic',
        glass_type: drink.strGlass ?? '',
        garnish: '',
        instructions: drink.strInstructions ?? '',
        ingredients: ingredients.map((ing, idx) => ({
          key: `ing-${idx}`,
          ingredient_id: null,
          ingredient_name: ing.name,
          amount: ing.measure,
          unit: '',
        })),
      });
      setSaved(true);
      Alert.alert('Lagret!', `${drink.strDrink} er lagt til i din samling.`);
    } catch (e) {
      Alert.alert('Feil', 'Kunne ikke lagre drinken. Prøv igjen.');
    } finally {
      setSaving(false);
    }
  }, [drink, saving, saved, db]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!drink) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={[typography.bodyMedium, { color: colors.textMuted }]}>Fant ikke drinken</Text>
      </View>
    );
  }

  const ingredients = getIngredients(drink);
  const isAlcoholic = drink.strAlcoholic !== 'Non alcoholic';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
        {/* Image */}
        <View style={{ height: IMAGE_HEIGHT }}>
          {drink.strDrinkThumb ? (
            <Image source={{ uri: drink.strDrinkThumb }} style={{ width: '100%', height: IMAGE_HEIGHT }} contentFit="cover" />
          ) : (
            <View style={{ width: '100%', height: IMAGE_HEIGHT, backgroundColor: colors.surfaceElevated }} />
          )}
          <LinearGradient
            colors={['transparent', colors.background]}
            style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 120 }}
          />
        </View>

        {/* Back button */}
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            position: 'absolute',
            top: insets.top + spacing.sm,
            left: spacing.base,
            width: 40, height: 40, borderRadius: 20,
            backgroundColor: 'rgba(0,0,0,0.5)',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>

        <View style={{ paddingHorizontal: spacing.base, marginTop: -spacing.lg }}>
          {/* Title row */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: spacing.sm }}>
            <Text style={[typography.displaySmall, { color: colors.text, flex: 1, marginRight: spacing.sm }]}>
              {drink.strDrink}
            </Text>
            <Badge label={isAlcoholic ? 'Alkohol' : 'Alkoholfri'} variant={isAlcoholic ? 'alcoholic' : 'nonAlcoholic'} />
          </View>

          {/* Meta */}
          <View style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xl }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <Ionicons name="wine-outline" size={14} color={colors.textMuted} />
              <Text style={[typography.labelSmall, { color: colors.textMuted }]}>{mapCategory(drink.strCategory)}</Text>
            </View>
            {drink.strGlass ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                <Ionicons name="beer-outline" size={14} color={colors.textMuted} />
                <Text style={[typography.labelSmall, { color: colors.textMuted }]}>{drink.strGlass}</Text>
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <Ionicons name="globe-outline" size={14} color={colors.primary} />
              <Text style={[typography.labelSmall, { color: colors.primary }]}>thecocktaildb</Text>
            </View>
          </View>

          {/* Ingredients */}
          <Text style={[typography.headlineSmall, { color: colors.text, marginBottom: spacing.md }]}>
            Ingredienser
          </Text>
          {ingredients.map((ing, i) => (
            <View
              key={i}
              style={{
                flexDirection: 'row', justifyContent: 'space-between',
                paddingVertical: spacing.sm,
                borderBottomWidth: 1, borderBottomColor: colors.borderSubtle,
              }}
            >
              <Text style={[typography.bodyMedium, { color: colors.text }]}>{ing.name}</Text>
              {ing.measure ? (
                <Text style={[typography.bodyMedium, { color: colors.textSecondary }]}>{ing.measure}</Text>
              ) : null}
            </View>
          ))}

          {/* Instructions */}
          {drink.strInstructions ? (
            <>
              <Text style={[typography.headlineSmall, { color: colors.text, marginTop: spacing.xl, marginBottom: spacing.md }]}>
                Slik gjør du det
              </Text>
              <Text style={[typography.bodyMedium, { color: colors.textSecondary, lineHeight: 24 }]}>
                {drink.strInstructions}
              </Text>
            </>
          ) : null}
        </View>
      </ScrollView>

      {/* Save button */}
      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: spacing.base, paddingBottom: insets.bottom + spacing.base,
        backgroundColor: colors.background,
        borderTopWidth: 1, borderTopColor: colors.borderSubtle,
      }}>
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving || saved}
          style={{
            backgroundColor: saved ? colors.success ?? '#22c55e' : colors.primary,
            borderRadius: radius.md,
            paddingVertical: spacing.md,
            alignItems: 'center', justifyContent: 'center',
            flexDirection: 'row', gap: spacing.sm,
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Ionicons name={saved ? 'checkmark-circle' : 'add-circle-outline'} size={20} color="#fff" />
          )}
          <Text style={[typography.labelLarge, { color: '#fff' }]}>
            {saved ? 'Lagret i din samling!' : 'Lagre til min samling'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
