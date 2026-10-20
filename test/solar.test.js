import assert from "node:assert/strict";
import test from "node:test";
import {
  CIVIL_TWILIGHT_ALTITUDE_DEG,
  DEFAULT_MAX_JUMP_MINUTES,
  DEFAULT_STALE_MS,
  FULL_DAY_JUMP_MINUTES,
  OFFICIAL_SUN_ALTITUDE_DEG,
  advanceIsoMinute,
  dayOfYearUtc,
  minuteJump,
  parseIsoMinute,
  stableLocalParts,
  sunEventLocalHour
} from "../src/index.js";

const MINUTES_PER_HOUR = 60;
const HALF_DAY_HOURS = 12;
const SAME_DAY_LATE_MINUTE = 23 * MINUTES_PER_HOUR + 50;
const SAME_DAY_EARLY_MINUTE = 10;

test("equinox at the equator is near 06:00 and 18:00", () => {
  const day = dayOfYearUtc(new Date(Date.UTC(2026, 2, 21, 12, 0, 0)));
  const rise = sunEventLocalHour({
    latitude: 0,
    longitude: 0,
    dayOfYear: day,
    utcOffsetHours: 0,
    altitudeDeg: OFFICIAL_SUN_ALTITUDE_DEG,
    rise: true
  });
  const set = sunEventLocalHour({
    latitude: 0,
    longitude: 0,
    dayOfYear: day,
    utcOffsetHours: 0,
    altitudeDeg: OFFICIAL_SUN_ALTITUDE_DEG,
    rise: false
  });
  assert.ok(rise.hours === 5 || rise.hours === 6);
  assert.ok(set.hours === 17 || set.hours === 18);
  assert.ok(minutesOf(rise) < minutesOf(set));
});

test("high latitude winter does not invent a sunrise", () => {
  const day = dayOfYearUtc(new Date(Date.UTC(2026, 11, 21, 12, 0, 0)));
  const rise = sunEventLocalHour({
    latitude: 78,
    longitude: 0,
    dayOfYear: day,
    utcOffsetHours: 0,
    altitudeDeg: OFFICIAL_SUN_ALTITUDE_DEG,
    rise: true
  });
  assert.equal(rise, null);
});

test("civil twilight is earlier than official sunrise", () => {
  const day = dayOfYearUtc(new Date(Date.UTC(2026, 5, 21, 16, 0, 0)));
  const shared = {
    latitude: 43.65,
    longitude: -79.38,
    dayOfYear: day,
    utcOffsetHours: -4,
    rise: true
  };
  const civil = sunEventLocalHour({ ...shared, altitudeDeg: CIVIL_TWILIGHT_ALTITUDE_DEG });
  const official = sunEventLocalHour({ ...shared, altitudeDeg: OFFICIAL_SUN_ALTITUDE_DEG });
  const civilMinute = minutesOf(civil);
  const officialMinute = minutesOf(official);
  assert.ok(civilMinute < officialMinute);
  assert.ok(officialMinute > 4 * MINUTES_PER_HOUR && officialMinute < 7 * MINUTES_PER_HOUR);
});

test("southern winter sunrise is later and the day is shorter", () => {
  const winterDay = dayOfYearUtc(new Date(Date.UTC(2026, 5, 21, 12, 0, 0)));
  const summerDay = dayOfYearUtc(new Date(Date.UTC(2026, 11, 21, 12, 0, 0)));
  const place = {
    latitude: -35,
    longitude: 0,
    utcOffsetHours: 0,
    altitudeDeg: OFFICIAL_SUN_ALTITUDE_DEG
  };
  const winterRise = sunEventLocalHour({ ...place, dayOfYear: winterDay, rise: true });
  const winterSet = sunEventLocalHour({ ...place, dayOfYear: winterDay, rise: false });
  const summerRise = sunEventLocalHour({ ...place, dayOfYear: summerDay, rise: true });
  const summerSet = sunEventLocalHour({ ...place, dayOfYear: summerDay, rise: false });
  assert.notEqual(winterRise, null);
  assert.notEqual(winterSet, null);
  assert.notEqual(summerRise, null);
  assert.notEqual(summerSet, null);
  const winterSpan = minutesOf(winterSet) - minutesOf(winterRise);
  const summerSpan = minutesOf(summerSet) - minutesOf(summerRise);
  assert.ok(minutesOf(winterRise) > minutesOf(summerRise));
  assert.ok(winterSpan < MINUTES_PER_HOUR * HALF_DAY_HOURS);
  assert.ok(summerSpan > MINUTES_PER_HOUR * HALF_DAY_HOURS);
  assert.ok(winterSpan < summerSpan);
});

test("a fresh clock refuses a multi-hour timezone jump", () => {
  const previous = {
    dateKey: "2026-06-21",
    hour: 19,
    minute: 12,
    isoMinute: "2026-06-21T19:12"
  };
  const candidate = {
    dateKey: "2026-06-21",
    hour: 22,
    minute: 40,
    isoMinute: "2026-06-21T22:40"
  };
  const stable = stableLocalParts(previous, candidate, 15000, -14400, {
    cacheAgeMs: 15000,
    maxJumpMinutes: DEFAULT_MAX_JUMP_MINUTES,
    staleMs: DEFAULT_STALE_MS
  });
  assert.equal(stable.isoMinute, "2026-06-21T19:12");
  assert.ok(minuteJump(previous, candidate) > DEFAULT_MAX_JUMP_MINUTES);
});

test("a stale clock accepts the new local minute", () => {
  const previous = {
    dateKey: "2026-06-21",
    hour: 19,
    minute: 12,
    isoMinute: "2026-06-21T19:12"
  };
  const candidate = {
    dateKey: "2026-06-21",
    hour: 19,
    minute: 20,
    isoMinute: "2026-06-21T19:20"
  };
  const ageMs = DEFAULT_STALE_MS + 20000;
  const stable = stableLocalParts(previous, candidate, ageMs, -14400, {
    cacheAgeMs: ageMs,
    maxJumpMinutes: DEFAULT_MAX_JUMP_MINUTES,
    staleMs: DEFAULT_STALE_MS
  });
  assert.equal(stable.isoMinute, "2026-06-21T19:20");
});

test("a date-key change counts as a full day", () => {
  const previous = {
    dateKey: "2026-06-21",
    hour: 23,
    minute: 50,
    isoMinute: "2026-06-21T23:50"
  };
  const nextDay = {
    dateKey: "2026-06-22",
    hour: 0,
    minute: 1,
    isoMinute: "2026-06-22T00:01"
  };
  const sameDayLate = {
    dateKey: "2026-06-21",
    hour: 23,
    minute: 50,
    isoMinute: "2026-06-21T23:50"
  };
  const sameDayEarly = {
    dateKey: "2026-06-21",
    hour: 0,
    minute: 10,
    isoMinute: "2026-06-21T00:10"
  };
  assert.equal(minuteJump(previous, nextDay), FULL_DAY_JUMP_MINUTES);
  const foldedSameDay = FULL_DAY_JUMP_MINUTES - (SAME_DAY_LATE_MINUTE - SAME_DAY_EARLY_MINUTE);
  assert.equal(minuteJump(sameDayEarly, sameDayLate), foldedSameDay);
  const stable = stableLocalParts(previous, nextDay, 15000, 0);
  assert.equal(stable.dateKey, "2026-06-21");
  assert.equal(stable.isoMinute, "2026-06-21T23:50");
});

test("parseIsoMinute returns null when the text is not a minute", () => {
  assert.equal(parseIsoMinute("not-a-minute", 0), null);
  assert.equal(parseIsoMinute("", 0), null);
  assert.equal(parseIsoMinute(null, 0), null);
  assert.equal(advanceIsoMinute("not-a-minute", 0, 60000), "not-a-minute");
});

test("a missing candidate advances the previous minute", () => {
  const previous = {
    dateKey: "2026-06-21",
    hour: 19,
    minute: 12,
    isoMinute: "2026-06-21T19:12"
  };
  const stable = stableLocalParts(previous, null, 60000, 0);
  assert.equal(stable.dateKey, "2026-06-21");
  assert.equal(stable.hour, 19);
  assert.equal(stable.minute, 13);
  assert.equal(stable.isoMinute, "2026-06-21T19:13");
  assert.equal(stableLocalParts(null, null, 60000, 0), null);
});

function minutesOf(parts) {
  return parts.hours * MINUTES_PER_HOUR + parts.minutes;
}
