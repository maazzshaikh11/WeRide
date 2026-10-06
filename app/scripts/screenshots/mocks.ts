// Network stand-ins: the routing server, Open-Meteo, and Mapbox geocoding all answer with fixed data.
const json = (b: any) => ({ ok: true, status: 200, json: async () => b, text: async () => JSON.stringify(b) });

function path(a: { lat: number; lng: number }, b: { lat: number; lng: number }, bend: number, n = 60) {
  const out: number[][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const w = Math.sin(t * Math.PI * 5) * 0.004 * bend + Math.sin(t * Math.PI) * 0.03 * bend;
    out.push([+(a.lat + (b.lat - a.lat) * t + w * 0.6).toFixed(5), +(a.lng + (b.lng - a.lng) * t - w * 0.6).toFixed(5)]);
  }
  return out;
}

const real = globalThis.fetch?.bind(globalThis);
(globalThis as any).fetch = async (url: any, init?: any) => {
  const u = String(url);
  if (u.includes('/route')) {
    const body = JSON.parse(init?.body ?? '{}');
    const o = body.origin ?? { lat: 19.04, lng: 72.82 };
    const d = body.destination ?? { lat: 18.75, lng: 73.4 };
    const alt = (id: string, bend: number, km: number, eta: number, safety: number, haz: number, label: string) => ({ route_id: id, path_points: path(o, d, bend), distance_km: km, eta_minutes: eta, safety_score: safety, hazard_count: haz, label });
    const a = [alt('r1', 0.3, 84.2, 125, 0.91, 1, 'Fastest'), alt('r2', 1, 91.4, 139, 0.96, 0, 'Safest'), alt('r3', -0.8, 88.6, 131, 0.84, 2, 'Alternative')];
    return json({ ...a[0], recalculated_at_hlc: `${Date.now()}:0`, alternatives: a });
  }
  if (u.includes('open-meteo')) {
    return json({ current: { temperature_2m: 21, weather_code: 0, wind_speed_10m: 9, precipitation: 0 }, daily: { sunrise: ['2025-10-11T06:24'] } });
  }
  if (u.includes('geocoding')) {
    const q = decodeURIComponent((u.split('/mapbox.places/')[1] ?? '').split('.json')[0]);
    const feat = (name: string, place: string, lng: number, lat: number) => ({ id: name, text: name, place_name: `${name}, ${place}`, center: [lng, lat], geometry: { type: 'Point', coordinates: [lng, lat] }, properties: {}, context: [] });
    return json({ features: q.includes(',') ? [feat('Bandra Fort', 'Mumbai, Maharashtra', 72.8188, 19.0419)] : [feat('Lonavala', 'Maharashtra, India', 73.4072, 18.7481), feat('Lonavala Lake', 'Maharashtra, India', 73.41, 18.76)] });
  }
  if (u.startsWith('file:') || u.startsWith('data:') || u.startsWith('blob:') || !real) return real ? real(url, init) : json({});
  return { ok: false, status: 503, json: async () => ({}), text: async () => '' };
};
