// Dimensions: a number with a unit. parseDimension reads the object of the Design Tokens format ({ value, unit })
// and the older string form ("16px"). The format itself names px and rem; the tool also accepts pt, dp and sp,
// because the platforms write their sizes that way. Units are never converted into one another here: toPlatform
// says what a unit means on a platform and reports every conversion it makes.

import { PLATFORM_UNITS, POINTS_PER_CSS_PIXEL, UNITS } from './data.js';

function shown(text) {
  return String(text).replace(/[^ -~]/g, '?').slice(0, 60);
}

const MAX_DIMENSION_TEXT = 100;
const LEGACY = /^\s*([+-]?(?:\d+\.?\d*|\.\d+))\s*(px|pt|dp|sp|rem)\s*$/;

// Reads the value node of a dimension token. Returns { ok: true, value, unit } or { ok: false, reason }.
export function parseDimension(node) {
  if (node.t === 'string') {
    // A dimension is short: a longer string is refused before any pattern runs on it.
    const m = node.value.length <= MAX_DIMENSION_TEXT ? LEGACY.exec(node.value) : null;
    if (m) return { ok: true, value: Number(m[1]), unit: m[2] };
    return { ok: false, reason: `"${shown(node.value)}" is not a number with a unit (${UNITS.join(', ')})` };
  }
  if (node.t !== 'object') return { ok: false, reason: 'a dimension is an object with value and unit, such as { "value": 16, "unit": "px" }' };
  const get = (key) => node.props.find((p) => p.key === key)?.value;
  const value = get('value');
  const unit = get('unit');
  if (!value || value.t !== 'number') return { ok: false, reason: 'a dimension needs a numeric value' };
  if (!unit || unit.t !== 'string') return { ok: false, reason: 'a dimension needs a unit string, even when the value is 0' };
  if (!UNITS.includes(unit.value)) return { ok: false, reason: `the unit "${shown(unit.value)}" is not one of ${UNITS.join(', ')}` };
  return { ok: true, value: value.value, unit: unit.value };
}

// The size of a touch target on a platform, in the native unit of that platform (pt on ios, dp on android,
// CSS px on web). Returns { ok: true, value, unit, how } where how is '' for a native unit and says what was
// done otherwise, or { ok: false, reason } for a unit that does not belong on the platform.
export function toPlatform(dim, platform, remBase) {
  const rule = PLATFORM_UNITS[platform];
  if (!rule.accepted.includes(dim.unit)) {
    return { ok: false, reason: `the unit ${dim.unit} is not used on ${platform}; write the size in ${rule.accepted.join(', ')}` };
  }
  if (dim.unit === rule.native) return { ok: true, value: dim.value, unit: rule.native, how: '' };
  if (dim.unit === 'rem') return { ok: true, value: dim.value * remBase, unit: rule.native, how: `rem x ${remBase}` };
  return { ok: true, value: dim.value, unit: rule.native, how: `px read as ${rule.native}` };
}

// The size of text in points, for the large-text rule. pt, dp and sp are points as the platforms use them
// (Android's page names sp, Apple's names pt); a px or rem size on the web is a CSS pixel, and WCAG puts 1pt at
// 1.333 CSS px; on ios and android px is read as pt and dp, as the Design Tokens format says.
export function textPoints(dim, platform, remBase) {
  if (dim.unit === 'pt' || dim.unit === 'dp' || dim.unit === 'sp') return dim.value;
  const px = dim.unit === 'rem' ? dim.value * remBase : dim.value;
  return platform === 'ios' || platform === 'android' ? px : px * POINTS_PER_CSS_PIXEL;
}
