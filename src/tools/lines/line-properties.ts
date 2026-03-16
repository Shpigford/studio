import type p5 from 'p5'

export type LineProperties = {
  frequencies: number[]
  phases: number[]
  opacities: number[]
  rotations: number[]
  hueShifts: number[]
  spacingOffsets: number[]
  breakPositions: { pos: number; width: number }[][]
  morsePatterns: { start: number; end: number; isDot: boolean }[][]
}

export function generateLineProperties(
  count: number,
  morseDensity: number,
  dotRatio: number,
  p: p5,
): LineProperties {
  const frequencies: number[] = []
  const phases: number[] = []
  const opacities: number[] = []
  const rotations: number[] = []
  const hueShifts: number[] = []
  const spacingOffsets: number[] = []
  const breakPositions: { pos: number; width: number }[][] = []
  const morsePatterns: { start: number; end: number; isDot: boolean }[][] = []

  const dotRatioNorm = dotRatio / 100
  const densityFactor = p.map(morseDensity, 1, 15, 2, 0.3)

  for (let i = 0; i < count; i++) {
    frequencies.push(p.random(0.5, 1.5))
    phases.push(p.random(p.TWO_PI))
    opacities.push(p.random(-1, 1))
    rotations.push(p.random(-1, 1))
    hueShifts.push(p.random(-1, 1))
    spacingOffsets.push(p.random(-1, 1))

    // Break positions
    const breaks: { pos: number; width: number }[] = []
    const numBreaks = Math.floor(p.random(1, 8))
    for (let j = 0; j < numBreaks; j++) {
      breaks.push({ pos: p.random(0.1, 0.9), width: p.random(0.02, 0.08) })
    }
    breakPositions.push(breaks)

    // Morse patterns
    const morse: { start: number; end: number; isDot: boolean }[] = []
    let pos = 0
    while (pos < 1) {
      const isDot = p.random() < dotRatioNorm
      const elementWidth = isDot
        ? p.random(0.008, 0.02) * densityFactor
        : p.random(0.03, 0.08) * densityFactor
      const gapWidth = p.random(0.015, 0.04) * densityFactor

      if (pos + elementWidth <= 1) {
        morse.push({ start: pos, end: pos + elementWidth, isDot })
      }
      pos += elementWidth + gapWidth
    }
    morsePatterns.push(morse)
  }

  return { frequencies, phases, opacities, rotations, hueShifts, spacingOffsets, breakPositions, morsePatterns }
}
