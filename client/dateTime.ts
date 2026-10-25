const pad = (n: number, width = 2) => String(n).padStart(width, '0');
export function localInput(value: string | Date): string {
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) throw new Error('Invalid timestamp.');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}
export function offsetLabel(minutes: number) {
  return `${minutes >= 0 ? '+' : '-'}${pad(Math.floor(Math.abs(minutes) / 60))}:${pad(Math.abs(minutes) % 60)}`;
}
/** Return all instants matching a wall-clock value, including a repeated DST hour. */
export function localCandidates(value: string): { iso: string; offset: string }[] {
  const match = /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)(?::(\d\d)(?:\.(\d{1,3}))?)?$/.exec(value);
  if (!match) return [];
  const [, y, m, d, h, min, s = '0', ms = '0'] = match;
  const wall = Date.UTC(+y, +m - 1, +d, +h, +min, +s, Number(ms.padEnd(3, '0')));
  // UTC calendar round-trip rejects rollover dates before searching timezone offsets.
  const utc = new Date(wall);
  if (
    utc.getUTCFullYear() !== +y ||
    utc.getUTCMonth() !== +m - 1 ||
    utc.getUTCDate() !== +d ||
    +h > 23 ||
    +min > 59 ||
    +s > 59
  )
    return [];
  const canonical = `${y}-${m}-${d}T${h}:${min}:${pad(+s)}.${ms.padEnd(3, '0')}`;
  const offsets = new Set<number>();
  for (let delta = -48; delta <= 48; delta += 6)
    offsets.add(new Date(wall + delta * 3600000).getTimezoneOffset());
  return [...offsets]
    .map((offset) => ({
      iso: new Date(wall + offset * 60000).toISOString(),
      offset: offsetLabel(-offset),
    }))
    .filter((c) => localInput(c.iso) === canonical)
    .sort((a, b) => a.iso.localeCompare(b.iso));
}
export function resolveLocal(value: string, choice?: string): string {
  const candidates = localCandidates(value);
  if (!candidates.length)
    throw new Error('This date or local time does not exist in your timezone.');
  if (choice) {
    const match = candidates.find((c) => c.iso === choice);
    if (match) return match.iso;
    throw new Error('Select a valid time offset.');
  }
  if (candidates.length > 1) throw new Error('This time occurs twice. Choose its UTC offset.');
  return candidates[0].iso;
}
export function durationLabel(start: string, end: string) {
  const minutes = Math.round((Date.parse(end) - Date.parse(start)) / 60000);
  return minutes > 0 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : 'End must be after start.';
}
