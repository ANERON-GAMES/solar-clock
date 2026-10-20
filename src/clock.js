const HOURS_PER_DAY = 24;
const MINUTES_PER_HOUR = 60;
const HALF_DAY_HOURS = 12;
const SECONDS_PER_MINUTE = 60;
const MS_PER_SECOND = 1000;
const STALE_AFTER_MINUTES = 3;
const PAD_BELOW = 10;
const ISO_MINUTE_LENGTH = 16;
const MONTH_INDEX_OFFSET = 1;
const NO_JUMP_MINUTES = 0;

export const DEFAULT_MAX_JUMP_MINUTES = 90;
export const DEFAULT_STALE_MS = STALE_AFTER_MINUTES * SECONDS_PER_MINUTE * MS_PER_SECOND;
export const FULL_DAY_JUMP_MINUTES = HOURS_PER_DAY * MINUTES_PER_HOUR;

const HALF_DAY_MINUTES = HALF_DAY_HOURS * MINUTES_PER_HOUR;
const ISO_MINUTE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

export function pad2(value) {
  const n = Number(value);
  if (n < PAD_BELOW) {
    return "0" + n;
  }
  return String(n);
}

export function localPartsFromOffset(utcMs, offsetSeconds) {
  const shifted = new Date(utcMs + offsetSeconds * MS_PER_SECOND);
  return partsFromDate(shifted);
}

export function parseIsoMinute(isoMinute, offsetSeconds) {
  const match = matchIsoMinute(isoMinute);
  if (match == null) {
    return null;
  }
  return utcMillisFromMatch(match) - offsetSeconds * MS_PER_SECOND;
}

export function advanceIsoMinute(isoMinute, offsetSeconds, elapsedMs) {
  const base = parseIsoMinute(isoMinute, offsetSeconds);
  if (base == null) {
    return isoMinute;
  }
  return localPartsFromOffset(base + elapsedMs, offsetSeconds).isoMinute;
}

export function minuteJump(previous, next) {
  if (!previous || !next) {
    return NO_JUMP_MINUTES;
  }
  if (previous.dateKey !== next.dateKey) {
    return FULL_DAY_JUMP_MINUTES;
  }
  return sameDayJumpMinutes(previous, next);
}

export function stableLocalParts(previous, candidate, elapsedMs, offsetSeconds, options) {
  if (!candidate) {
    return partsAfterElapsed(previous, elapsedMs, offsetSeconds);
  }
  if (refusesJump(previous, candidate, elapsedMs, options)) {
    return partsFromAdvancedMinute(previous, elapsedMs, offsetSeconds);
  }
  return candidate;
}

function partsFromDate(shifted) {
  const year = shifted.getUTCFullYear();
  const month = pad2(shifted.getUTCMonth() + MONTH_INDEX_OFFSET);
  const day = pad2(shifted.getUTCDate());
  const hour = shifted.getUTCHours();
  const minute = shifted.getUTCMinutes();
  const dateKey = year + "-" + month + "-" + day;
  return {
    dateKey,
    hour,
    minute,
    isoMinute: dateKey + "T" + pad2(hour) + ":" + pad2(minute)
  };
}

function matchIsoMinute(isoMinute) {
  return String(isoMinute || "")
    .slice(0, ISO_MINUTE_LENGTH)
    .match(ISO_MINUTE_PATTERN);
}

function utcMillisFromMatch(match) {
  const [, year, month, day, hour, minute] = match;
  return Date.UTC(
    Number(year),
    Number(month) - MONTH_INDEX_OFFSET,
    Number(day),
    Number(hour),
    Number(minute)
  );
}

function sameDayJumpMinutes(previous, next) {
  let jump = Math.abs(minutesOfDay(next) - minutesOfDay(previous));
  if (jump > HALF_DAY_MINUTES) {
    jump = FULL_DAY_JUMP_MINUTES - jump;
  }
  return jump;
}

function minutesOfDay(parts) {
  return parts.hour * MINUTES_PER_HOUR + parts.minute;
}

function refusesJump(previous, candidate, elapsedMs, options) {
  if (!previous) {
    return false;
  }
  const maxJumpMinutes = optionOrDefault(options, "maxJumpMinutes", DEFAULT_MAX_JUMP_MINUTES);
  const staleMs = optionOrDefault(options, "staleMs", DEFAULT_STALE_MS);
  const cacheAgeMs = optionOrDefault(options, "cacheAgeMs", elapsedMs);
  return cacheAgeMs < staleMs && minuteJump(previous, candidate) > maxJumpMinutes;
}

function optionOrDefault(options, key, fallback) {
  if (options && options[key] != null) {
    return options[key];
  }
  return fallback;
}

function partsAfterElapsed(previous, elapsedMs, offsetSeconds) {
  if (!previous) {
    return null;
  }
  const base = parseIsoMinute(previous.isoMinute, offsetSeconds);
  return localPartsFromOffset(base + elapsedMs, offsetSeconds);
}

function partsFromAdvancedMinute(previous, elapsedMs, offsetSeconds) {
  const advanced = advanceIsoMinute(previous.isoMinute, offsetSeconds, elapsedMs);
  return localPartsFromOffset(parseIsoMinute(advanced, offsetSeconds), offsetSeconds);
}
