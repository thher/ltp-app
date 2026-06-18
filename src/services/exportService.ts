import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as SQLite from 'expo-sqlite';

export async function exportDatabase(): Promise<boolean> {
  try {
    const dbPath = `${FileSystem.documentDirectory}SQLite/drinkmix.db`;
    const exportPath = `${FileSystem.cacheDirectory}drinkmix_backup_${Date.now()}.db`;

    const info = await FileSystem.getInfoAsync(dbPath);
    if (!info.exists) return false;

    await FileSystem.copyAsync({ from: dbPath, to: exportPath });

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(exportPath, {
        mimeType: 'application/octet-stream',
        dialogTitle: 'Eksporter DrinkMix database',
      });
    }
    return true;
  } catch {
    return false;
  }
}

export async function importDatabase(): Promise<boolean> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets[0]) return false;

    const dbPath = `${FileSystem.documentDirectory}SQLite/drinkmix.db`;
    await FileSystem.deleteAsync(dbPath + '-wal', { idempotent: true });
    await FileSystem.deleteAsync(dbPath + '-shm', { idempotent: true });
    await FileSystem.copyAsync({ from: result.assets[0].uri, to: dbPath });
    return true;
  } catch {
    return false;
  }
}
