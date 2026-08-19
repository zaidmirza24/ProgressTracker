import fs from "fs"
import path from "path"
import { expect } from "vitest"

// Golden-file comparison for the progress report.
//
// The report produces ~30 interlocking metrics per employee. Asserting each one
// individually documents intent (and report.test.js does exactly that for the ones with
// subtle rules), but it cannot catch a field being ADDED, REMOVED or renamed — which is
// how a consumer silently breaks. The golden covers the whole shape: any change to the
// response surfaces as a reviewable diff in the pull request instead of a number that
// quietly moved.
//
// Updating is deliberately explicit: UPDATE_GOLDEN=1 npm test. A golden that rewrites
// itself on failure asserts nothing at all.

const ID_PATTERN = /^[0-9a-f]{24}$/i

/**
 * Replace anything that varies between runs with a stable placeholder, so the golden
 * captures VALUES and SHAPE rather than identities.
 *
 * ObjectIds are regenerated every run, so they are replaced wholesale. Dates are
 * deterministic under a frozen clock and are kept — a date silently shifting is exactly
 * the kind of regression this is here to catch.
 */
export const normalise = (value) => {
  if (Array.isArray(value)) return value.map(normalise)
  if (value instanceof Date) return value.toISOString()
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map(key => [key, normalise(value[key])])
    )
  }
  if (typeof value === "string" && ID_PATTERN.test(value)) return "<id>"
  return value
}

/**
 * Compare `actual` against the golden file at `relativePath` (resolved from
 * tests/integration/__golden__). Writes the file when it does not yet exist, or when
 * UPDATE_GOLDEN=1 is set.
 */
export const expectMatchesGolden = (actual, relativePath) => {
  const file = path.resolve(import.meta.dirname, "../integration/__golden__", relativePath)
  const normalised = normalise(actual)
  const serialised = JSON.stringify(normalised, null, 2) + "\n"

  const shouldWrite = process.env.UPDATE_GOLDEN === "1" || !fs.existsSync(file)
  if (shouldWrite) {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, serialised)
    // A freshly written golden proves nothing on the run that created it. Say so
    // loudly rather than reporting a silent pass.
    if (process.env.UPDATE_GOLDEN !== "1") {
      console.warn(`[golden] created ${relativePath} — review it before trusting this run.`)
    }
    return
  }

  const expected = JSON.parse(fs.readFileSync(file, "utf8"))
  expect(normalised).toEqual(expected)
}
