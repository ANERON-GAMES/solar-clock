import assert from "node:assert/strict";
import test from "node:test";
import {
  CIVIL_TWILIGHT_ALTITUDE_DEG,
  OFFICIAL_SUN_ALTITUDE_DEG,
  dayOfYearUtc,
  minuteJump,
  stableLocalParts,
  sunEventLocalHour
} from "../src/index.js";

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
  assert.ok(rise.hours * 60 + rise.minutes < set.hours * 60 + set.minutes);
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
  const civilMinute = civil.hours * 60 + civil.minutes;
  const officialMinute = official.hours * 60 + official.minutes;
  assert.ok(civilMinute < officialMinute);
  assert.ok(officialMinute > 4 * 60 && officialMinute < 7 * 60);
});

test("a fresh clock refuses a multi-hour timezone jump", () => {
  const previous = { dateKey: "2026-06-21", hour: 19, minute: 12, isoMinute: "2026-06-21T19:12" };
  const candidate = { dateKey: "2026-06-21", hour: 22, minute: 40, isoMinute: "2026-06-21T22:40" };
  const stable = stableLocalParts(previous, candidate, 15000, -14400, {
    cacheAgeMs: 15000,
    maxJumpMinutes: 90,
    staleMs: 180000
  });
  assert.equal(stable.isoMinute, "2026-06-21T19:12");
  assert.ok(minuteJump(previous, candidate) > 90);
});

test("a stale clock accepts the new local minute", () => {
  const previous = { dateKey: "2026-06-21", hour: 19, minute: 12, isoMinute: "2026-06-21T19:12" };
  const candidate = { dateKey: "2026-06-21", hour: 19, minute: 20, isoMinute: "2026-06-21T19:20" };
  const stable = stableLocalParts(previous, candidate, 200000, -14400, {
    cacheAgeMs: 200000,
    maxJumpMinutes: 90,
    staleMs: 180000
  });
  assert.equal(stable.isoMinute, "2026-06-21T19:20");
});
