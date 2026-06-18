import React, { memo, useState } from 'react';
import { TouchableOpacity, View, Text } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { Drink } from '../../types';
import { Badge } from '../ui/Badge';

const CATEGORY_STYLES: Record<string, { bg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  Cocktail:   { bg: '#2D1B69', icon: 'wine-outline' },
  Shot:       { bg: '#6B1A1A', icon: 'flask-outline' },
  Longdrink:  { bg: '#1A3A5C', icon: 'beer-outline' },
  Smoothie:   { bg: '#1A4A2A', icon: 'nutrition-outline' },
  Alkoholfri: { bg: '#1A3D2B', icon: 'leaf-outline' },
  Punch:      { bg: '#4A2D00', icon: 'bonfire-outline' },
  Annet:      { bg: '#2D2D2D', icon: 'star-outline' },
};

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
  const [imgError, setImgError] = useState(false);
  const catStyle = CATEGORY_STYLES[drink.category_name ?? ''] ?? CATEGORY_STYLES.Annet;

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
        {drink.image && !imgError ? (
          <Image
            source={{ uri: drink.image }}
            style={{ width: '100%', height: 180 }}
            contentFit="cover"
            transition={200}
            onError={() => setImgError(true)}
          />
        ) : (
          <View
            style={{
              width: '100%',
              height: 180,
              backgroundColor: catStyle.bg,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name={catStyle.icon} size={56} color="rgba(255,255,255,0.25)" />
            <Text
              style={{
                position: 'absolute',
                bottom: spacing.md,
                left: spacing.md,
                right: spacing.md,
                color: 'rgba(255,255,255,0.5)',
                fontSize: 11,
                letterSpacing: 1.5,
                textTransform: 'uppercase',
              }}
              numberOfLines={1}
            >
              {drink.category_name ?? 'Cocktail'}
            </Text>
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
