import { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ClubChipPicker } from '@/components/club-chip-picker';
import { DateTimeField } from '@/components/date-time-field';
import { PlaceSearchField } from '@/components/place-search-field';
import { ThemedText } from '@/components/themed-text';
import { ShadowSurface } from '@/components/ui/shadow-surface';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useClubs } from '@/hooks/use-clubs';
import { usePlaceSearch } from '@/hooks/use-place-search';
import { useTheme } from '@/hooks/use-theme';
import { clubLabel } from '@/lib/clubs';
import { PlaceResult } from '@/lib/places';

export interface EventFormInitialValues {
  title: string;
  description: string;
  host: string;
  location: string | null;
  eventTime: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface EventFormSubmitValues {
  title: string;
  description: string;
  host: string;
  place: PlaceResult;
  eventTimeIso: string;
}

interface EventFormModalProps {
  visible: boolean;
  mode: 'create' | 'edit';
  initialValues?: EventFormInitialValues;
  onClose: () => void;
  onSubmit: (values: EventFormSubmitValues) => Promise<{ error?: string } | void>;
  onSuccess: () => void;
}

function parseInitialPlace(v?: EventFormInitialValues): PlaceResult | null {
  if (!v || v.latitude == null || v.longitude == null) return null;
  return { name: v.location ?? '', lat: v.latitude, lng: v.longitude };
}

function parseInitialDate(v?: EventFormInitialValues): Date | null {
  const [datePart] = (v?.eventTime ?? '').split('T');
  if (!datePart) return null;
  const [y, m, d] = datePart.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function parseInitialTime(v?: EventFormInitialValues): Date | null {
  const [, timePart] = (v?.eventTime ?? '').split('T');
  if (!timePart || timePart === '00:00:00') return null;
  const [hh, mm] = timePart.split(':').map(Number);
  return new Date(1970, 0, 1, hh, mm);
}

function toEventTimeIso(date: Date, time: Date | null): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = time ? String(time.getHours()).padStart(2, '0') : '00';
  const mm = time ? String(time.getMinutes()).padStart(2, '0') : '00';
  return `${y}-${m}-${d}T${hh}:${mm}:00`;
}

// Shared create/edit event form. The two flows only differ in what happens on
// submit (insert vs. update), which the caller supplies via onSubmit.
export function EventFormModal({ visible, mode, initialValues, onClose, onSubmit, onSuccess }: EventFormModalProps) {
  const theme = useTheme();
  const { clubs, create: createClub } = useClubs();
  const place = usePlaceSearch(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [host, setHost] = useState('');
  const [date, setDate] = useState<Date | null>(null);
  const [time, setTime] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Re-seed every time the modal opens: blank for "create", the event's
  // current values for "edit".
  useEffect(() => {
    if (!visible) return;
    setTitle(initialValues?.title ?? '');
    setDescription(initialValues?.description ?? '');
    setHost(initialValues?.host ?? '');
    setDate(parseInitialDate(initialValues));
    setTime(parseInitialTime(initialValues));
    setFormError('');
    place.reset(parseInitialPlace(initialValues));
    // Only re-seed when the modal transitions open, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  async function handleSubmit() {
    setFormError('');
    if (!title.trim()) {
      setFormError('Give your event a title.');
      return;
    }
    if (!date) {
      setFormError('Pick a date.');
      return;
    }
    if (!place.selected) {
      setFormError('Pick a location from the search results.');
      return;
    }

    setSaving(true);
    const result = await onSubmit({
      title: title.trim(),
      description: description.trim(),
      host: host.trim(),
      place: place.selected,
      eventTimeIso: toEventTimeIso(date, time),
    });
    setSaving(false);

    if (result?.error) {
      setFormError(result.error);
      return;
    }
    onSuccess();
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose}>
              <ThemedText style={styles.cancel}>Cancel</ThemedText>
            </TouchableOpacity>
            <ThemedText style={styles.title}>{mode === 'create' ? 'New event' : 'Edit event'}</ThemedText>
            <View style={styles.spacer} />
          </View>

          <TextField label="Title" placeholder="House Party & Indie Jam" value={title} onChangeText={setTitle} />
          <TextField
            label="Description"
            placeholder="What's the vibe?"
            multiline
            style={styles.multiline}
            value={description}
            onChangeText={setDescription}
          />

          <PlaceSearchField search={place} />

          <ThemedText style={styles.label} themeColor="accentCyan">Hosting club (optional)</ThemedText>
          <ClubChipPicker
            clubs={clubs}
            isSelected={(label) => host === label}
            onToggle={(label) => setHost(host === label ? '' : label)}
            onClubCreated={(created) => setHost(clubLabel(created))}
            createClub={createClub}
          />

          <ThemedText style={styles.label} themeColor="accentCyan">Date</ThemedText>
          <DateTimeField mode="date" value={date} onChange={setDate} placeholder="Pick a date" colors={theme} />

          <ThemedText style={styles.label} themeColor="accentCyan">Time (optional)</ThemedText>
          <DateTimeField mode="time" value={time} onChange={setTime} placeholder="Pick a time" colors={theme} />

          {formError ? <ThemedText style={styles.error}>{formError}</ThemedText> : null}

          <ShadowSurface
            backgroundColor={theme.accentYellow}
            radius={14}
            offset={3}
            wrapperStyle={styles.submitShadow}
            style={styles.submitBtn}
            onPress={handleSubmit}
            disabled={saving}
          >
            <ThemedText style={styles.submitText}>
              {saving
                ? mode === 'create' ? 'Posting...' : 'Saving...'
                : mode === 'create' ? 'Post event' : 'Save changes'}
            </ThemedText>
          </ShadowSurface>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { padding: Spacing.four, paddingBottom: 80 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.two,
  },
  cancel: { fontSize: 15, fontWeight: '700', width: 50 },
  title: { fontSize: 18, fontWeight: '900' },
  spacer: { width: 50 },
  multiline: { height: 80, textAlignVertical: 'top' },
  label: {
    fontSize: 12, fontWeight: '900', marginBottom: Spacing.two, marginTop: Spacing.three, letterSpacing: 0.5,
  },
  submitShadow: { marginTop: Spacing.four },
  submitBtn: { paddingVertical: Spacing.three, alignItems: 'center' },
  submitText: { fontWeight: '900', color: '#000', fontSize: 16 },
  error: { color: '#ff6b6b', marginTop: Spacing.three, textAlign: 'center' },
});
