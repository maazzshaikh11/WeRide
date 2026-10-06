/** QR encoding for crew codes: pure JS (qrcode-generator), rendered by components/QrCode with react-native-svg. */
import qrcode from 'qrcode-generator';

export type QrLevel = 'L' | 'M' | 'Q' | 'H';

/** Square matrix of modules (true = dark). Picks the smallest QR version that fits. */
export function qrMatrix(text: string, level: QrLevel = 'M'): boolean[][] {
  const qr = qrcode(0, level);
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const rows: boolean[][] = [];
  for (let r = 0; r < n; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < n; c++) row.push(qr.isDark(r, c));
    rows.push(row);
  }
  return rows;
}

/** One SVG path for all dark modules (horizontal runs merged), in module units. */
export function qrPath(matrix: boolean[][]): string {
  const parts: string[] = [];
  matrix.forEach((row, r) => {
    let c = 0;
    while (c < row.length) {
      if (!row[c]) {
        c++;
        continue;
      }
      const start = c;
      while (c < row.length && row[c]) c++;
      parts.push(`M${start} ${r}h${c - start}v1h-${c - start}z`);
    }
  });
  return parts.join('');
}
