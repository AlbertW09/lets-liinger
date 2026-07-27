import { useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Chip } from '@/components/ui/chip';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Club, clubLabel } from '@/lib/clubs';

interface ClubChipPickerProps {
  clubs: Club[];
  isSelected: (label: string) => boolean;
  onToggle: (label: string) => void;
  onClubCreated: (created: Club) => Promise<void> | void;
  createClub: (name: string, emoji: string) => Promise<Club | null>;
}

// Chip row for picking from the shared clubs list, with an inline "add a new
// club" form. Selection semantics (single- vs multi-select) are entirely up
// to the caller via isSelected/onToggle, so this covers both the single-select
// "hosting club" picker (create/edit event) and the multi-select "your clubs"
// picker (onboarding, edit profile).
export function ClubChipPicker({ clubs, isSelected, onToggle, onClubCreated, createClub }: ClubChipPickerProps) {
  const theme = useTheme();
  const [adding, setAdding] = useState(false);
  const [emoji, setEmoji] = useState('');
  const [name, setName] = useState('');

  async function handleAdd() {
    const created = await createClub(name, emoji);
    if (created) {
      await onClubCreated(created);
      setEmoji('');
      setName('');
      setAdding(false);
    }
  }

  return (
    <>
      <View style={styles.wrap}>
        {clubs.map((c) => {
          const label = clubLabel(c);
          return <Chip key={c.id} label={label} selected={isSelected(label)} onPress={() => onToggle(label)} />;
        })}
        <Chip label="➕ Add club" dashed onPress={() => setAdding((v) => !v)} />
      </View>
      {adding && (
        <View style={styles.addRow}>
          <TextField
            style={styles.emojiInput}
            placeholder="🎸"
            value={emoji}
            onChangeText={setEmoji}
            maxLength={2}
          />
          <TextField
            containerStyle={styles.flex1}
            placeholder="New club name"
            value={name}
            onChangeText={setName}
          />
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: theme.accentCyan, borderColor: theme.border }]}
            onPress={handleAdd}
          >
            <ThemedText style={styles.addBtnText}>Add</ThemedText>
          </TouchableOpacity>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginBottom: Spacing.two },
  addRow: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.one },
  emojiInput: { width: 56, textAlign: 'center' },
  flex1: { flex: 1 },
  addBtn: {
    borderWidth: 2, borderRadius: 12, paddingHorizontal: Spacing.three,
    justifyContent: 'center', alignItems: 'center',
  },
  addBtnText: { fontWeight: '900', color: '#000', fontSize: 13 },
});
