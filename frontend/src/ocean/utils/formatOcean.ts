export function formatScalar(
  value: number | null | undefined,
  digits = 1,
): string {
  if (value == null || !Number.isFinite(value)) return 'N/A';
  return value.toFixed(digits);
}

export function formatScalarWithUnit(
  value: number | null | undefined,
  unit: string,
  digits = 1,
): string {
  const formatted = formatScalar(value, digits);
  return formatted === 'N/A' ? 'N/A' : `${formatted} ${unit}`;
}

export function formatLatitude(lat: number | null | undefined): string {
  if (lat == null || !Number.isFinite(lat)) return 'N/A';
  const hemi = lat >= 0 ? 'N' : 'S';
  return `${Math.abs(lat).toFixed(2)}°${hemi}`;
}

export function formatLongitude(lon: number | null | undefined): string {
  if (lon == null || !Number.isFinite(lon)) return 'N/A';
  const hemi = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lon).toFixed(2)}°${hemi}`;
}

export function formatDepthMeters(depth: number | null | undefined): string {
  if (depth == null || !Number.isFinite(depth)) return 'N/A';
  return `${Math.round(depth)} m`;
}

export function formatTimestampLabel(iso: string): { short: string; full: string } {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return { short: iso, full: iso };
  }
  const short = date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  });
  const full = date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  });
  return { short, full: `${full} UTC` };
}
