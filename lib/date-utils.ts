const MAX_TIMEZONE_OFFSET_MINUTES = 14 * 60;

function isValidTimezoneOffset(value: number) {
  return Number.isFinite(value) && value >= -MAX_TIMEZONE_OFFSET_MINUTES && value <= MAX_TIMEZONE_OFFSET_MINUTES;
}

export function getClientTimezoneOffsetMinutes() {
  return Math.trunc(new Date().getTimezoneOffset());
}

export function normalizeTimezoneOffsetMinutes(value: unknown, fallback = 0) {
  const parsed = Math.trunc(Number(value));
  if (!isValidTimezoneOffset(parsed)) return fallback;
  return parsed;
}

export function getIsoDateForTimezoneOffset(offsetMinutes: number) {
  const normalizedOffset = normalizeTimezoneOffsetMinutes(offsetMinutes, 0);
  const localDate = new Date(Date.now() - normalizedOffset * 60_000);
  return localDate.toISOString().slice(0, 10);
}

export function getCurrentIsoDate() {
  return getIsoDateForTimezoneOffset(getClientTimezoneOffsetMinutes());
}
