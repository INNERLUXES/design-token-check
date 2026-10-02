// Reads the rules file from the value tree of src/json.js: which text color sits on which background color, per
// theme, with the text size and weight; which tokens are touch target sizes, and for which platform. The format
// is described in docs/rules-file.md.
//
// parseRules never throws for a rule that is wrong: it records an issue with the line and leaves the rule out,
// so the other rules are still checked. A pair or a target that is left out is always reported.

import { DEFAULT_REM_BASE, FONT_WEIGHTS, PLATFORMS } from './data.js';
import { parseDimension } from './dimension.js';

const KINDS = ['text', 'ui'];
const TOP_KEYS = ['remBase', 'pairs', 'targets'];
const PAIR_KEYS = ['name', 'kind', 'size', 'weight', 'platform', 'themes'];
const THEME_KEYS = ['foreground', 'background'];
const TARGET_KEYS = ['name', 'token', 'platform'];

function shown(text) {
  return String(text).replace(/[^ -~]/g, '?').slice(0, 60);
}

// Returns { remBase, pairs, targets, issues }. An issue is { id, line, message, fix }, with id invalid-rule (the
// rule is left out) or unknown-rule-key (a warning; the key is ignored).
export function parseRules(root) {
  const issues = [];
  const bad = (line, message, fix) => issues.push({ id: 'invalid-rule', line, message, fix });
  const unknownKeys = (node, allowed, where) => {
    for (const p of node.props) {
      if (!allowed.includes(p.key)) issues.push({ id: 'unknown-rule-key', line: p.line, message: `${where} has a key "${shown(p.key)}" that the rules format does not have, and it is ignored`, fix: `Use one of: ${allowed.join(', ')}` });
    }
  };
  const get = (node, key) => node.props.find((p) => p.key === key);
  const out = { remBase: DEFAULT_REM_BASE, remBaseLine: 1, pairs: [], targets: [], issues };

  if (root.t !== 'object') {
    bad(root.line, 'the rules file must be one JSON object with "pairs" and "targets"', 'Write { "pairs": [ ... ], "targets": [ ... ] }; docs/rules-file.md has the format');
    return out;
  }
  unknownKeys(root, TOP_KEYS, 'the rules file');

  const rem = get(root, 'remBase');
  if (rem) {
    if (rem.value.t === 'number' && rem.value.value > 0 && rem.value.value <= 1000) {
      out.remBase = rem.value.value;
      out.remBaseLine = rem.line;
    } else {
      bad(rem.line, 'remBase must be a number above 0 (the size of 1rem in px)', `Write "remBase": ${DEFAULT_REM_BASE} or another number; without it the base is ${DEFAULT_REM_BASE}`);
    }
  }

  const pairs = get(root, 'pairs');
  if (pairs && pairs.value.t !== 'array') bad(pairs.line, '"pairs" must be an array', 'Write "pairs": [ ... ]');
  else if (pairs) pairs.value.items.forEach((item, index) => readPair(item, index));

  const targets = get(root, 'targets');
  if (targets && targets.value.t !== 'array') bad(targets.line, '"targets" must be an array', 'Write "targets": [ ... ]');
  else if (targets) targets.value.items.forEach((item, index) => readTarget(item, index));

  if (!pairs && !targets) bad(root.line, 'the rules file lists no pairs and no targets, so there is nothing to check', 'Add "pairs" and "targets"; docs/rules-file.md has the format');
  return out;

  function readPair(node, index) {
    const label = `pair ${index + 1}`;
    if (node.t !== 'object') return bad(node.line, `${label} must be an object`, 'Write { "name": ..., "themes": { ... } }');
    unknownKeys(node, PAIR_KEYS, label);
    const nameProp = get(node, 'name');
    let name = label;
    if (nameProp) {
      if (nameProp.value.t === 'string' && nameProp.value.value.trim() !== '') name = nameProp.value.value;
      else return bad(nameProp.line, `the name of ${label} must be a non-empty string`, 'Write "name": "Body text"');
    }
    const kindProp = get(node, 'kind');
    let kind = 'text';
    if (kindProp) {
      if (kindProp.value.t === 'string' && KINDS.includes(kindProp.value.value)) kind = kindProp.value.value;
      else return bad(kindProp.line, `"kind" of ${shown(name)} must be "text" or "ui"`, '"text" is text, "ui" is an icon, a border or a focus ring');
    }
    let platform = null;
    const platformProp = get(node, 'platform');
    if (platformProp) {
      if (platformProp.value.t === 'string' && PLATFORMS.includes(platformProp.value.value)) platform = platformProp.value.value;
      else return bad(platformProp.line, `"platform" of ${shown(name)} must be one of ${PLATFORMS.join(', ')}`, 'Use ios, android or web, in lower case');
    }
    let size = null;
    const sizeProp = get(node, 'size');
    let weight = null;
    const weightProp = get(node, 'weight');
    if (kind === 'ui') {
      for (const p of [sizeProp, weightProp]) {
        if (p) issues.push({ id: 'unknown-rule-key', line: p.line, message: `"${p.key}" of ${shown(name)} is ignored: only text has a size and a weight`, fix: 'Remove it, or set "kind" to "text"' });
      }
    } else {
      if (sizeProp) {
        const v = sizeProp.value;
        const dim = parseDimension(v);
        if (dim.ok) size = { type: 'dimension', dim, line: sizeProp.line };
        else if (v.t === 'string' && /^[^\s{}]+$/.test(v.value) && !/^[+-]?[\d.]/.test(v.value)) size = { type: 'token', path: v.value, line: sizeProp.line };
        else return bad(sizeProp.line, `"size" of ${shown(name)} is neither a dimension nor a token path: ${dim.reason}`, 'Write { "value": 16, "unit": "pt" } or the path of a dimension token');
      }
      if (weightProp) {
        const v = weightProp.value;
        if (v.t === 'number' && v.value >= 1 && v.value <= 1000) weight = v.value;
        else if (v.t === 'string' && Object.hasOwn(FONT_WEIGHTS, v.value)) weight = FONT_WEIGHTS[v.value];
        else return bad(weightProp.line, `"weight" of ${shown(name)} must be a number from 1 to 1000 or a font weight name such as "bold"`, 'The names are those of the Design Tokens format: normal, bold, semi-bold and so on');
      }
    }
    const themesProp = get(node, 'themes');
    if (!themesProp || themesProp.value.t !== 'object' || themesProp.value.props.length === 0) {
      return bad(themesProp ? themesProp.line : node.line, `${shown(name)} needs "themes": an object with one entry per theme, each with a foreground and a background token`, 'Write "themes": { "light": { "foreground": "color.text", "background": "color.surface" } }');
    }
    const themes = [];
    const seenThemes = new Set();
    for (const tp of themesProp.value.props) {
      if (seenThemes.has(tp.key)) {
        bad(tp.line, `the theme "${shown(tp.key)}" of ${shown(name)} is written twice`, 'Remove one of them');
        continue;
      }
      seenThemes.add(tp.key);
      if (tp.value.t !== 'object') {
        bad(tp.line, `the theme "${shown(tp.key)}" of ${shown(name)} must be an object with foreground and background`, 'Write { "foreground": "color.text", "background": "color.surface" }');
        continue;
      }
      unknownKeys(tp.value, THEME_KEYS, `the theme "${shown(tp.key)}" of ${shown(name)}`);
      const fg = get(tp.value, 'foreground');
      const bg = get(tp.value, 'background');
      const okString = (p) => p && p.value.t === 'string' && p.value.value !== '';
      if (!okString(fg) || !okString(bg)) {
        bad(tp.line, `the theme "${shown(tp.key)}" of ${shown(name)} needs a foreground and a background, each the path of a token`, 'Write { "foreground": "color.text", "background": "color.surface" }');
        continue;
      }
      themes.push({ theme: tp.key, line: tp.line, foreground: { path: fg.value.value, line: fg.line }, background: { path: bg.value.value, line: bg.line } });
    }
    if (themes.length) out.pairs.push({ name, line: node.line, kind, size, weight, platform, themes });
    return undefined;
  }

  function readTarget(node, index) {
    const label = `target ${index + 1}`;
    if (node.t !== 'object') return bad(node.line, `${label} must be an object`, 'Write { "token": "size.touch", "platform": "ios" }');
    unknownKeys(node, TARGET_KEYS, label);
    const token = get(node, 'token');
    const platform = get(node, 'platform');
    const name = get(node, 'name');
    if (!token || token.value.t !== 'string' || token.value.value === '') return bad(node.line, `${label} needs "token": the path of a dimension token`, 'Write { "token": "size.touch", "platform": "ios" }');
    if (!platform || platform.value.t !== 'string' || !PLATFORMS.includes(platform.value.value)) return bad(platform ? platform.line : node.line, `${label} needs "platform": one of ${PLATFORMS.join(', ')}`, 'Use ios, android or web, in lower case');
    if (name && (name.value.t !== 'string' || name.value.value.trim() === '')) return bad(name.line, `the name of ${label} must be a non-empty string`, 'Write "name": "Primary button height"');
    out.targets.push({ name: name ? name.value.value : token.value.value, line: node.line, token: { path: token.value.value, line: token.line }, platform: platform.value.value });
    return undefined;
  }
}
