/**
 * On-device sketch of a planned route: projects the plan's points into a box
 * (equirectangular, aspect-correct) and returns the line segments to draw.
 * Used under the static map (and alone when it can't load / there is no token),
 * so every ride card has real route geometry even offline.
 */
import { isUsableCoord, LatLng } from './mapFit';

export interface Seg {
  x1: number; y1: number; x2: number; y2: number;
  /** Segment length in px. */
  length: number;
  /** Rotation in degrees around the segment's start. */
  angle: number;
}
export interface Sketch {
  dots: { x: number; y: number; kind: 'start' | 'stop' | 'end' }[];
  segs: Seg[];
}

export function projectSketch(points: LatLng[], width: number, height: number, pad = 28): Sketch | null {
  const pts = points.filter((p) => isUsableCoord(p.lat, p.lng));
  if (pts.length === 0) return null;

  const midLat = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
  const kx = Math.cos((midLat * Math.PI) / 180);
  const xs = pts.map((p) => p.lng * kx);
  const ys = pts.map((p) => -p.lat); // screen y grows downward
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const spanX = maxX - minX, spanY = maxY - minY;

  const availW = Math.max(1, width - pad * 2);
  const availH = Math.max(1, height - pad * 2);
  // One uniform scale so the shape isn't distorted; a single point sits centred.
  const scale = spanX === 0 && spanY === 0 ? 0 : Math.min(spanX ? availW / spanX : Infinity, spanY ? availH / spanY : Infinity);
  const offX = (width - spanX * scale) / 2;
  const offY = (height - spanY * scale) / 2;
  const xy = pts.map((_, i) => ({ x: offX + (xs[i] - minX) * scale, y: offY + (ys[i] - minY) * scale }));

  const segs: Seg[] = [];
  for (let i = 1; i < xy.length; i++) {
    const a = xy[i - 1], b = xy[i];
    const dx = b.x - a.x, dy = b.y - a.y;
    const length = Math.hypot(dx, dy);
    if (length < 0.5) continue;
    segs.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, length, angle: (Math.atan2(dy, dx) * 180) / Math.PI });
  }
  const dots = xy.map((p, i) => ({
    ...p,
    kind: (i === 0 ? 'start' : i === xy.length - 1 ? 'end' : 'stop') as 'start' | 'stop' | 'end',
  }));
  return { dots, segs };
}
