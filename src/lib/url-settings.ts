/**
 * URL-based settings encoding for shareable links.
 * Encodes only the diff from defaults to keep URLs short.
 */

/** Return only the keys in `settings` whose values differ from `defaults`. */
export function settingsToDiff(
  settings: Record<string, unknown>,
  defaults: Record<string, unknown>,
): Record<string, unknown> {
  const diff: Record<string, unknown> = {}
  for (const key of Object.keys(settings)) {
    const a = settings[key]
    const b = defaults[key]
    // Deep-compare arrays/objects via JSON, primitive compare via ===
    if (typeof a === "object" || typeof b === "object") {
      if (JSON.stringify(a) !== JSON.stringify(b)) diff[key] = a
    } else if (a !== b) {
      diff[key] = a
    }
  }
  return diff
}

/** Encode a settings object to a URL-safe base64 string. */
export function settingsToBase64Url(settings: Record<string, unknown>): string {
  return btoa(JSON.stringify(settings))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

/** Decode a base64url string back to a settings object. Returns null on failure. */
export function settingsFromBase64Url(
  encoded: string,
): Record<string, unknown> | null {
  try {
    let s = encoded.replace(/-/g, "+").replace(/_/g, "/")
    while (s.length % 4) s += "="
    return JSON.parse(atob(s))
  } catch {
    return null
  }
}
