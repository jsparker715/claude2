/**
 * Telehealth resolution. Your sessions export carries a `session_location_type`
 * column; the host maps it to `SessionRow.telehealth` before the row reaches the
 * engine. The engine itself only ever sees the boolean.
 *
 * The exact string(s) in `session_location_type` that mean telehealth still need
 * confirming, so the match is configurable. Defaults below catch the common
 * spellings; set TELEHEALTH_LOCATION_VALUES to your real value(s) once known.
 */

/**
 * Location-type values treated as telehealth (matched case-insensitively, trimmed).
 * Confirmed values from the practice's `session_location_type` column.
 */
export const TELEHEALTH_LOCATION_VALUES = ["Telehealth", "TelehealthHome"];

/**
 * True if a `session_location_type` value denotes telehealth.
 * Pass a custom value list once the practice confirms the exact string.
 */
export function isTelehealthLocation(
  locationType: string | null | undefined,
  values: string[] = TELEHEALTH_LOCATION_VALUES
): boolean {
  if (!locationType) return false;
  const v = String(locationType).trim().toLowerCase();
  if (!v) return false;
  return values.some((x) => x.trim().toLowerCase() === v);
}
