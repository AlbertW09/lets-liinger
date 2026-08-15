import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { usePlaceSearch } from '@/hooks/use-place-search';
import { PlaceResult } from '@/lib/places';

interface PlaceSearchFieldProps {
  search: ReturnType<typeof usePlaceSearch>;
}

// Location text field + live Nominatim results dropdown, shared between the
// create and edit event forms.
export function PlaceSearchField({ search }: PlaceSearchFieldProps) {
  const theme = useTheme();
  const { query, results, selected, searching, onQueryChange, pick } = search;

  return (
    <>
      <TextField
        label="Location"
        placeholder="Search a real place…"
        value={query}
        onChangeText={onQueryChange}
        autoCapitalize="none"
      />
      {searching && (
        <ThemedText style={styles.hint} themeColor="textSecondary">Searching…</ThemedText>
      )}
      {selected && (
        <ThemedText style={styles.hint} themeColor="textSecondary">✓ Pinned: {selected.name}</ThemedText>
      )}
      {results.length > 0 && (
        <View style={[styles.list, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
          {results.map((p: PlaceResult, i: number) => (
            <TouchableOpacity
              key={`${p.lat}-${p.lng}-${i}`}
              style={[styles.row, i < results.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border }]}
              onPress={() => pick(p)}
            >
              <ThemedText style={styles.rowText}>{p.name}</ThemedText>
              {p.subtitle ? (
                <ThemedText style={styles.rowSub} themeColor="textSecondary" numberOfLines={1}>
                  {p.subtitle}
                </ThemedText>
              ) : null}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 12, fontWeight: '700', marginTop: Spacing.one },
  list: { borderWidth: 2, borderRadius: 12, marginTop: Spacing.two, overflow: 'hidden' },
  row: { paddingVertical: Spacing.two, paddingHorizontal: Spacing.three },
  rowText: { fontSize: 14, fontWeight: '700' },
  rowSub: { fontSize: 12, fontWeight: '600', marginTop: 1 },
});
