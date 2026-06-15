import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/context/ThemeContext';
import { useLanguage } from '../../src/context/LanguageContext';
import { useInventory } from '../../src/hooks/useInventory';
import { useSQLiteContext } from 'expo-sqlite';
import { getAllDrinksWithIngredients } from '../../src/database';
import { calculateDrinkMatches } from '../../src/services/matchService';
import { DrinkMatch } from '../../src/types';
import { MatchCard } from '../../src/components/drinks/MatchCard';
import { Empty } from '../../src/components/ui/Empty';
import { LoadingSpinner } from '../../src/components/ui/LoadingSpinner';
import { InventoryItem } from '../../src/types';

type TabType = 'inventory' | 'matches';

export default function InventoryScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { colors, spacing, typography, radius } = theme;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const db = useSQLiteContext();

  const [activeTab, setActiveTab] = useState<TabType>('inventory');
  const [newIngredient, setNewIngredient] = useState('');
  const [matches, setMatches] = useState<DrinkMatch[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [matchFilter, setMatchFilter] = useState<'all' | 'perfect' | 'almost'>('all');

  const { inventory, inventoryIds, loading, fetchInventory, addIngredient, removeIngredient } = useInventory();

  useEffect(() => {
    fetchInventory();
  }, []);

  const calculateMatches = useCallback(async () => {
    setLoadingMatches(true);
    try {
      const allDrinks = await getAllDrinksWithIngredients(db);
      const result = calculateDrinkMatches(allDrinks, inventoryIds);
      setMatches(result);
    } finally {
      setLoadingMatches(false);
    }
  }, [db, inventoryIds]);

  useEffect(() => {
    if (activeTab === 'matches') {
      calculateMatches();
    }
  }, [activeTab, inventoryIds]);

  const handleAddIngredient = useCallback(async () => {
    const name = newIngredient.trim();
    if (!name) return;
    await addIngredient(name);
    setNewIngredient('');
    setShowAddModal(false);
  }, [newIngredient, addIngredient]);

  const handleRemove = useCallback((item: InventoryItem) => {
    Alert.alert(
      t.inventory.removeIngredient,
      item.ingredient_name,
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.common.delete,
          style: 'destructive',
          onPress: () => removeIngredient(item.ingredient_id),
        },
      ]
    );
  }, [removeIngredient, t]);

  const filteredMatches = matches.filter((m) => {
    if (matchFilter === 'perfect') return m.matchPercent === 100;
    if (matchFilter === 'almost') return m.matchPercent >= 50 && m.matchPercent < 100;
    return m.matchPercent > 0;
  });

  const perfectCount = matches.filter(m => m.matchPercent === 100).length;
  const almostCount = matches.filter(m => m.matchPercent >= 50 && m.matchPercent < 100).length;

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
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={[typography.headlineLarge, { color: colors.text }]}>
              {t.inventory.title}
            </Text>
            <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: 2 }]}>
              {inventory.length} ingredienser i lager
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowAddModal(true)}
            style={{
              width: 44,
              height: 44,
              borderRadius: radius.full,
              backgroundColor: colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="add" size={24} color={colors.textInverse} />
          </TouchableOpacity>
        </View>

        {/* Tab bar */}
        <View
          style={{
            flexDirection: 'row',
            marginTop: spacing.md,
            backgroundColor: colors.surfaceElevated,
            borderRadius: radius.md,
            padding: spacing.xxs,
          }}
        >
          {(['inventory', 'matches'] as TabType[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={{
                flex: 1,
                paddingVertical: spacing.sm,
                borderRadius: radius.sm,
                backgroundColor: activeTab === tab ? colors.primary : 'transparent',
                alignItems: 'center',
              }}
            >
              <Text
                style={[
                  typography.labelMedium,
                  { color: activeTab === tab ? colors.textInverse : colors.textSecondary },
                ]}
              >
                {tab === 'inventory' ? 'Mitt lager' : t.inventory.whatCanIMake}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Content */}
      {activeTab === 'inventory' ? (
        loading ? (
          <LoadingSpinner fullScreen />
        ) : inventory.length === 0 ? (
          <View style={{ flex: 1 }}>
            <Empty
              icon="flask-outline"
              title={t.inventory.noIngredients}
              description={t.inventory.noIngredientsDesc}
            />
            <View style={{ alignItems: 'center', paddingBottom: spacing.xxl }}>
              <TouchableOpacity
                onPress={() => setShowAddModal(true)}
                style={{
                  backgroundColor: colors.primary,
                  paddingHorizontal: spacing.xl,
                  paddingVertical: spacing.md,
                  borderRadius: radius.md,
                }}
              >
                <Text style={[typography.labelLarge, { color: colors.textInverse }]}>
                  + {t.inventory.addIngredient}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <FlatList
            data={inventory}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={{
              padding: spacing.base,
              paddingBottom: insets.bottom + spacing.xl,
            }}
            renderItem={({ item }) => (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: colors.surface,
                  borderRadius: radius.md,
                  paddingVertical: spacing.md,
                  paddingHorizontal: spacing.base,
                  marginBottom: spacing.sm,
                  borderWidth: 1,
                  borderColor: colors.borderSubtle,
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: radius.full,
                    backgroundColor: `${colors.primary}22`,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: spacing.md,
                  }}
                >
                  <Ionicons name="flask-outline" size={18} color={colors.primary} />
                </View>
                <Text style={[typography.bodyLarge, { color: colors.text, flex: 1 }]}>
                  {item.ingredient_name}
                </Text>
                <TouchableOpacity
                  onPress={() => handleRemove(item)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="trash-outline" size={20} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            )}
          />
        )
      ) : (
        /* Matches tab */
        <View style={{ flex: 1 }}>
          {/* Match filter chips */}
          <View
            style={{
              flexDirection: 'row',
              padding: spacing.base,
              gap: spacing.sm,
            }}
          >
            {[
              { key: 'all', label: `Alle (${matches.filter(m => m.matchPercent > 0).length})` },
              { key: 'perfect', label: `Perfekt (${perfectCount})` },
              { key: 'almost', label: `Nesten (${almostCount})` },
            ].map((f) => (
              <TouchableOpacity
                key={f.key}
                onPress={() => setMatchFilter(f.key as typeof matchFilter)}
                style={{
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.xs,
                  borderRadius: radius.full,
                  backgroundColor: matchFilter === f.key ? colors.primary : colors.surfaceElevated,
                  borderWidth: 1,
                  borderColor: matchFilter === f.key ? colors.primary : colors.border,
                }}
              >
                <Text
                  style={[
                    typography.labelSmall,
                    { color: matchFilter === f.key ? colors.textInverse : colors.textSecondary },
                  ]}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {loadingMatches ? (
            <LoadingSpinner fullScreen />
          ) : filteredMatches.length === 0 ? (
            <Empty
              icon="search-outline"
              title={t.inventory.noMatches}
              description={t.inventory.noMatchesDesc}
            />
          ) : (
            <FlatList
              data={filteredMatches}
              keyExtractor={(item) => item.drink.id.toString()}
              renderItem={({ item }) => (
                <MatchCard
                  match={item}
                  onPress={(m) => router.push(`/drink/${m.drink.id}`)}
                />
              )}
              contentContainerStyle={{
                paddingHorizontal: spacing.base,
                paddingBottom: insets.bottom + spacing.xl,
              }}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      )}

      {/* Add Ingredient Modal */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: colors.overlay,
            justifyContent: 'flex-end',
          }}
        >
          <View
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              padding: spacing.xl,
              paddingBottom: insets.bottom + spacing.xl,
            }}
          >
            <Text style={[typography.headlineSmall, { color: colors.text, marginBottom: spacing.lg }]}>
              {t.inventory.addIngredient}
            </Text>
            <TextInput
              value={newIngredient}
              onChangeText={setNewIngredient}
              placeholder={t.inventory.ingredientName}
              placeholderTextColor={colors.textMuted}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleAddIngredient}
              style={[
                typography.bodyLarge,
                {
                  color: colors.text,
                  backgroundColor: colors.surfaceElevated,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.md,
                  marginBottom: spacing.lg,
                },
              ]}
            />
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <TouchableOpacity
                onPress={() => setShowAddModal(false)}
                style={{
                  flex: 1,
                  paddingVertical: spacing.md,
                  borderRadius: radius.md,
                  backgroundColor: colors.surfaceElevated,
                  alignItems: 'center',
                }}
              >
                <Text style={[typography.labelLarge, { color: colors.textSecondary }]}>
                  {t.common.cancel}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleAddIngredient}
                style={{
                  flex: 1,
                  paddingVertical: spacing.md,
                  borderRadius: radius.md,
                  backgroundColor: colors.primary,
                  alignItems: 'center',
                }}
              >
                <Text style={[typography.labelLarge, { color: colors.textInverse }]}>
                  {t.common.add}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
