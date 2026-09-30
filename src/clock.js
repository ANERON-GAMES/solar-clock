export function pad2(value) {
  const n = Number(value);
  return n < 10 ? "0" + n : String(n);
}

export function localPartsFromOffset(utcMs, offsetSeconds) {
  const shifted = new Date(utcMs + offsetSeconds * 1000);
  const year = shifted.getUTCFullYear();
  const month = pad2(shifted.getUTCMonth() + 1);
  const day = pad2(shifted.getUTCDate());
  const hour = shifted.getUTCHours();
  const minute = shifted.getUTCMinutes();
  return {
    dateKey: year + "-" + month + "-" + day,
    hour,
    minute,
    isoMinute: year + "-" + month + "-" + day + "T" + pad2(hour) + ":" + pad2(minute)
  };
}

export function parseIsoMinute(isoMinute, offsetSeconds) {
  const match = String(isoMinute || "").slice(0, 16).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return null;
  return Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5])
  ) - offsetSeconds * 1000;
}

export function advanceIsoMinute(isoMinute, offsetSeconds, elapsedMs) {
  const base = parseIsoMinute(isoMinute, offsetSeconds);
  if (base == null) return isoMinute;
  return localPartsFromOffset(base + elapsedMs, offsetSeconds).isoMinute;
}

export function minuteJump(previous, next) {
  if (!previous || !next) return 0;
  if (previous.dateKey !== next.dateKey) return 24 * 60;
  const prev = previous.hour * 60 + previous.minute;
  const nxt = next.hour * 60 + next.minute;
  let jump = Math.abs(nxt - prev);
  if (jump > 12 * 60) jump = 24 * 60 - jump;
  return jump;
}

export function stableLocalParts(previous, candidate, elapsedMs, offsetSeconds, options) {
  const maxJumpMinutes = options && options.maxJumpMinutes != null ? options.maxJumpMinutes : 90;
  const staleMs = options && options.staleMs != null ? options.staleMs : 180000;
  const cacheAgeMs = options && options.cacheAgeMs != null ? options.cacheAgeMs : elapsedMs;
  if (!candidate) {
    if (!previous) return null;
    return localPartsFromOffset(parseIsoMinute(previous.isoMinute, offsetSeconds) + elapsedMs, offsetSeconds);
  }
  if (previous && cacheAgeMs < staleMs && minuteJump(previous, candidate) > maxJumpMinutes) {
    const advanced = advanceIsoMinute(previous.isoMinute, offsetSeconds, elapsedMs);
    return localPartsFromOffset(parseIsoMinute(advanced, offsetSeconds), offsetSeconds);
  }
  return candidate;
}
