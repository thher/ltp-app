import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../src/context/ThemeContext';
import { useLanguage } from '../../src/context/LanguageContext';
import { useDrinks } from '../../src/hooks/useDrinks';
import { useFavorites } from '../../src/hooks/useFavorites';
import { useInventory } from '../../src/hooks/useInventory';
import { IngredientItem } from '../../src/components/drinks/IngredientItem';
import { Badge } from '../../src/components/ui/Badge';
import { LoadingSpinner } from '../../src/components/ui/LoadingSpinner';
import { DrinkWithIngredients } from '../../src/types';

const IMAGE_HEIGHT = 320;

export default function DrinkDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { colors, spacing, typography, radius } = theme;
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [drink, setDrink] = useState<DrinkWithIngredients | null>(null);
  const [loading, setLoading] = useState(true);

  const { getDrink, removeDrink } = useDrinks();
  const { favoriteIds, fetchFavoriteIds, toggleFavorite } = useFavorites();
  const { inventoryIds, fetchInventory } = useInventory();

  const drinkId = parseInt(id ?? '0', 10);
  const isFav = favoriteIds.has(drinkId);

  useEffect(() => {
    loadDrink();
    fetchFavoriteIds();
    fetchInventory();
  }, [id]);

  const loadDrink = useCallback(async () => {
    setLoading(true);
    const data = await getDrink(drinkId);
    setDrink(data);
    setLoading(false);
  }, [drinkId]);

  const handleFavorite = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await toggleFavorite(drinkId);
  }, [drinkId, toggleFavorite]);

  const handleDelete = useCallback(() => {
    Alert.alert(
      t.common.delete,
      t.drinkDetail.confirmDelete,
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.common.delete,
          style: 'destructive',
          onPress: async () => {
            await removeDrink(drinkId);
            router.back();
          },
        },
      ]
    );
  }, [drinkId, removeDrink, router, t]);

  if (loading) return <LoadingSpinner fullScreen />;
  if (!drink) return null;

  const steps = drink.instructions
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {/* Hero Image */}
        <View style={{ height: IMAGE_HEIGHT, position: 'relative' }}>
          {drink.image ? (
            <Image
              source={{ uri: drink.image }}
              style={{ width: '100%', height: IMAGE_HEIGHT }}
              contentFit="cover"
            />
          ) : (
            <View
              style={{
                width: '100%',
                height: IMAGE_HEIGHT,
                backgroundColor: colors.surfaceElevated,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="wine-outline" size={96} color={colors.textMuted} />
            </View>
          )}
          <LinearGradient
            colors={['transparent', colors.background]}
            style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 160 }}
          />

          {/* Back Button */}
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              position: 'absolute',
              top: insets.top + spacing.sm,
              left: spacing.base,
              width: 44,
              height: 44,
              borderRadius: radius.full,
              backgroundColor: colors.overlay,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Action Buttons */}
          <View
            style={{
              position: 'absolute',
              top: insets.top + spacing.sm,
              right: spacing.base,
              flexDirection: 'row',
              gap: spacing.sm,
            }}
          >
            <TouchableOpacity
              onPress={handleFavorite}
              style={{
                width: 44,
                height: 44,
                borderRadius: radius.full,
                backgroundColor: colors.overlay,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons
                name={isFav ? 'heart' : 'heart-outline'}
                size={22}
                color={isFav ? colors.accent : '#FFFFFF'}
              />
            </TouchableOpacity>
            {drink.is_user_created === 1 && (
              <>
                <TouchableOpacity
                  onPress={() => router.push(`/drink/edit/${drink.id}`)}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: radius.full,
                    backgroundColor: colors.overlay,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="pencil-outline" size={22} color="#FFFFFF" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleDelete}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: radius.full,
                    backgroundColor: colors.overlay,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="trash-outline" size={22} color={colors.error} />
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* Content */}
        <View style={{ padding: spacing.base, paddingTop: spacing.md }}>
          {/* Title + Badges */}
          <Text style={[typography.displaySmall, { color: colors.text }]}>{drink.name}</Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' }}>
            <Badge
              label={drink.alcoholic ? t.drinks.alcoholicLabel : t.drinks.nonAlcoholicLabel}
              variant={drink.alcoholic ? 'alcoholic' : 'nonAlcoholic'}
            />
            {drink.category_name && (
              <Badge label={drink.category_name} variant="primary" />
            )}
          </View>

          {/* Description */}
          {drink.description ? (
            <Text
              style={[typography.bodyLarge, { color: colors.textSecondary, marginTop: spacing.md }]}
            >
              {drink.description}
            </Text>
          ) : null}

          {/* Glass & Garnish */}
          {(drink.glass_type || drink.garnish) && (
            <View
              style={{
                flexDirection: 'row',
                gap: spacing.md,
                marginTop: spacing.lg,
                backgroundColor: colors.surfaceElevated,
                borderRadius: radius.md,
                padding: spacing.md,
              }}
            >
              {drink.glass_type && (
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Ionicons name="wine-outline" size={28} color={colors.primary} />
                  <Text style={[typography.labelMedium, { color: colors.textMuted, marginTop: spacing.xs }]}>
                    {t.drinkDetail.glassType}
                  </Text>
                  <Text style={[typography.bodyMedium, { color: colors.text, textAlign: 'center' }]}>
                    {drink.glass_type}
                  </Text>
                </View>
              )}
              {drink.garnish && (
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Ionicons name="leaf-outline" size={28} color={colors.primary} />
                  <Text style={[typography.labelMedium, { color: colors.textMuted, marginTop: spacing.xs }]}>
                    {t.drinkDetail.garnish}
                  </Text>
                  <Text style={[typography.bodyMedium, { color: colors.text, textAlign: 'center' }]}>
                    {drink.garnish}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Ingredients */}
          <Text
            style={[typography.headlineSmall, { color: colors.text, marginTop: spacing.xl, marginBottom: spacing.md }]}
          >
            {t.drinkDetail.ingredients}
          </Text>
          {drink.ingredients.map((ing) => (
            <IngredientItem
              key={ing.id}
              ingredient={ing}
              inInventory={inventoryIds.has(ing.ingredient_id)}
            />
          ))}

          {/* Instructions */}
          <Text
            style={[typography.headlineSmall, { color: colors.text, marginTop: spacing.xl, marginBottom: spacing.md }]}
          >
            {t.drinkDetail.instructions}
          </Text>
          {steps.map((step, index) => (
            <View
              key={index}
              style={{
                flexDirection: 'row',
                marginBottom: spacing.md,
                backgroundColor: colors.surfaceElevated,
                borderRadius: radius.md,
                padding: spacing.md,
                borderWidth: 1,
                borderColor: colors.borderSubtle,
              }}
            >
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: radius.full,
                  backgroundColor: colors.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: spacing.md,
                  flexShrink: 0,
                }}
              >
                <Text style={[typography.labelMedium, { color: colors.textInverse }]}>
                  {index + 1}
                </Text>
              </View>
              <Text style={[typography.bodyMedium, { color: colors.text, flex: 1, lineHeight: 22 }]}>
                {step}
              </Text>
            </View>
          ))}
        </View>

        <View style={{ height: insets.bottom + spacing.xl }} />
      </ScrollView>
    </View>
  );
}
