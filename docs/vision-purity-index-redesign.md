# Vision Service — Purity Index Redesign

## Problem Statement

The current whiteness calculation uses a custom `V × (1 - S)` formula on raw RGB pixels, which:

- Conflates visual whiteness with chemical purity
- Uses no standardized color science
- Is sensitive to lighting/camera conditions with no calibration
- Applies arbitrary class-based multipliers (`pure × 1.0`, `impure × 0.3`) creating circular dependency on the YOLO classifier

## Proposed Solution

Replace the RGB-based heuristic with a **CIE L\*a\*b\* colorimetric pipeline** that separates detection from measurement and uses industry-standard whiteness indices.

---

## Architecture

```
YOLO Detection (existing)
    ↓ bounding boxes + class labels
Crop Regions (existing, via sharp)
    ↓ cropped RGB buffers
RGB → sRGB linearization → XYZ → L*a*b* conversion (NEW)
    ↓ per-pixel L*, a*, b*
Whiteness Index Calculation (NEW)
    ↓ per-box whiteness index
Purity Score Aggregation (REVISED)
    ↓ detection-level + frame-level metrics
```

## Step 1 — RGB to CIE L\*a\*b\* Conversion

### 1.1 sRGB to Linear RGB

```typescript
function srgbToLinear(c: number): number {
  // c is in [0, 1]
  return c <= 0.04045
    ? c / 12.92
    : Math.pow((c + 0.055) / 1.055, 2.4);
}
```

### 1.2 Linear RGB to CIE XYZ (D65 illuminant)

```typescript
function linearRgbToXyz(r: number, g: number, b: number): [number, number, number] {
  // sRGB to XYZ matrix (D65 reference white)
  const x = 0.4124564 * r + 0.3575761 * g + 0.1804375 * b;
  const y = 0.2126729 * r + 0.7151522 * g + 0.0721750 * b;
  const z = 0.0193339 * r + 0.1191920 * g + 0.9503041 * b;
  return [x, y, z];
}
```

### 1.3 XYZ to L\*a\*b\*

```typescript
// D65 reference white point
const D65_Xn = 0.95047;
const D65_Yn = 1.00000;
const D65_Zn = 1.08883;

function f(t: number): number {
  const delta = 6 / 29;
  return t > delta ** 3
    ? Math.cbrt(t)
    : t / (3 * delta ** 2) + 4 / 29;
}

function xyzToLab(x: number, y: number, z: number): { L: number; a: number; b: number } {
  const fx = f(x / D65_Xn);
  const fy = f(y / D65_Yn);
  const fz = f(z / D65_Zn);

  return {
    L: 116 * fy - 16,       // Lightness: 0 (black) to 100 (white)
    a: 500 * (fx - fy),     // Green(-) to Red(+)
    b: 200 * (fy - fz),     // Blue(-) to Yellow(+)
  };
}
```

## Step 2 — Whiteness Index Formulas

Implement multiple indices; the primary recommendation is **CIE Whiteness Index** with **Hunter WI** as a secondary metric.

### 2.1 CIE Whiteness Index (ISO 11475)

Best for industrial salt — penalizes both yellowness and color tint.

```typescript
// Operates on CIE XYZ + xy chromaticity (D65 illuminant)
// xn = 0.3127, yn = 0.3290 for D65
function cieWhitenessIndex(Y: number, x: number, y: number): number {
  const xn = 0.3127;
  const yn = 0.3290;
  return Y + 800 * (xn - x) + 1700 * (yn - y);
}

// Valid range: WI > 40 is considered white
// Pure white = ~100, higher = bluer-white, lower = yellower
```

### 2.2 Hunter Whiteness Index

Simpler, good for quick assessment. Penalizes yellow tint (positive b\*).

```typescript
function hunterWhitenessIndex(L: number, b: number): number {
  return L - 3 * b;
}
```

### 2.3 Sten Stensby Whiteness Index

Accounts for both red-green and yellow-blue deviations.

```typescript
function stensbyWhitenessIndex(L: number, a: number, b: number): number {
  return L - 3 * b + 3 * a;
}
```

### 2.4 Recommended Primary Index

| Index | Pros | Cons |
|-------|------|------|
| **CIE WI** | ISO standard, industry accepted | Needs XYZ + chromaticity |
| **Hunter WI** | Simple, penalizes yellowness | Ignores red-green shift |
| **Stensby WI** | Balanced color penalty | Less commonly used |

**Recommendation**: Use **CIE Whiteness Index** as primary, **Hunter WI** as secondary/display metric.

## Step 3 — Purity Score (Decoupled from Classifier)

The purity score should be computed **independently** from the YOLO class label, so it serves as a genuine measurement rather than echoing the classifier.

### 3.1 Per-Box Purity Score

```typescript
interface PurityMetrics {
  whitenessIndex: number;      // CIE WI (raw value)
  hunterWhiteness: number;     // Hunter WI (secondary)
  meanL: number;               // Average lightness
  meanA: number;               // Average a* (red-green)
  meanB: number;               // Average b* (yellow-blue)
  colorDeviation: number;      // sqrt(a*^2 + b*^2) — distance from achromatic axis
  purityPercentage: number;    // Normalized 0-100 score
}
```

### 3.2 Normalization to 0-100%

Map CIE Whiteness Index to a percentage using empirical salt-specific bounds:

```typescript
function normalizePurity(cieWI: number): number {
  // Calibration constants — determine from lab-validated samples
  const WI_MIN = 40;   // Below this = not white (impure/contaminated)
  const WI_MAX = 100;  // Pure white salt reference

  const normalized = ((cieWI - WI_MIN) / (WI_MAX - WI_MIN)) * 100;
  return Math.max(0, Math.min(100, normalized));
}
```

> **Important**: `WI_MIN` and `WI_MAX` must be calibrated against lab-tested salt samples with known NaCl purity. These are placeholder values.

### 3.3 Color Deviation as Impurity Indicator

The distance from the achromatic axis (a\*=0, b\*=0) in L\*a\*b\* space indicates color contamination:

```typescript
function colorDeviation(a: number, b: number): number {
  return Math.sqrt(a * a + b * b);
  // Low (< 5): near-white, likely pure
  // Medium (5-15): slight discoloration
  // High (> 15): significant impurity coloring
}
```

## Step 4 — Lighting Normalization (Optional but Recommended)

### Option A: Software White Balance

Use the brightest region or a known background area as a white reference:

```typescript
function normalizeWhiteBalance(
  rgbBuffer: Buffer,
  refR: number, refG: number, refB: number, // reference white pixel values
): Buffer {
  const normalized = Buffer.alloc(rgbBuffer.length);
  for (let i = 0; i < rgbBuffer.length; i += 3) {
    normalized[i]     = Math.min(255, (rgbBuffer[i] / refR) * 255);
    normalized[i + 1] = Math.min(255, (rgbBuffer[i + 1] / refG) * 255);
    normalized[i + 2] = Math.min(255, (rgbBuffer[i + 2] / refB) * 255);
  }
  return normalized;
}
```

### Option B: Physical Color Reference Card

Place a standard white/grey reference card in the camera field of view. Detect it and use its known color values to calibrate each frame. This is the most reliable method for consistent readings across different environments.

## Step 5 — Revised Quality Score

Combine classifier output with independent colorimetric measurement:

```typescript
interface QualityAssessment {
  classLabel: string;            // From YOLO: 'pure' | 'impure' | 'unwanted'
  classConfidence: number;       // YOLO confidence score
  purityMetrics: PurityMetrics;  // From colorimetric analysis
  finalQualityScore: number;     // Combined score
}

function calculateFinalQuality(
  classLabel: string,
  classConfidence: number,
  purityPercentage: number,
): number {
  if (classLabel === 'unwanted') return 0;

  // Weighted combination: 40% classifier confidence, 60% colorimetric purity
  const classWeight = classLabel === 'pure' ? classConfidence : (1 - classConfidence) * 0.5;
  const colorWeight = purityPercentage / 100;

  return (0.4 * classWeight + 0.6 * colorWeight) * 100;
}
```

## File Changes Required

| File | Action | Description |
|------|--------|-------------|
| `whiteness.service.ts` | **Rewrite** | Replace RGB heuristic with L\*a\*b\* pipeline |
| `color-science.util.ts` | **Create** | Pure functions: RGB→XYZ→L\*a\*b\*, whiteness indices |
| `detection-result.interface.ts` | **Update** | Add `PurityMetrics` fields to detection result |
| `detection.schema.ts` | **Update** | Store new metrics in MongoDB |
| `inference.service.ts` | **Update** | Wire new whiteness service into detection pipeline |
| `whiteness.service.spec.ts` | **Rewrite** | Test against known L\*a\*b\* reference values |

## Calibration Requirements

Before deployment, the following calibration data is needed:

1. **Salt samples with known NaCl purity** (lab-tested) — minimum 20 samples spanning 70-99.5% purity
2. **Reference images** of each sample under controlled lighting
3. **WI_MIN / WI_MAX bounds** derived from regression of CIE WI against lab purity %
4. **Optional**: Physical color reference card for in-frame white balance

## Migration Notes

- The new `PurityMetrics` fields should be added alongside existing `whitenessPercentage` / `qualityScore` fields initially (backward compatibility)
- Once validated, deprecate the old fields
- Frontend charts/displays will need updating to show the richer metrics (L\*, a\*, b\*, CIE WI)
- Existing stored detections retain old values; new detections get both old + new fields during transition

## References

- CIE 15:2004 — Colorimetry (official standard)
- ISO 11475 — CIE Whiteness Index
- [sRGB to XYZ conversion](https://en.wikipedia.org/wiki/SRGB#From_sRGB_to_CIE_XYZ)
- Hunter, R.S. (1958) — Photoelectric Color Difference Meter
