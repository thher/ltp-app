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
  ActivityIndicator,
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
import * as ImagePicker from 'expo-image-picker';
import { scanIngredientsFromImage, getApiKey } from '../../src/services/aiService';

type TabType = 'inventory' | 'matches';

function ScanResultModal({
  visible, ingredients, onConfirm, onClose, colors, spacing, typography, radius, insets,
}: {
  visible: boolean;
  ingredients: string[];
  onConfirm: (selected: string[]) => void;
  onClose: () => void;
  colors: ReturnType<typeof useTheme>['theme']['colors'];
  spacing: ReturnType<typeof useTheme>['theme']['spacing'];
  typography: ReturnType<typeof useTheme>['theme']['typography'];
  radius: ReturnType<typeof useTheme>['theme']['radius'];
  insets: ReturnType<typeof useSafeAreaInsets>;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(ingredients));

  useEffect(() => {
    setSelected(new Set(ingredients));
  }, [ingredients]);

  const toggle = (name: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}>
        <View style={{
          backgroundColor: colors.surface,
          borderTopLeftRadius: radius.xl,
          borderTopRightRadius: radius.xl,
          padding: spacing.xl,
          paddingBottom: insets.bottom + spacing.xl,
          maxHeight: '80%',
        }}>
          <Text style={[typography.headlineSmall, { color: colors.text, marginBottom: spacing.xs }]}>
            Funnet ingredienser
          </Text>
          <Text style={[typography.bodySmall, { color: colors.textMuted, marginBottom: spacing.lg }]}>
            Velg hvilke du vil legge til i lageret
          </Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {ingredients.map(name => {
              const on = selected.has(name);
              return (
                <TouchableOpacity
                  key={name}
                  onPress={() => toggle(name)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: spacing.md,
                    paddingHorizontal: spacing.base,
                    marginBottom: spacing.sm,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: on ? colors.primary : colors.borderSubtle,
                    backgroundColor: on ? `${colors.primary}18` : colors.surfaceElevated,
                  }}
                >
                  <Ionicons
                    name={on ? 'checkmark-circle' : 'ellipse-outline'}
                    size={22}
                    color={on ? colors.primary : colors.textMuted}
                    style={{ marginRight: spacing.md }}
                  />
                  <Text style={[typography.bodyLarge, { color: colors.text, flex: 1, textTransform: 'capitalize' }]}>
                    {name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg }}>
            <TouchableOpacity
              onPress={onClose}
              style={{
                flex: 1, paddingVertical: spacing.md, borderRadius: radius.md,
                backgroundColor: colors.surfaceElevated, alignItems: 'center',
              }}
            >
              <Text style={[typography.labelLarge, { color: colors.textSecondary }]}>Avbryt</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onConfirm(Array.from(selected))}
              disabled={selected.size === 0}
              style={{
                flex: 1, paddingVertical: spacing.md, borderRadius: radius.md,
                backgroundColor: selected.size > 0 ? colors.primary : colors.surfaceElevated,
                alignItems: 'center',
              }}
            >
              <Text style={[typography.labelLarge, { color: selected.size > 0 ? colors.textInverse : colors.textMuted }]}>
                Legg til {selected.size} stk
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

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
  const [scanning, setScanning] = useState(false);
  const [scannedIngredients, setScannedIngredients] = useState<string[]>([]);
  const [showScanModal, setShowScanModal] = useState(false);
  const [showSourceModal, setShowSourceModal] = useState(false);

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

  const processImageForScan = useCallback(async (uri: string) => {
    const apiKey = await getApiKey();
    if (!apiKey) {
      Alert.alert(
        'API-nøkkel mangler',
        'Legg inn din Anthropic API-nøkkel under Innstillinger → AI Ingrediens-skanner.',
        [{ text: 'OK' }]
      );
      return;
    }
    setScanning(true);
    try {
      const found = await scanIngredientsFromImage(uri);
      if (found.length === 0) {
        Alert.alert('Ingen ingredienser funnet', 'Prøv et klarere bilde av flaskene med god belysning.');
        return;
      }
      setScannedIngredients(found);
      setShowScanModal(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      if (msg === 'INVALID_API_KEY') {
        Alert.alert('Ugyldig API-nøkkel', 'Sjekk API-nøkkelen din i Innstillinger.');
      } else {
        Alert.alert('Skanningsfeil', 'Kunne ikke skanne bildet. Sjekk internettforbindelsen.');
      }
    } finally {
      setScanning(false);
    }
  }, []);

  const handleScanWithCamera = useCallback(async () => {
    setShowSourceModal(false);
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert(
          perm.canAskAgain ? 'Kamera-tilgang kreves' : 'Kamera blokkert',
          perm.canAskAgain
            ? 'DrinkMix trenger kamera-tilgang.'
            : 'Gå til Innstillinger → Apper → DrinkMix → Tillatelser og slå på Kamera.',
          [{ text: 'OK' }]
        );
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
      if (!result.canceled && result.assets?.[0]) {
        await processImageForScan(result.assets[0].uri);
      }
    } catch {
      Alert.alert('Kamerafeil', 'Kunne ikke åpne kameraet. Prøv å velge bilde fra galleri i stedet.');
    }
  }, [processImageForScan]);

  const handleScanFromGallery = useCallback(async () => {
    setShowSourceModal(false);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert('Galleri-tilgang kreves', 'DrinkMix trenger tilgang til bildegalleriet.', [{ text: 'OK' }]);
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
      });
      if (!result.canceled && result.assets?.[0]) {
        await processImageForScan(result.assets[0].uri);
      }
    } catch {
      Alert.alert('Feil', 'Kunne ikke åpne galleriet.');
    }
  }, [processImageForScan]);

  const handleAddScanned = useCallback(async (selected: string[]) => {
    for (const name of selected) {
      await addIngredient(name);
    }
    setShowScanModal(false);
    setScannedIngredients([]);
    setActiveTab('matches');
  }, [addIngredient]);

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
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <TouchableOpacity
              onPress={() => setShowSourceModal(true)}
              disabled={scanning}
              style={{
                width: 44,
                height: 44,
                borderRadius: radius.full,
                backgroundColor: colors.surfaceElevated,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              {scanning ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons name="camera-outline" size={22} color={colors.primary} />
              )}
            </TouchableOpacity>
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

      {/* Scan Results Modal */}
      <ScanResultModal
        visible={showScanModal}
        ingredients={scannedIngredients}
        onConfirm={handleAddScanned}
        onClose={() => { setShowScanModal(false); setScannedIngredients([]); }}
        colors={colors}
        spacing={spacing}
        typography={typography}
        radius={radius}
        insets={insets}
      />

      {/* Image Source Picker Modal */}
      <Modal visible={showSourceModal} transparent animationType="slide" onRequestClose={() => setShowSourceModal(false)}>
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}
          activeOpacity={1}
          onPress={() => setShowSourceModal(false)}
        >
          <View style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            padding: spacing.xl,
            paddingBottom: insets.bottom + spacing.xl,
          }}>
            <Text style={[typography.headlineSmall, { color: colors.text, marginBottom: spacing.xs }]}>
              Skann ingredienser
            </Text>
            <Text style={[typography.bodySmall, { color: colors.textMuted, marginBottom: spacing.lg }]}>
              Ta bilde av flaskene dine — AI finner ut hva du kan lage
            </Text>
            <TouchableOpacity
              onPress={handleScanWithCamera}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: spacing.md,
                backgroundColor: colors.primary, borderRadius: radius.md,
                paddingVertical: spacing.md, paddingHorizontal: spacing.lg,
                marginBottom: spacing.sm,
              }}
            >
              <Ionicons name="camera" size={24} color={colors.textInverse} />
              <View>
                <Text style={[typography.labelLarge, { color: colors.textInverse }]}>Ta bilde nå</Text>
                <Text style={[typography.bodySmall, { color: `${colors.textInverse}99` }]}>Åpner kameraet</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleScanFromGallery}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: spacing.md,
                backgroundColor: colors.surfaceElevated, borderRadius: radius.md,
                paddingVertical: spacing.md, paddingHorizontal: spacing.lg,
                borderWidth: 1, borderColor: colors.border,
              }}
            >
              <Ionicons name="images" size={24} color={colors.primary} />
              <View>
                <Text style={[typography.labelLarge, { color: colors.text }]}>Velg fra galleri</Text>
                <Text style={[typography.bodySmall, { color: colors.textMuted }]}>Ta bilde med kameraappen først</Text>
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

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
