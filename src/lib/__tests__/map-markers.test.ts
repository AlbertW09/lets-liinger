import { buildMarkerPayload, MapPinColors, PinEvent } from '../map-markers';

const colors: MapPinColors = {
  border: '#000',
  accentPink: '#f0a',
  accentCyan: '#0af',
  accentGreen: '#0f0',
};

function pin(overrides: Partial<PinEvent> = {}): PinEvent {
  return {
    id: '1',
    title: 'Event',
    location: null,
    event_time: null,
    lat: 1,
    lng: 2,
    hostName: 'Someone',
    rsvpedByMe: false,
    category: null,
    ...overrides,
  };
}

describe('buildMarkerPayload', () => {
  it('builds one marker per pin with matching position', () => {
    const markers = buildMarkerPayload([pin({ id: 'a', lat: 10, lng: 20 })], null, colors);

    expect(markers).toHaveLength(1);
    expect(markers[0]).toMatchObject({ id: 'a', lat: 10, lng: 20 });
    expect(markers[0].isUser).toBeFalsy();
  });

  it('colors non-RSVP\'d pins by category (music = pink, sports = its color)', () => {
    const [music] = buildMarkerPayload([pin({ category: 'music' })], null, colors);
    expect(music.iconHtml).toContain('#FF007F'); // music color from categories

    const [sports] = buildMarkerPayload([pin({ category: 'sports' })], null, colors);
    expect(sports.iconHtml).toContain('#00B4FF'); // sports color

    // No category → neutral grey fallback, never the "you are here" cyan.
    const [none] = buildMarkerPayload([pin({ category: null })], null, colors);
    expect(none.iconHtml).toContain('#9CA3AF');
    expect(none.iconHtml).not.toContain(colors.accentCyan);
  });

  it('always uses accentGreen and a checkmark for RSVP\'d pins', () => {
    const markers = buildMarkerPayload([pin({ rsvpedByMe: true })], null, colors);

    expect(markers[0].iconHtml).toContain(colors.accentGreen);
    expect(markers[0].iconHtml).toContain('✓');
  });

  it('uses a pin glyph for non-RSVP\'d pins', () => {
    const markers = buildMarkerPayload([pin({ rsvpedByMe: false })], null, colors);
    expect(markers[0].iconHtml).toContain('📍');
  });

  it('appends a "you are here" marker when userCoords is provided', () => {
    const markers = buildMarkerPayload([pin()], { lat: 5, lng: 6 }, colors);

    expect(markers).toHaveLength(2);
    const userMarker = markers[1];
    expect(userMarker).toMatchObject({ id: '__user__', lat: 5, lng: 6, isUser: true });
    expect(userMarker.iconHtml).toContain(colors.accentCyan);
  });

  it('omits the user marker when userCoords is null', () => {
    const markers = buildMarkerPayload([pin(), pin({ id: '2' })], null, colors);
    expect(markers).toHaveLength(2);
    expect(markers.some((m) => m.isUser)).toBe(false);
  });

  it('returns just the user marker when there are no pins', () => {
    const markers = buildMarkerPayload([], { lat: 1, lng: 1 }, colors);
    expect(markers).toHaveLength(1);
    expect(markers[0].isUser).toBe(true);
  });

  it('returns an empty array when there are no pins and no user coords', () => {
    expect(buildMarkerPayload([], null, colors)).toEqual([]);
  });
});
