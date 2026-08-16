import { Modal, Pressable, StyleSheet, TouchableOpacity } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ShadowSurface } from '@/components/ui/shadow-surface';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { AvatarSource } from '@/lib/avatar';

// Little chooser sheet for the profile photo: pick from library or take a
// photo. Shared by onboarding and edit-profile.
export function AvatarSourceModal({
  visible, onClose, onPick,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (source: AvatarSource) => void;
}) {
  const colors = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable onPress={() => {}}>
          <ShadowSurface backgroundColor={colors.backgroundElement} radius={18} offset={5} wrapperStyle={styles.card} style={styles.inner}>
            <ThemedText style={styles.title}>Profile photo</ThemedText>
            <TouchableOpacity style={[styles.row, { borderColor: colors.border }]} onPress={() => onPick('library')}>
              <ThemedText style={styles.rowText}>Choose from library</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.row, { borderColor: colors.border }]} onPress={() => onPick('camera')}>
              <ThemedText style={styles.rowText}>Take a photo</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancel} onPress={onClose}>
              <ThemedText style={styles.cancelText} themeColor="textSecondary">Cancel</ThemedText>
            </TouchableOpacity>
          </ShadowSurface>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: Spacing.four },
  card: { minWidth: 260 },
  inner: { padding: Spacing.three },
  title: { fontSize: 16, fontWeight: '900', textAlign: 'center', marginBottom: Spacing.two },
  row: { borderWidth: 2, borderRadius: 12, paddingVertical: Spacing.three, alignItems: 'center', marginBottom: Spacing.two },
  rowText: { fontSize: 14, fontWeight: '800' },
  cancel: { paddingVertical: Spacing.two, alignItems: 'center' },
  cancelText: { fontSize: 13, fontWeight: '800' },
});
