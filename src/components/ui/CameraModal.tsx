import { useRef, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, Modal, ActivityIndicator, StyleSheet } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';

interface CameraModalProps {
  visible: boolean;
  onCapture: (uri: string) => void;
  onClose: () => void;
}

export function CameraModal({ visible, onCapture, onClose }: CameraModalProps) {
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [flash, setFlash] = useState<'off' | 'on'>('off');
  const [capturing, setCapturing] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7, skipProcessing: true });
      if (photo?.uri) {
        onCapture(photo.uri);
      }
    } catch {
      // ignore
    } finally {
      setCapturing(false);
    }
  }, [capturing, onCapture]);

  if (!visible) return null;

  // No permission yet
  if (!permission) {
    return (
      <Modal visible animationType="slide" onRequestClose={onClose}>
        <View style={[styles.center, { backgroundColor: '#000' }]}>
          <ActivityIndicator color="#fff" />
        </View>
      </Modal>
    );
  }

  if (!permission.granted) {
    return (
      <Modal visible animationType="slide" onRequestClose={onClose}>
        <View style={[styles.center, { backgroundColor: '#0D0D0D', padding: spacing.xl }]}>
          <Ionicons name="camera-outline" size={64} color={colors.textMuted} />
          <Text style={[typography.headlineSmall, { color: colors.text, textAlign: 'center', marginTop: spacing.lg }]}>
            Kamera-tilgang kreves
          </Text>
          <Text style={[typography.bodyMedium, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm, marginBottom: spacing.xl }]}>
            DrinkMix trenger kamera-tilgang for å skanne ingredienser
          </Text>
          <TouchableOpacity
            onPress={requestPermission}
            style={{ backgroundColor: colors.primary, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.md, marginBottom: spacing.md }}
          >
            <Text style={[typography.labelLarge, { color: colors.textInverse }]}>Gi tilgang</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose}>
            <Text style={[typography.labelMedium, { color: colors.textMuted }]}>Avbryt</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          flash={flash}
        />

        {/* Top bar */}
        <View style={{
          position: 'absolute', top: insets.top + spacing.sm,
          left: 0, right: 0,
          flexDirection: 'row', justifyContent: 'space-between',
          paddingHorizontal: spacing.lg,
        }}>
          <TouchableOpacity
            onPress={onClose}
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setFlash(f => f === 'off' ? 'on' : 'off')}
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name={flash === 'on' ? 'flash' : 'flash-off'} size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Hint */}
        <View style={{ position: 'absolute', top: '40%', left: 0, right: 0, alignItems: 'center' }}>
          <View style={{
            borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)', borderRadius: radius.lg,
            width: 260, height: 200,
          }} />
          <Text style={{ color: 'rgba(255,255,255,0.7)', marginTop: spacing.md, fontSize: 13 }}>
            Pek mot flaskene dine
          </Text>
        </View>

        {/* Bottom capture button */}
        <View style={{
          position: 'absolute', bottom: insets.bottom + spacing.xl,
          left: 0, right: 0, alignItems: 'center',
        }}>
          <TouchableOpacity
            onPress={handleCapture}
            disabled={capturing}
            style={{
              width: 80, height: 80, borderRadius: 40,
              backgroundColor: capturing ? 'rgba(255,255,255,0.5)' : '#fff',
              borderWidth: 5, borderColor: 'rgba(255,255,255,0.4)',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            {capturing
              ? <ActivityIndicator color="#000" />
              : <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff' }} />
            }
          </TouchableOpacity>
          <Text style={{ color: 'rgba(255,255,255,0.6)', marginTop: spacing.md, fontSize: 13 }}>
            Trykk for å ta bilde
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
