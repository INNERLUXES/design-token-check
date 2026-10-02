// Colors and the WCAG 2.x contrast ratio.
//
// A color is { r, g, b, a } with every part between 0 and 1 (r, g and b are sRGB values, as in the Design Tokens
// Color Module). parseColor reads the forms the tool accepts: the object of the Design Tokens Color Module in the
// sRGB color space, a hex string (#rgb, #rgba, #rrggbb, #rrggbbaa) and an rgb() or rgba() string. Any other color
// space is refused, not converted.

import { CONTRAST_OFFSET, LUMINANCE_WEIGHTS, SRGB } from './data.js';

function shown(text) {
  return String(text).replace(/[^ -~]/g, '?').slice(0, 60);
}

function inUnit(n) {
  return Number.isFinite(n) && n >= 0 && n <= 1;
}

function fromHex(text) {
  const m = /^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.exec(text);
  if (!m) return null;
  let h = m[1];
  if (h.length <= 4) h = [...h].map((c) => c + c).join('');
  const byte = (k) => parseInt(h.slice(k, k + 2), 16) / 255;
  return { r: byte(0), g: byte(2), b: byte(4), a: h.length === 8 ? byte(6) : 1 };
}

const MAX_COLOR_TEXT = 100;
const NUMBER = '[+-]?(?:\\d+\\.?\\d*|\\.\\d+)';
const SEP = '(?:\\s*,\\s*|\\s+)';
const RGB = new RegExp(`^rgba?\\(\\s*(${NUMBER}%?)${SEP}(${NUMBER}%?)${SEP}(${NUMBER}%?)(?:\\s*[,/]\\s*(${NUMBER}%?))?\\s*\\)$`, 'i');

function fromRgb(text) {
  const m = RGB.exec(text);
  if (!m) return null;
  const channel = (v) => {
    const pct = v.endsWith('%');
    const n = Number(pct ? v.slice(0, -1) : v);
    const x = pct ? n / 100 : n / 255;
    return inUnit(x) ? x : NaN;
  };
  const alpha = (v) => {
    if (v === undefined) return 1;
    const pct = v.endsWith('%');
    const n = Number(pct ? v.slice(0, -1) : v);
    const x = pct ? n / 100 : n;
    return inUnit(x) ? x : NaN;
  };
  const color = { r: channel(m[1]), g: channel(m[2]), b: channel(m[3]), a: alpha(m[4]) };
  return Object.values(color).every(Number.isFinite) ? color : null;
}

// Reads the value node of a color token (a node of src/json.js). Returns { ok: true, color } or
// { ok: false, reason }.
export function parseColor(node) {
  if (node.t === 'string') {
    // A color is short: a longer string is refused before any pattern runs on it.
    const s = node.value.length <= MAX_COLOR_TEXT ? node.value.trim() : '';
    const color = s.startsWith('#') ? fromHex(s) : fromRgb(s);
    if (color) return { ok: true, color };
    return { ok: false, reason: `"${shown(node.value)}" is not a hex color (#rgb, #rrggbb, #rrggbbaa) or an rgb() color with channels from 0 to 255` };
  }
  if (node.t !== 'object') return { ok: false, reason: 'a color is an object with colorSpace and components, a hex string or an rgb() string' };
  const get = (key) => node.props.find((p) => p.key === key)?.value;
  const space = get('colorSpace');
  if (!space || space.t !== 'string') return { ok: false, reason: 'a color object needs a colorSpace string' };
  if (space.value !== 'srgb') return { ok: false, reason: `the color space "${shown(space.value)}" is not supported; only "srgb" is, and the tool does not convert between color spaces` };
  const components = get('components');
  if (!components || components.t !== 'array' || components.items.length !== 3) return { ok: false, reason: 'an srgb color needs a components array with red, green and blue' };
  const parts = [];
  for (const item of components.items) {
    if (item.t === 'string' && item.value === 'none') parts.push(0);
    else if (item.t === 'number' && inUnit(item.value)) parts.push(item.value);
    else return { ok: false, reason: 'each srgb component is a number from 0 to 1 (or the keyword none)' };
  }
  let a = 1;
  const alpha = get('alpha');
  if (alpha !== undefined) {
    if (alpha.t !== 'number' || !inUnit(alpha.value)) return { ok: false, reason: 'alpha is a number from 0 to 1' };
    a = alpha.value;
  }
  return { ok: true, color: { r: parts[0], g: parts[1], b: parts[2], a } };
}

function linear(v) {
  return v <= SRGB.linearLimit ? v / SRGB.linearDivisor : ((v + SRGB.offset) / SRGB.scale) ** SRGB.exponent;
}

// WCAG 2.2: the relative luminance of an sRGB color, from 0 (darkest black) to 1 (lightest white). The channels
// are taken as 8-bit values first, as the definition says (R8bit / 255).
export function relativeLuminance(color) {
  const eight = (v) => Math.round(v * 255) / 255;
  return LUMINANCE_WEIGHTS.r * linear(eight(color.r)) + LUMINANCE_WEIGHTS.g * linear(eight(color.g)) + LUMINANCE_WEIGHTS.b * linear(eight(color.b));
}

// WCAG 2.2: (L1 + 0.05) / (L2 + 0.05), L1 the lighter and L2 the darker of the two. From 1 to 21. Not rounded:
// WCAG says the computed value is compared with the threshold as it is, so 4.499 does not meet 4.5.
export function contrastRatio(a, b) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + CONTRAST_OFFSET) / (darker + CONTRAST_OFFSET);
}

// The ratio as shown in a report: two decimals.
export function formatRatio(ratio) {
  return ratio.toFixed(2);
}

// A color with alpha below 1 drawn over an opaque background.
export function composite(top, under) {
  const mix = (t, u) => t * top.a + u * (1 - top.a);
  return { r: mix(top.r, under.r), g: mix(top.g, under.g), b: mix(top.b, under.b), a: 1 };
}

// #rrggbb, or #rrggbbaa when the color is not opaque.
export function toHex(color) {
  const part = (v) => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${part(color.r)}${part(color.g)}${part(color.b)}${color.a < 1 ? part(color.a) : ''}`;
}
