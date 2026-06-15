import React, { memo } from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { Drink } from '../../types';
import { Badge } from '../ui/Badge';

interface DrinkCardProps {
  drink: Drink;
  onPress: (drink: Drink) => void;
  onFavoritePress: (drink: Drink) => void;
  isFavorite: boolean;
}

export const DrinkCard = memo(function DrinkCard({
  drink,
  onPress,
  onFavoritePress,
  isFavorite,
}: DrinkCardProps) {
  const { theme } = useTheme();
  const { colors, radius, spacing, typography } = theme;

  return (
    <TouchableOpacity
      onPress={() => onPress(drink)}
      activeOpacity={0.85}
      style={{
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        marginBottom: spacing.md,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        shadowColor: colors.cardShadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 8,
        elevation: 4,
      }}
    >
      <View style={{ position: 'relative' }}>
        {drink.image ? (
          <Image
            source={{ uri: drink.image }}
            style={{ width: '100%', height: 180 }}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View
            style={{
              width: '100%',
              height: 180,
              backgroundColor: colors.surfaceHighlight,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="wine-outline" size={64} color={colors.textMuted} />
          </View>
        )}
        <TouchableOpacity
          onPress={() => onFavoritePress(drink)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{
            position: 'absolute',
            top: spacing.md,
            right: spacing.md,
            width: 36,
            height: 36,
            borderRadius: radius.full,
            backgroundColor: colors.overlay,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons
            name={isFavorite ? 'heart' : 'heart-outline'}
            size={20}
            color={isFavorite ? colors.accent : '#FFFFFF'}
          />
        </TouchableOpacity>
        {drink.is_user_created === 1 && (
          <View
            style={{
              position: 'absolute',
              top: spacing.md,
              left: spacing.md,
              backgroundColor: colors.primary,
              borderRadius: radius.xs,
              paddingHorizontal: spacing.sm,
              paddingVertical: spacing.xxs,
            }}
          >
            <Text style={[typography.labelSmall, { color: colors.textInverse }]}>Min drink</Text>
          </View>
        )}
      </View>

      <View style={{ padding: spacing.md }}>
        <View
          style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}
        >
          <Text
            style={[typography.titleLarge, { color: colors.text, flex: 1, marginRight: spacing.sm }]}
            numberOfLines={2}
          >
            {drink.name}
          </Text>
          <Badge
            label={drink.alcoholic ? 'Alkohol' : 'Alkoholfri'}
            variant={drink.alcoholic ? 'alcoholic' : 'nonAlcoholic'}
          />
        </View>

        {drink.description ? (
          <Text
            style={[
              typography.bodySmall,
              { color: colors.textSecondary, marginTop: spacing.xs },
            ]}
            numberOfLines={2}
          >
            {drink.description}
          </Text>
        ) : null}

        {drink.category_name ? (
          <Text
            style={[typography.labelSmall, { color: colors.textMuted, marginTop: spacing.sm }]}
          >
            {drink.category_name}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
});
