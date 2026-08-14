import { searchPlaces } from '../places';

describe('searchPlaces', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns an empty array when fetch is unavailable', async () => {
    // @ts-expect-error deliberately simulating an environment without fetch
    delete global.fetch;

    expect(await searchPlaces('library')).toEqual([]);
  });

  it('queries Nominatim and maps name, city subtitle, lat, and lng', async () => {
    const mockJson = jest.fn().mockResolvedValue([
      {
        name: 'Central Library',
        address: { city: 'Santa Cruz', state: 'California' },
        lat: '36.9741',
        lon: '-122.0308',
        display_name: 'Central Library, Santa Cruz, CA',
      },
    ]);
    global.fetch = jest.fn().mockResolvedValue({ json: mockJson }) as any;

    const results = await searchPlaces('central library');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('https://nominatim.openstreetmap.org/search?'),
      expect.objectContaining({ headers: { Accept: 'application/json' } })
    );
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain('q=central+library');
    expect(results).toEqual([
      { name: 'Central Library', subtitle: 'Santa Cruz, California', lat: 36.9741, lng: -122.0308 },
    ]);
  });

  it('falls back to display_name when the place has no name', async () => {
    const mockJson = jest.fn().mockResolvedValue([
      {
        name: '',
        address: {},
        lat: '1.5',
        lon: '2.5',
        display_name: 'Some Street, Some Town, Some Region, Some Country',
      },
    ]);
    global.fetch = jest.fn().mockResolvedValue({ json: mockJson }) as any;

    const results = await searchPlaces('some street');

    // subtitle is undefined here (no address parts); toEqual ignores it.
    expect(results).toEqual([{ name: 'Some Street', lat: 1.5, lng: 2.5 }]);
  });

  it('uses the town when there is no city', async () => {
    const mockJson = jest.fn().mockResolvedValue([
      { name: 'Local Park', address: { town: 'Smallville' }, lat: '0', lon: '0', display_name: 'Local Park' },
    ]);
    global.fetch = jest.fn().mockResolvedValue({ json: mockJson }) as any;

    const results = await searchPlaces('local park');

    expect(results).toEqual([{ name: 'Local Park', subtitle: 'Smallville', lat: 0, lng: 0 }]);
  });

  it('returns an empty array when the response body has no results', async () => {
    global.fetch = jest.fn().mockResolvedValue({ json: jest.fn().mockResolvedValue(null) }) as any;

    expect(await searchPlaces('nowhere')).toEqual([]);
  });

  it('returns an empty array when the request throws', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down')) as any;

    expect(await searchPlaces('anywhere')).toEqual([]);
  });

  it('de-duplicates identical places', async () => {
    const mockJson = jest.fn().mockResolvedValue([
      { name: 'A', address: {}, lat: '1', lon: '1', display_name: 'A' },
      { name: 'A', address: {}, lat: '1', lon: '1', display_name: 'A' },
      { name: 'B', address: {}, lat: '2', lon: '2', display_name: 'B' },
    ]);
    global.fetch = jest.fn().mockResolvedValue({ json: mockJson }) as any;

    const results = await searchPlaces('a or b');

    expect(results.map((r) => r.name)).toEqual(['A', 'B']);
  });

  it('biases to a viewbox and sorts nearest-first when given coords', async () => {
    const mockJson = jest.fn().mockResolvedValue([
      { name: 'Far', address: {}, lat: '40', lon: '-118', display_name: 'Far' },
      { name: 'Near', address: {}, lat: '37.1', lon: '-122', display_name: 'Near' },
    ]);
    global.fetch = jest.fn().mockResolvedValue({ json: mockJson }) as any;

    const results = await searchPlaces('spot', { lat: 37, lng: -122 });

    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain('viewbox=');
    expect(url).toContain('bounded=1');
    // Nearest result comes first.
    expect(results.map((r) => r.name)).toEqual(['Near', 'Far']);
  });
});
