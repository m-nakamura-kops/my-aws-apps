/**
 * 日時表示ヘルパー（Asia/Tokyo / NULL・Epoch ガード）
 */

export function isPresentTime(v: unknown): boolean {
  if (v == null || v === '') return false;
  if (typeof v === 'number' && v === 0) return false;
  const s = String(v).trim();
  if (s === '' || s === 'null' || s === '0' || s.startsWith('0000-00-00')) return false;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const year = parseInt(m[1], 10);
    if (year < 1980) return false;
    return true;
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime()) || d.getFullYear() < 1980) return false;
  return true;
}

/**
 * DB / API から受け取った日時を JST 表示用に整形。
 * NULL・不正・1970 台は '-' を返す。
 * "YYYY-MM-DD HH:mm:ss"（タイムゾーン無し＝JST 壁時計）はそのまま表示する。
 */
export function formatDateTimeJst(dateString: string | null | undefined): string {
  if (!isPresentTime(dateString)) return '-';
  const s = String(dateString).trim();

  const wall = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (wall && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) {
    return `${wall[1]}/${wall[2]}/${wall[3]} ${wall[4]}:${wall[5]}`;
  }

  const date = new Date(s);
  if (Number.isNaN(date.getTime()) || date.getFullYear() < 1980) return '-';
  return date.toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
