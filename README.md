# solar-clock

Civil sunrise, sunset, and twilight from latitude and longitude, plus a local minute clock that refuses a sudden timezone jump.

A schedule that trusts a raw timezone response can fire an hour early when the response glitches. This library keeps the last good local minute until the cache is stale, and it returns no event when the sun does not cross the requested altitude.

The sun position is the standard NOAA approximation: declination, equation of time, and the hour angle for a chosen altitude. Official sunrise uses -0.833 degrees. Civil twilight uses -6 degrees.

```js
import { OFFICIAL_SUN_ALTITUDE_DEG, dayOfYearUtc, sunEventLocalHour } from "./src/index.js";

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

`stableLocalParts` is the piece to reuse in any scheduler. If the new local minute is more than 90 minutes away and the previous sample is younger than 3 minutes, the clock advances the previous sample by elapsed time instead of accepting the jump.

No network calls. No stored location. Pass coordinates in from your own configuration.

```
node --test
```

MIT. Vadim Gubin.
