import { geocodeSearch, geocodeSearchStrict } from '../src/utils/geocode';

const mockFetch = jest.fn();
(globalThis as any).fetch = mockFetch;

const ok = (features: unknown[]) => ({ ok: true, status: 200, json: async () => ({ features }) });

describe('geocode', () => {
  beforeEach(() => mockFetch.mockReset());

  test('strict: maps features', async () => {
    mockFetch.mockResolvedValue(ok([{ place_name: 'Pune, India', center: [73.85, 18.52] }]));
    await expect(geocodeSearchStrict('pune')).resolves.toEqual([{ label: 'Pune, India', lat: 18.52, lng: 73.85 }]);
  });

  test('strict: no features resolves to [] (a real "no results")', async () => {
    mockFetch.mockResolvedValue(ok([]));
    await expect(geocodeSearchStrict('zzzzzz')).resolves.toEqual([]);
  });

  test('strict: short query does not hit the network', async () => {
    await expect(geocodeSearchStrict('ab')).resolves.toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test('strict: throws on network failure and on HTTP error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('offline'));
    await expect(geocodeSearchStrict('pune')).rejects.toThrow('offline');
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });
    await expect(geocodeSearchStrict('pune')).rejects.toThrow(/500/);
  });

  test('geocodeSearch still swallows failures', async () => {
    mockFetch.mockRejectedValueOnce(new Error('offline'));
    await expect(geocodeSearch('pune')).resolves.toEqual([]);
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });
    await expect(geocodeSearch('pune')).resolves.toEqual([]);
  });
});
