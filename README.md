# solar-clock

Civil sunrise, sunset, and twilight from latitude and longitude, plus a local minute clock that refuses a sudden timezone jump.

A schedule that trusts a raw timezone response can fire an hour early when the response glitches. This library keeps the last good local minute until the cache is stale. It returns no sun event when the sun does not cross the requested altitude.

The sun position is the standard NOAA approximation: declination, equation of time, and the hour angle for a chosen altitude. Official sunrise uses -0.833 degrees. Civil twilight uses -6 degrees. Longitude is degrees east of Greenwich, so the western hemisphere is negative. `utcOffsetHours` is hours ahead of UTC, so a zone west of UTC is negative. The library does not look up time zones or daylight-saving rules. Pass the offset that applies on that day.

No network calls. No stored location. Pass coordinates in from your own configuration.

## Install

The package is an ES module. It needs Node.js 20 or newer. It has no runtime dependencies. The package name is `@aneron/solar-clock`. It is not published to the npm registry.

Clone this repository and run the tests:

```bash
git clone https://github.com/ANERON-GAMES/solar-clock.git
cd solar-clock
npm install
npm test
```

`npm test` runs `node --test`. `npm run lint` runs ESLint. `npm run format:check` runs Prettier.

Install it as a dependency from the git repository:

```bash
npm install github:ANERON-GAMES/solar-clock
```

```js
import { OFFICIAL_SUN_ALTITUDE_DEG, dayOfYearUtc, sunEventLocalHour } from "@aneron/solar-clock";
```

Code in this repository imports the same entry point with `./src/index.js`.

## Usage

Ask for official sunrise in local hours. The day number is the UTC day of year, from 1 through 366.

```js
import { OFFICIAL_SUN_ALTITUDE_DEG, dayOfYearUtc, sunEventLocalHour } from "@aneron/solar-clock";

const when = new Date(Date.UTC(2026, 5, 21, 16, 0, 0));
const rise = sunEventLocalHour({
  latitude: 43.65,
  longitude: -79.38,
  dayOfYear: dayOfYearUtc(when),
  utcOffsetHours: -4,
  altitudeDeg: OFFICIAL_SUN_ALTITUDE_DEG,
  rise: true
});
```

`rise` is `{ hours, minutes }` in local standard time for that offset. On this June day the hour is in the early morning. The same call with `rise: false` is sunset. Pass `CIVIL_TWILIGHT_ALTITUDE_DEG` for civil twilight. Civil twilight is earlier than official sunrise and later than official sunset.

A high latitude in winter does not invent an event. `sunEventLocalHour` returns `null` when the sun does not cross the altitude.

`stableLocalParts` is the piece to reuse in any scheduler. If the new local minute is more than 90 minutes away and the previous sample is younger than 3 minutes, the clock advances the previous sample by elapsed time instead of accepting the jump.

```js
import { stableLocalParts } from "@aneron/solar-clock";

const previous = {
  dateKey: "2026-06-21",
  hour: 19,
  minute: 12,
  isoMinute: "2026-06-21T19:12"
};
const jumped = {
  dateKey: "2026-06-21",
  hour: 22,
  minute: 40,
  isoMinute: "2026-06-21T22:40"
};

const held = stableLocalParts(previous, jumped, 15000, -14400);
```

`held.isoMinute` stays `"2026-06-21T19:12"`. Fifteen seconds do not cross a minute, so advancing the previous sample leaves the minute unchanged. Once the cache is at least 3 minutes old, the same shape of call accepts the candidate.

A missing candidate does not clear the clock. It advances the previous minute by the elapsed time.

```js
const advanced = stableLocalParts(previous, null, 60000, -14400);
```

`advanced.isoMinute` is `"2026-06-21T19:13"`.

## API reference

All functions are pure. They do not read the clock, the network, or the filesystem. The caller passes the instant, the offset, and the previous sample.

### Constants

| Export                        | Value      | Meaning                                                                                    |
| ----------------------------- | ---------- | ------------------------------------------------------------------------------------------ |
| `OFFICIAL_SUN_ALTITUDE_DEG`   | `-0.833`   | Altitude for official sunrise and sunset, including the usual refraction and solar radius. |
| `CIVIL_TWILIGHT_ALTITUDE_DEG` | `-6`       | Altitude for civil twilight.                                                               |
| `DECLINATION_AMPLITUDE_DEG`   | `23.45`    | Amplitude of the sine-wave declination, in degrees.                                        |
| `EQUATION_OF_TIME_SIN_2B_MIN` | `9.87`     | Coefficient of `sin(2B)` in the equation of time, in minutes.                              |
| `EQUATION_OF_TIME_COS_B_MIN`  | `7.53`     | Coefficient of `cos(B)` in the equation of time, in minutes.                               |
| `EQUATION_OF_TIME_SIN_B_MIN`  | `1.5`      | Coefficient of `sin(B)` in the equation of time, in minutes.                               |
| `EQUINOX_ANCHOR_DAY`          | `81`       | Day of year where this approximation puts the March equinox.                               |
| `MEAN_YEAR_DAYS`              | `365`      | Day count in the fractional-year angle. Leap day 366 still uses this divisor.              |
| `DEGREES_PER_HOUR`            | `15`       | Earth rotation used to turn an hour angle into hours, and to place the standard meridian.  |
| `MS_PER_DAY`                  | `86400000` | Milliseconds in a day. `dayOfYearUtc` divides by this.                                     |
| `DEFAULT_MAX_JUMP_MINUTES`    | `90`       | Default largest jump `stableLocalParts` will accept while the cache is fresh.              |
| `DEFAULT_STALE_MS`            | `180000`   | Default cache age, 3 minutes, after which a large jump is accepted.                        |
| `FULL_DAY_JUMP_MINUTES`       | `1440`     | Value `minuteJump` returns when the date keys differ.                                      |

### `dayOfYearUtc(date)`

Return the UTC day of year for a `Date`, starting at 1 on 1 January. A leap year returns 366 on 31 December.

| Argument | Type   | Role                                              |
| -------- | ------ | ------------------------------------------------- |
| `date`   | `Date` | Instant read with `getTime` and `getUTCFullYear`. |

The result is a positive integer. The function does not interpret the local time zone of the process.

### `solarDeclinationDegrees(dayOfYear)`

Return the solar declination in degrees for a day of year.

```
B = 2π * (dayOfYear - EQUINOX_ANCHOR_DAY) / MEAN_YEAR_DAYS
declination = DECLINATION_AMPLITUDE_DEG * sin(B)
```

Day 81 returns 0. Midsummer is near `+23.45`. Midwinter is near `-23.45`.

### `equationOfTimeMinutes(dayOfYear)`

Return the equation of time in minutes for a day of year. `B` is the same angle as in `solarDeclinationDegrees`.

```
equation = EQUATION_OF_TIME_SIN_2B_MIN * sin(2B)
         - EQUATION_OF_TIME_COS_B_MIN * cos(B)
         - EQUATION_OF_TIME_SIN_B_MIN * sin(B)
```

The value is positive in some parts of the year and negative in others. The result is minutes to apply in the solar-noon formula, not a clock reading.

### `hourAngleOffsetHours(latitudeDeg, declinationDeg, altitudeDeg)`

Return the hour angle at which the sun reaches `altitudeDeg`, expressed in hours. Sunrise is this many hours before solar noon. Sunset is this many hours after it.

| Argument         | Type   | Role                                                               |
| ---------------- | ------ | ------------------------------------------------------------------ |
| `latitudeDeg`    | number | Latitude in degrees north. Southern latitudes are negative.        |
| `declinationDeg` | number | Declination in degrees, usually from `solarDeclinationDegrees`.    |
| `altitudeDeg`    | number | Target altitude in degrees. Negative values are below the horizon. |

The return value is a non-negative number of hours, or `null`.

`null` means the sun does not cross that altitude. The cosine of the hour angle is not finite or lies outside `-1` to `1`, which is polar day or polar night for that altitude. `null` is also returned when the denominator `cos(latitude) * cos(declination)` is 0.

### `normalizeClockHour(decimalHour)`

Wrap a decimal hour into a clock time.

| Argument      | Type   | Role                                                           |
| ------------- | ------ | -------------------------------------------------------------- |
| `decimalHour` | number | Hours from local midnight. May be negative or greater than 24. |

The return value is `{ hours, minutes }`.

| Field     | Type   | Meaning                           |
| --------- | ------ | --------------------------------- |
| `hours`   | number | Integer hour from 0 through 23.   |
| `minutes` | number | Integer minute from 0 through 59. |

The hour is shifted by whole days until it lies in `[0, 24)`. Minutes are rounded. A minute of 60 rolls into the next hour. An hour of 24 rolls back to 0.

### `sunEventLocalHour(input)`

Return local sunrise or sunset for one day, or `null` when the sun does not cross the altitude.

| Field            | Type    | Role                                                                    |
| ---------------- | ------- | ----------------------------------------------------------------------- |
| `dayOfYear`      | number  | UTC day of year, usually from `dayOfYearUtc`.                           |
| `latitude`       | number  | Degrees north. Negative in the southern hemisphere.                     |
| `longitude`      | number  | Degrees east. Negative in the western hemisphere.                       |
| `utcOffsetHours` | number  | Local standard time minus UTC, in hours.                                |
| `altitudeDeg`    | number  | Altitude to solve. Use the exported altitude constants or pass another. |
| `rise`           | boolean | `true` for the morning crossing, `false` for the evening crossing.      |

The return value is `{ hours, minutes }` from `normalizeClockHour`, or `null`.

The checks run in this order.

1. Declination and the equation of time come from `dayOfYear`.
2. Solar noon, in local hours, is `(720 - 4 * (longitude - 15 * utcOffsetHours) - equationOfTimeMinutes) / 60`. `15` is `DEGREES_PER_HOUR`. Four minutes is the time the Earth takes to rotate one degree. `720` is local noon in minutes.
3. The hour-angle offset comes from `hourAngleOffsetHours`. If that offset is `null`, this function returns `null`. It does not invent a sunrise, a sunset, or a noon substitute.
4. Morning is solar noon minus the offset. Evening is solar noon plus the offset.
5. The decimal hour is passed through `normalizeClockHour`.

A southern-hemisphere latitude reverses the seasons. June is the short day. December is the long day. The function does not branch on hemisphere. The sign of the latitude does that work.

### `pad2(value)`

Return a two-digit string for an integer below 10, and the decimal string otherwise.

| Argument | Type   | Role                         |
| -------- | ------ | ---------------------------- |
| `value`  | number | Value coerced with `Number`. |

`pad2(3)` is `"03"`. `pad2(10)` is `"10"`. A negative value below 10 is prefixed as well, so `pad2(-1)` is `"0-1"`. `localPartsFromOffset` uses it for the month, day, hour, and minute inside `isoMinute`. `hour` and `minute` on the returned object stay numbers.

### `localPartsFromOffset(utcMs, offsetSeconds)`

Turn a UTC instant into local calendar parts for a fixed offset.

| Argument        | Type   | Role                                                                |
| --------------- | ------ | ------------------------------------------------------------------- |
| `utcMs`         | number | Milliseconds since the Unix epoch, UTC.                             |
| `offsetSeconds` | number | Local standard time minus UTC, in seconds. West of UTC is negative. |

The return value is a local minute:

| Field       | Type   | Meaning                                        |
| ----------- | ------ | ---------------------------------------------- |
| `dateKey`   | string | `YYYY-MM-DD` in that offset.                   |
| `hour`      | number | Hour from 0 through 23.                        |
| `minute`    | number | Minute from 0 through 59. Seconds are dropped. |
| `isoMinute` | string | `YYYY-MM-DDTHH:mm`, zero-padded.               |

The shift is `utcMs + offsetSeconds * 1000`, read back with UTC getters. That keeps the process time zone out of the result.

### `parseIsoMinute(isoMinute, offsetSeconds)`

Parse a local minute string back to UTC milliseconds.

| Argument        | Type   | Role                                                |
| --------------- | ------ | --------------------------------------------------- |
| `isoMinute`     | string | Text beginning with `YYYY-MM-DDTHH:mm`.             |
| `offsetSeconds` | number | The offset that was used to build the local minute. |

Only the first 16 characters are read. A longer timestamp such as `2026-06-21T19:12:40` still parses as `2026-06-21T19:12`. The match is four digits, a hyphen, two digits, a hyphen, two digits, `T`, two digits, a colon, and two digits.

The return value is UTC milliseconds, or `null` when the text does not match. `null`, `undefined`, and `""` do not match. The calendar fields are not checked beyond the digit shape. `Date.UTC` rolls an impossible month or day into a neighboring date. A shape failure is `null`. A rolled date is still a number.

### `advanceIsoMinute(isoMinute, offsetSeconds, elapsedMs)`

Move a local minute forward by elapsed milliseconds and return the new `isoMinute` string.

| Argument        | Type   | Role                                          |
| --------------- | ------ | --------------------------------------------- |
| `isoMinute`     | string | A local minute, as in `parseIsoMinute`.       |
| `offsetSeconds` | number | Offset used to parse and to format.           |
| `elapsedMs`     | number | Milliseconds to add. May be zero or negative. |

If `parseIsoMinute` returns `null`, the original `isoMinute` is returned unchanged. Otherwise the result is the `isoMinute` field of `localPartsFromOffset` at the advanced instant. Sub-minute time is dropped on the way back to a minute string.

### `minuteJump(previous, next)`

Return how many minutes apart two local minutes are, for the jump check. This is not a general elapsed-time function.

| Argument   | Type            | Role                                                 |
| ---------- | --------------- | ---------------------------------------------------- |
| `previous` | object or falsy | A local minute with `dateKey`, `hour`, and `minute`. |
| `next`     | object or falsy | The candidate local minute.                          |

| Result                           | When                                                                                                                                                                                                         |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `0`                              | `previous` or `next` is falsy.                                                                                                                                                                               |
| `FULL_DAY_JUMP_MINUTES` (`1440`) | The `dateKey` strings differ. The clock times are not subtracted. One minute past midnight on the next date is a full day, the same as a jump of many days.                                                  |
| The shorter same-day distance    | The date keys match. The absolute difference of `hour * 60 + minute` is used. A difference above 12 hours is folded across midnight: `1440 - difference`. On one date, 00:10 and 23:50 are 20 minutes apart. |

Folding happens only inside one date key. A different date key does not fold, and it does not return the real number of minutes between the two instants.

### `stableLocalParts(previous, candidate, elapsedMs, offsetSeconds, options)`

Choose the local minute a scheduler should trust.

| Argument        | Type             | Role                                                                  |
| --------------- | ---------------- | --------------------------------------------------------------------- |
| `previous`      | object or falsy  | The last accepted local minute, including `isoMinute`.                |
| `candidate`     | object or falsy  | The newly reported local minute. Falsy means the report is missing.   |
| `elapsedMs`     | number           | Milliseconds since the previous sample was taken.                     |
| `offsetSeconds` | number           | Offset passed through to `parseIsoMinute` and `localPartsFromOffset`. |
| `options`       | object, optional | Overrides below. Omit the object to use every default.                |

| Option           | Default                           | Meaning                                                                                |
| ---------------- | --------------------------------- | -------------------------------------------------------------------------------------- |
| `maxJumpMinutes` | `DEFAULT_MAX_JUMP_MINUTES` (`90`) | A larger `minuteJump` is refused while the cache is fresh.                             |
| `staleMs`        | `DEFAULT_STALE_MS` (`180000`)     | At this age, and after it, a large jump is accepted.                                   |
| `cacheAgeMs`     | `elapsedMs`                       | Age of the cached minute. Pass this when the sample interval and the cache age differ. |

An option set to `null` or `undefined` uses the default. `0` is a real override.

The checks run in this order. The first match wins.

1. `candidate` is falsy. If `previous` is also falsy, return `null`. Otherwise advance the previous minute by `elapsedMs` and return that local minute. A missing report does not erase the clock, and it does not repeat the stale minute once time has passed.
2. `previous` is present, `cacheAgeMs` is strictly less than `staleMs`, and `minuteJump(previous, candidate)` is strictly greater than `maxJumpMinutes`. Refuse the candidate. Advance the previous `isoMinute` by `elapsedMs` and return that local minute. A different `dateKey` counts as a full day, so a fresh cache refuses a date-key change even when the clock times are one minute apart.
3. Otherwise return `candidate` unchanged. This includes a large jump once `cacheAgeMs` is greater than or equal to `staleMs`, a small jump, and any candidate when there is no previous sample.

The advanced minute is the same shape as `localPartsFromOffset`: `dateKey`, `hour`, `minute`, and `isoMinute`.

## Design notes

The sun routines answer one question: at what local hour does the sun cross an altitude on this day of the year. They do not track the sun through the day, and they do not know a named time zone. Official and civil altitudes are the two crossings a schedule usually wants. Any other altitude is a normal argument. Polar day and polar night are `null` for both morning and evening. A caller that turns the result into an on/off schedule should treat `null` as no crossing.

The approximation is the fixed NOAA teaching formula. Declination is a single sine wave of amplitude 23.45 degrees, anchored so day 81 has zero declination. The equation of time is the three-term minute polynomial in that same angle. The year divisor is 365 even in a leap year. At mid-latitudes the error is minutes, which is enough to schedule an event against sunrise. It is not an almanac.

The clock routines answer a different question: did this local minute jump farther than a timezone glitch should be allowed to jump. The interesting failure is a fresh cache. A response that moves the wall clock by more than 90 minutes, while the last good minute is younger than 3 minutes, is ignored. The schedule then continues from the last good minute plus the time that actually elapsed. Once the cache is 3 minutes old, that refusal no longer applies and the new minute is accepted, including a daylight-saving change that arrived late.

`minuteJump` is deliberately coarser than subtraction of two instants. The date key is the whole local date. Two samples on different dates are reported as a full day of 1440 minutes, even when one is 23:59 and the other is 00:00 the next day. That makes a fresh cache refuse the jump. The real elapsed minute is not recovered from the date keys. Inside one date, a gap of more than 12 hours is the short way around the clock, so 00:10 and 23:50 are a small jump and are accepted.

A missing candidate is the other half of the same rule. The previous minute is advanced by `elapsedMs`. It is not frozen, and it is not replaced with an empty reading. If both sides are missing, the result is `null` and the caller has nothing to schedule.

This module does not open sockets, read a timezone database, or store the last minute. The caller owns the coordinates, the offset, and the cache.

## Compatibility

Version 1.1.0 keeps every function name, argument order, and return shape from 1.0.0. Sunrise, sunset, twilight, day of year, and the jump rules produce the same results.

`minuteJump` still returns 1440 when the date keys differ, and it still folds a same-day gap that is longer than 12 hours. `sunEventLocalHour` still returns `null` when the altitude is not crossed. `stableLocalParts` still advances the previous minute when the candidate is missing, and it still does so when a fresh cache refuses a jump.

The named constants are new exports. They are the coefficients and defaults that 1.0.0 inlined. `DEFAULT_MAX_JUMP_MINUTES` is 90. `DEFAULT_STALE_MS` is 180000. Passing those options explicitly is unchanged. Omitting `options` still uses those defaults.

## License

Released under the MIT License. The full text is in [LICENSE](LICENSE).
