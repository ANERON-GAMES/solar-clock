export const OFFICIAL_SUN_ALTITUDE_DEG = -0.833;
export const CIVIL_TWILIGHT_ALTITUDE_DEG = -6;

export function dayOfYearUtc(date) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  return Math.floor((date.getTime() - start) / 86400000);
}

export function solarDeclinationDegrees(dayOfYear) {
  const b = (2 * Math.PI / 365) * (dayOfYear - 81);
  return 23.45 * Math.sin(b);
}

export function equationOfTimeMinutes(dayOfYear) {
  const b = (2 * Math.PI / 365) * (dayOfYear - 81);
  return 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b);
}

export function hourAngleOffsetHours(latitudeDeg, declinationDeg, altitudeDeg) {
  const lat = latitudeDeg * Math.PI / 180;
  const decl = declinationDeg * Math.PI / 180;
  const altitude = altitudeDeg * Math.PI / 180;
  const denominator = Math.cos(lat) * Math.cos(decl);
  if (denominator === 0) return null;
  const cosHour = (Math.sin(altitude) - Math.sin(lat) * Math.sin(decl)) / denominator;
  if (!Number.isFinite(cosHour) || cosHour > 1 || cosHour < -1) return null;
  return (Math.acos(cosHour) * 180 / Math.PI) / 15;
}

export function normalizeClockHour(decimalHour) {
  let hour = decimalHour;
  while (hour < 0) hour += 24;
  while (hour >= 24) hour -= 24;
  let hours = Math.floor(hour);
  let minutes = Math.round((hour - hours) * 60);
  if (minutes >= 60) {
    hours += 1;
    minutes -= 60;
  }
  if (hours >= 24) hours -= 24;
  return { hours, minutes };
}

export function sunEventLocalHour(input) {
  const day = input.dayOfYear;
  const declination = solarDeclinationDegrees(day);
  const equation = equationOfTimeMinutes(day);
  const meridian = 15 * input.utcOffsetHours;
  const solarNoon = (720 - 4 * (input.longitude - meridian) - equation) / 60;
  const offset = hourAngleOffsetHours(input.latitude, declination, input.altitudeDeg);
  if (offset == null) return null;
  const decimal = input.rise ? solarNoon - offset : solarNoon + offset;
  return normalizeClockHour(decimal);
}
