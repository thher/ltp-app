import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

const IMAGE_DIR = `${FileSystem.documentDirectory}drinkmix/images/`;

async function ensureImageDir(): Promise<void> {
  const dirInfo = await FileSystem.getInfoAsync(IMAGE_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(IMAGE_DIR, { intermediates: true });
  }
}

export async function pickImageFromGallery(): Promise<string | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.8,
  });

  if (result.canceled || !result.assets[0]) return null;
  return saveImageLocally(result.assets[0].uri);
}

export async function pickImageFromCamera(): Promise<string | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') return null;

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.8,
  });

  if (result.canceled || !result.assets[0]) return null;
  return saveImageLocally(result.assets[0].uri);
}

export async function saveImageLocally(sourceUri: string): Promise<string> {
  await ensureImageDir();
  const filename = `drink_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
  const destPath = `${IMAGE_DIR}${filename}`;
  await FileSystem.copyAsync({ from: sourceUri, to: destPath });
  return destPath;
}

export async function deleteImage(uri: string): Promise<void> {
  try {
    if (!uri) return;
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    }
  } catch {
    // Silently ignore errors when deleting images
  }
}

export function getImageUri(path: string | null): string | null {
  if (!path) return null;
  if (path.startsWith('file://') || path.startsWith('/')) return path;
  return path;
}
