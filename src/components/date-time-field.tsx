import { Spacing, ThemeColor } from '@/constants/theme';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText } from './themed-text';

interface DateTimeFieldProps {
  mode: 'date' | 'time';
  value: Date | null;
  onChange: (date: Date) => void;
  placeholder: string;
  colors: Record<ThemeColor, string>;
}

function formatValue(mode: 'date' | 'time', value: Date): string {
  return mode === 'date'
    ? value.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : value.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

// Native (iOS/Android) date & time entry backed by the platform picker.
// Android opens the system dialog imperatively; iOS shows a spinner sheet
// since its inline "compact" style doesn't match the app's boxy inputs.
export function DateTimeField({ mode, value, onChange, placeholder, colors }: DateTimeFieldProps) {
  const [showIosSheet, setShowIosSheet] = useState(false);

  function openPicker() {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: value ?? new Date(),
        mode,
        is24Hour: false,
        onValueChange: (_event, selected) => onChange(selected),
      });
    } else {
      setShowIosSheet(true);
    }
  }

  const styles = StyleSheet.create({
    field: {
      backgroundColor: colors.backgroundElement, padding: Spacing.three,
      borderRadius: 12, borderWidth: 2, borderColor: colors.border,
    },
    fieldText: { fontSize: 15, fontWeight: value ? '700' : '400' },
    backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
    sheet: {
      backgroundColor: colors.backgroundElement, borderTopWidth: 3, borderColor: colors.border,
      borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: Spacing.three,
    },
    doneBtnShadow: { backgroundColor: colors.border, borderRadius: 12, marginTop: Spacing.two },
    doneBtn: {
      backgroundColor: colors.accentYellow, borderWidth: 2, borderColor: colors.border,
      borderRadius: 12, paddingVertical: Spacing.two, alignItems: 'center',
      transform: [{ translateX: -3 }, { translateY: -3 }],
    },
  });

  return (
    <>
      <TouchableOpacity style={styles.field} onPress={openPicker}>
        <ThemedText style={styles.fieldText} themeColor={value ? 'text' : 'textSecondary'}>
          {value ? formatValue(mode, value) : placeholder}
        </ThemedText>
      </TouchableOpacity>

      {Platform.OS === 'ios' && (
        <Modal
          visible={showIosSheet}
          transparent
          animationType="slide"
          onRequestClose={() => setShowIosSheet(false)}
        >
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setShowIosSheet(false)}>
            <TouchableOpacity activeOpacity={1} style={styles.sheet}>
              <DateTimePicker
                value={value ?? new Date()}
                mode={mode}
                display="spinner"
                onValueChange={(_event, selected) => onChange(selected)}
              />
              <View style={styles.doneBtnShadow}>
                <TouchableOpacity style={styles.doneBtn} onPress={() => setShowIosSheet(false)}>
                  <ThemedText style={{ fontWeight: '900', color: '#000', fontSize: 14 }}>Done</ThemedText>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}
    </>
  );
}
