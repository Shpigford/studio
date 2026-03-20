/**
 * Mulberry32 PRNG — returns a function that generates deterministic [0,1) values.
 */
export function seededRandom(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Linear remap (no clamping). */
export function mapRange(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number {
  return ((value - inMin) / (inMax - inMin)) * (outMax - outMin) + outMin;
}

/** Clamp value to [min, max]. */
export function constrain(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function decimalPlaces(value: number): number {
  const text = value.toString();
  if (text.includes("e-")) {
    const [coefficient, exponent] = text.split("e-");
    const fractionLength = coefficient.split(".")[1]?.length ?? 0;
    return fractionLength + Number(exponent);
  }
  return text.split(".")[1]?.length ?? 0;
}

/**
 * Snap a value to a stepped range while staying inside [min, max].
 * Supports bounds that are not perfectly aligned with the step grid.
 */
export function normalizeSteppedValue(
  value: number,
  min: number,
  max: number,
  step: number,
  precision = 0,
): number {
  const clamped = constrain(value, min, max);
  const snapped = min + Math.round((clamped - min) / step) * step;
  const bounded = constrain(snapped, min, max);
  const places = Math.max(
    precision,
    decimalPlaces(step),
    decimalPlaces(min),
    decimalPlaces(max),
  );
  return constrain(Number(bounded.toFixed(places)), min, max);
}

/** Inclusive random integer via Math.random. */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
