export const OFFICIAL_SUN_ALTITUDE_DEG = -0.833;
export const CIVIL_TWILIGHT_ALTITUDE_DEG = -6;
export const DECLINATION_AMPLITUDE_DEG = 23.45;
export const EQUATION_OF_TIME_SIN_2B_MIN = 9.87;
export const EQUATION_OF_TIME_COS_B_MIN = 7.53;
export const EQUATION_OF_TIME_SIN_B_MIN = 1.5;
export const EQUINOX_ANCHOR_DAY = 81;
export const MEAN_YEAR_DAYS = 365;
export const DEGREES_PER_HOUR = 15;
export const MS_PER_DAY = 86400000;

const DEGREES_PER_TURN = 360;
const FULL_TURN_RADIANS = 2 * Math.PI;
const EQUATION_SECOND_HARMONIC = 2;
const COSINE_LIMIT = 1;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_HALF_DAY = 12;
const HOURS_PER_DAY = 24;
const JANUARY_INDEX = 0;
const FIRST_UTC_DAY = 1;
const MINUTES_PER_LONGITUDE_DEGREE = MINUTES_PER_HOUR / DEGREES_PER_HOUR;

export function dayOfYearUtc(date) {
  const yearStartMs = Date.UTC(date.getUTCFullYear(), JANUARY_INDEX, FIRST_UTC_DAY);
  const elapsedDays = Math.floor((date.getTime() - yearStartMs) / MS_PER_DAY);
  return elapsedDays + FIRST_UTC_DAY;
}

export function solarDeclinationDegrees(dayOfYear) {
  return DECLINATION_AMPLITUDE_DEG * Math.sin(yearAngleRadians(dayOfYear));
}

export function equationOfTimeMinutes(dayOfYear) {
  const angle = yearAngleRadians(dayOfYear);
  const doubleAngle = EQUATION_SECOND_HARMONIC * angle;
  return (
    EQUATION_OF_TIME_SIN_2B_MIN * Math.sin(doubleAngle) -
    EQUATION_OF_TIME_COS_B_MIN * Math.cos(angle) -
    EQUATION_OF_TIME_SIN_B_MIN * Math.sin(angle)
  );
}

export function hourAngleOffsetHours(latitudeDeg, declinationDeg, altitudeDeg) {
  const cosHour = cosineOfHourAngle(latitudeDeg, declinationDeg, altitudeDeg);
  if (cosHour == null) {
    return null;
  }
  return radiansToDegrees(Math.acos(cosHour)) / DEGREES_PER_HOUR;
}

export function normalizeClockHour(decimalHour) {
  return clockParts(wrapHour(decimalHour));
}

export function sunEventLocalHour(input) {
  const declination = solarDeclinationDegrees(input.dayOfYear);
  const offset = hourAngleOffsetHours(input.latitude, declination, input.altitudeDeg);
  if (offset == null) {
    return null;
  }
  const solarNoon = solarNoonHours(input);
  const decimalHour = input.rise ? solarNoon - offset : solarNoon + offset;
  return normalizeClockHour(decimalHour);
}

function yearAngleRadians(dayOfYear) {
  return (FULL_TURN_RADIANS / MEAN_YEAR_DAYS) * (dayOfYear - EQUINOX_ANCHOR_DAY);
}

function cosineOfHourAngle(latitudeDeg, declinationDeg, altitudeDeg) {
  const latitude = degreesToRadians(latitudeDeg);
  const declination = degreesToRadians(declinationDeg);
  const altitude = degreesToRadians(altitudeDeg);
  const denominator = Math.cos(latitude) * Math.cos(declination);
  if (denominator === 0) {
    return null;
  }
  const cosHour = (Math.sin(altitude) - Math.sin(latitude) * Math.sin(declination)) / denominator;
  if (!Number.isFinite(cosHour) || cosHour > COSINE_LIMIT || cosHour < -COSINE_LIMIT) {
    return null;
  }
  return cosHour;
}

function solarNoonHours(input) {
  const meridian = DEGREES_PER_HOUR * input.utcOffsetHours;
  const longitudeMinutes = MINUTES_PER_LONGITUDE_DEGREE * (input.longitude - meridian);
  const noonMinutes = HOURS_PER_HALF_DAY * MINUTES_PER_HOUR;
  return (
    (noonMinutes - longitudeMinutes - equationOfTimeMinutes(input.dayOfYear)) / MINUTES_PER_HOUR
  );
}

function degreesToRadians(degrees) {
  return (degrees * FULL_TURN_RADIANS) / DEGREES_PER_TURN;
}

function radiansToDegrees(radians) {
  return (radians * DEGREES_PER_TURN) / FULL_TURN_RADIANS;
}

function wrapHour(decimalHour) {
  let hour = decimalHour;
  while (hour < 0) {
    hour += HOURS_PER_DAY;
  }
  while (hour >= HOURS_PER_DAY) {
    hour -= HOURS_PER_DAY;
  }
  return hour;
}

function clockParts(hour) {
  let hours = Math.floor(hour);
  let minutes = Math.round((hour - hours) * MINUTES_PER_HOUR);
  if (minutes >= MINUTES_PER_HOUR) {
    hours += 1;
    minutes -= MINUTES_PER_HOUR;
  }
  if (hours >= HOURS_PER_DAY) {
    hours -= HOURS_PER_DAY;
  }
  return { hours, minutes };
}
