import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActionSheetIOS,
  Platform,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/context/ThemeContext';
import { useLanguage } from '../../src/context/LanguageContext';
import { useDrinks } from '../../src/hooks/useDrinks';
import { useCategories } from '../../src/hooks/useCategories';
import { useImagePicker } from '../../src/hooks/useImagePicker';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { IngredientFormRow } from '../../src/components/drinks/IngredientFormRow';
import { SwitchRow } from '../../src/components/ui/SwitchRow';
import { DrinkFormData, IngredientFormItem } from '../../src/types';
import { useEffect } from 'react';

function generateKey() {
  return `${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export default function AddDrinkScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { colors, spacing, typography, radius } = theme;
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [alcoholic, setAlcoholic] = useState(true);
  const [glassType, setGlassType] = useState('');
  const [garnish, setGarnish] = useState('');
  const [instructions, setInstructions] = useState('');
  const [ingredientItems, setIngredientItems] = useState<IngredientFormItem[]>([
    { key: generateKey(), ingredient_id: null, ingredient_name: '', amount: '', unit: '' },
  ]);
  const [saving, setSaving] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  const { addDrink } = useDrinks();
  const { categories, fetchCategories } = useCategories();
  const { selectedImage, pickFromGallery, pickFromCamera } = useImagePicker();

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleAddIngredient = useCallback(() => {
    setIngredientItems(prev => [
      ...prev,
      { key: generateKey(), ingredient_id: null, ingredient_name: '', amount: '', unit: '' },
    ]);
  }, []);

  const handleChangeIngredient = useCallback(
    (key: string, field: keyof IngredientFormItem, value: string) => {
      setIngredientItems(prev =>
        prev.map(item => (item.key === key ? { ...item, [field]: value } : item))
      );
    },
    []
  );

  const handleRemoveIngredient = useCallback((key: string) => {
    setIngredientItems(prev => prev.filter(item => item.key !== key));
  }, []);

  const handleImagePick = useCallback(() => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [t.imageSource.cancel, t.imageSource.camera, t.imageSource.gallery],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) pickFromCamera();
          if (buttonIndex === 2) pickFromGallery();
        }
      );
    } else {
      Alert.alert(t.imageSource.title, undefined, [
        { text: t.imageSource.cancel, style: 'cancel' },
        { text: t.imageSource.camera, onPress: pickFromCamera },
        { text: t.imageSource.gallery, onPress: pickFromGallery },
      ]);
    }
  }, [pickFromCamera, pickFromGallery, t]);

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      Alert.alert(t.common.error, t.addDrink.nameRequired);
      return;
    }
    const validIngredients = ingredientItems.filter(i => i.ingredient_name.trim());
    if (validIngredients.length === 0) {
      Alert.alert(t.common.error, t.addDrink.atLeastOneIngredient);
      return;
    }

    setSaving(true);
    try {
      const formData: DrinkFormData = {
        name: name.trim(),
        description: description.trim(),
        image: selectedImage,
        category_id: categoryId,
        alcoholic,
        glass_type: glassType.trim(),
        garnish: garnish.trim(),
        instructions: instructions.trim(),
        ingredients: validIngredients,
      };
      const newId = await addDrink(formData);
      Alert.alert(t.common.success, t.addDrink.saveSuccess, [
        { text: t.common.ok, onPress: () => router.push(`/drink/${newId}`) },
      ]);
    } finally {
      setSaving(false);
    }
  }, [name, description, selectedImage, categoryId, alcoholic, glassType, garnish, instructions, ingredientItems, addDrink, router, t]);

  const selectedCategory = categories.find(c => c.id === categoryId);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top,
          backgroundColor: colors.background,
          borderBottomWidth: 1,
          borderBottomColor: colors.borderSubtle,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            height: 56,
            paddingHorizontal: spacing.base,
          }}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[typography.headlineMedium, { color: colors.text, flex: 1, marginLeft: spacing.md }]}>
            {t.addDrink.title}
          </Text>
          <Button
            label={t.common.save}
            onPress={handleSave}
            loading={saving}
            size="sm"
          />
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: spacing.base,
          paddingBottom: insets.bottom + spacing.xl,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Image Picker */}
        <TouchableOpacity
          onPress={handleImagePick}
          style={{
            height: 200,
            borderRadius: radius.lg,
            overflow: 'hidden',
            marginBottom: spacing.lg,
            backgroundColor: colors.surfaceElevated,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: colors.border,
            borderStyle: 'dashed',
          }}
        >
          {selectedImage ? (
            <Image
              source={{ uri: selectedImage }}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
            />
          ) : (
            <View style={{ alignItems: 'center', gap: spacing.sm }}>
              <Ionicons name="camera-outline" size={40} color={colors.textMuted} />
              <Text style={[typography.bodyMedium, { color: colors.textMuted }]}>
                {t.addDrink.addImage}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Basic Info */}
        <Input
          label={t.addDrink.namePlaceholder}
          value={name}
          onChangeText={setName}
          placeholder={t.addDrink.namePlaceholder}
          returnKeyType="next"
        />

        <Input
          label={t.addDrink.descriptionPlaceholder}
          value={description}
          onChangeText={setDescription}
          placeholder={t.addDrink.descriptionPlaceholder}
          multiline
          numberOfLines={3}
        />

        {/* Category */}
        <View style={{ marginBottom: spacing.md }}>
          <Text style={[typography.labelMedium, { color: colors.textSecondary, marginBottom: spacing.xs }]}>
            {t.addDrink.categoryLabel}
          </Text>
          <TouchableOpacity
            onPress={() => setShowCategoryModal(true)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.surfaceElevated,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: colors.border,
              paddingHorizontal: spacing.md,
              height: 48,
            }}
          >
            <Text
              style={[
                typography.bodyMedium,
                { color: selectedCategory ? colors.text : colors.textMuted, flex: 1 },
              ]}
            >
              {selectedCategory?.name ?? t.common.none}
            </Text>
            <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Alcoholic Toggle */}
        <View
          style={{
            backgroundColor: colors.surfaceElevated,
            borderRadius: radius.md,
            paddingHorizontal: spacing.md,
            marginBottom: spacing.md,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <SwitchRow
            label={t.addDrink.alcoholicLabel}
            value={alcoholic}
            onValueChange={setAlcoholic}
          />
        </View>

        <Input
          label={t.addDrink.glassTypePlaceholder}
          value={glassType}
          onChangeText={setGlassType}
          placeholder={t.addDrink.glassTypePlaceholder}
        />

        <Input
          label={t.addDrink.garnishPlaceholder}
          value={garnish}
          onChangeText={setGarnish}
          placeholder={t.addDrink.garnishPlaceholder}
        />

        {/* Ingredients */}
        <View style={{ marginBottom: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
            <Text style={[typography.labelMedium, { color: colors.textSecondary }]}>
              {t.addDrink.ingredientsTitle}
            </Text>
            <TouchableOpacity
              onPress={handleAddIngredient}
              style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}
            >
              <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
              <Text style={[typography.labelMedium, { color: colors.primary }]}>
                {t.addDrink.addIngredient}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Column headers */}
          <View style={{ flexDirection: 'row', marginBottom: spacing.xs, gap: spacing.sm }}>
            <Text style={[typography.labelSmall, { color: colors.textMuted, flex: 3 }]}>
              {t.addDrink.ingredientName}
            </Text>
            <Text style={[typography.labelSmall, { color: colors.textMuted, flex: 1.5 }]}>
              {t.addDrink.amount}
            </Text>
            <Text style={[typography.labelSmall, { color: colors.textMuted, flex: 1.5 }]}>
              {t.addDrink.unit}
            </Text>
            <View style={{ width: 24 }} />
          </View>

          {ingredientItems.map((item) => (
            <IngredientFormRow
              key={item.key}
              item={item}
              onChange={handleChangeIngredient}
              onRemove={handleRemoveIngredient}
            />
          ))}
        </View>

        <Input
          label={t.addDrink.instructionsPlaceholder}
          value={instructions}
          onChangeText={setInstructions}
          placeholder={t.addDrink.instructionsPlaceholder}
          multiline
          numberOfLines={6}
        />

        <Button
          label={t.common.save}
          onPress={handleSave}
          loading={saving}
          fullWidth
          size="lg"
          style={{ marginTop: spacing.md }}
        />
      </ScrollView>

      {/* Category Modal */}
      <Modal
        visible={showCategoryModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}>
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
              {t.addDrink.categoryLabel}
            </Text>
            <TouchableOpacity
              onPress={() => { setCategoryId(null); setShowCategoryModal(false); }}
              style={{
                paddingVertical: spacing.md,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            >
              <Text style={[typography.bodyLarge, { color: !categoryId ? colors.primary : colors.text }]}>
                {t.common.none}
              </Text>
            </TouchableOpacity>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                onPress={() => { setCategoryId(cat.id); setShowCategoryModal(false); }}
                style={{
                  paddingVertical: spacing.md,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
              >
                <Text
                  style={[
                    typography.bodyLarge,
                    { color: categoryId === cat.id ? colors.primary : colors.text },
                  ]}
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    </View>
  );
}
