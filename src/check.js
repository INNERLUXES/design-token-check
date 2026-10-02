// Reads a design tokens file and a rules file, checks the tokens against the accessibility and platform rules
// of docs/rules-and-sources.md, and returns one report. docs/method.md gives the reason behind every finding.

import { lstat, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { CONTRAST, LARGE_TEXT, BOLD_WEIGHT, APPLE_ABSOLUTE_MINIMUM, RULES_FILE, TARGETS, TOKENS_FILE, TOKEN_TYPES } from './data.js';
import { composite, contrastRatio, formatRatio, parseColor, toHex } from './color.js';
import { parseDimension, textPoints, toPlatform } from './dimension.js';
import { LIMITS, displayPath, readBounded } from './files.js';
import { parseJson } from './json.js';
import { parseRules } from './rules.js';
import { buildTokens, createResolver } from './tokens.js';

export { LIMITS };
export const SEVERITIES = ['error', 'warning'];
export const RANK = { error: 0, warning: 1 };

// Every finding, in report order within a severity.
export const FINDINGS = [
  { id: 'tokens-invalid', severity: 'error', what: 'The tokens file is not valid JSON, or is not an object' },
  { id: 'rules-missing', severity: 'error', what: 'The rules file named with --rules does not exist, or is not a regular file' },
  { id: 'rules-invalid', severity: 'error', what: 'The rules file is not valid JSON' },
  { id: 'invalid-rule', severity: 'error', what: 'A pair, a target or a key of the rules file that is not in the documented format; the rule is left out' },
  { id: 'invalid-token', severity: 'error', what: 'A token that is also a group, a value that is neither, or a property of the wrong kind' },
  { id: 'invalid-name', severity: 'error', what: 'A token or group name with {, } or a period in it, or one that starts with $' },
  { id: 'duplicate-name', severity: 'error', what: 'The same name twice in one group, so one token is lost' },
  { id: 'missing-type', severity: 'error', what: 'A token with no $type of its own, from an alias or from a group' },
  { id: 'invalid-color', severity: 'error', what: 'A color token whose value is not a color the tool reads' },
  { id: 'invalid-dimension', severity: 'error', what: 'A dimension token whose value is not a number with a unit' },
  { id: 'unresolved-alias', severity: 'error', what: 'An alias or $ref that names no token' },
  { id: 'alias-cycle', severity: 'error', what: 'Aliases that lead back to themselves; every token in the cycle is reported' },
  { id: 'alias-type-mismatch', severity: 'error', what: 'A token with a $type that differs from the type of the token it is an alias of' },
  { id: 'missing-token', severity: 'error', what: 'A pair or a target names a token that the tokens file does not have' },
  { id: 'wrong-token-type', severity: 'error', what: 'A pair names a token that is not a color, or a target one that is not a dimension' },
  { id: 'unchecked-rule', severity: 'error', what: 'A pair or a target could not be checked, because a token it names has no usable value' },
  { id: 'translucent-background', severity: 'error', what: 'The background of a pair has an alpha below 1, so the ratio would depend on what lies behind it' },
  { id: 'low-contrast', severity: 'error', what: 'A text or non-text pair below the WCAG contrast ratio for it' },
  { id: 'unit-mismatch', severity: 'error', what: 'A touch target in a unit that is not used on its platform' },
  { id: 'small-target', severity: 'warning', what: 'A touch target below the minimum of its platform: a warning on ios and android, an error on web' },
  { id: 'theme-missing', severity: 'warning', what: 'A theme that some pairs list and this pair does not' },
  { id: 'case-collision', severity: 'warning', what: 'Two token names that differ only in letter case' },
  { id: 'unknown-type', severity: 'warning', what: 'A $type that the Design Tokens format does not have' },
  { id: 'unsupported-extends', severity: 'warning', what: 'A group with $extends, which the tool does not follow' },
  { id: 'unknown-rule-key', severity: 'warning', what: 'A key of the rules file that the format does not have; it is ignored' }
];

const ORDER = Object.fromEntries(FINDINGS.map((f, i) => [f.id, i]));
const BY_ID = Object.fromEntries(FINDINGS.map((f) => [f.id, f]));
const EPSILON = 1e-9;

// Text from the input: control, line separator and direction characters replaced by a space, length capped.
export function safeText(value, max = 300) {
  const s = String(value).replace(/[\u0000-\u001f\u007f-\u009f\u200e\u200f\u2028\u2029\u202a-\u202e\u2066-\u2069]/g, ' ');
  return s.length > max ? `${s.slice(0, max - 3)}...` : s;
}

export function meetsThreshold(severity, failOn) {
  return RANK[severity] <= RANK[failOn];
}

function compare(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function plural(count, one, many = `${one}s`) {
  return `${count.toLocaleString('en-US')} ${count === 1 ? one : many}`;
}

// The line a read error names, and its text without the label in front.
function splitError(message) {
  const m = /^[a-z]+: (?:line (\d+): )?([\s\S]*)$/.exec(String(message));
  return m ? { line: m[1] ? Number(m[1]) : 1, text: m[2] } : { line: 1, text: String(message) };
}

// The chain of an alias cycle written out from one member, cut after eight tokens so that a very long cycle does
// not make a very long message.
function cycleText(cycle, from) {
  if (cycle.length > 8) return [...cycle.slice(0, 8), `... ${cycle.length - 8} more`].join(' -> ');
  const at = cycle.indexOf(from);
  return [...cycle.slice(at), ...cycle.slice(0, at), from].join(' -> ');
}

function number(n) {
  return Number(n.toFixed(4)).toString();
}

// Runs the checks. options: { rules (path of the rules file), failOn, base, version, limits }. base is the folder
// that paths are shown relative to and that relative paths are opened from (default: the current folder). A
// tokens file that is missing or is not a regular file stops the run with an error; a folder stands for the
// tokens.json in it.
export async function checkTokens(tokensFile, { rules = null, failOn = 'error', base = process.cwd(), version = '0.0.0', limits = LIMITS } = {}) {
  const baseDir = resolve(base);
  let tokensPath = resolve(baseDir, tokensFile);
  // A folder stands for the tokens file in it.
  try {
    if ((await stat(tokensPath)).isDirectory()) tokensPath = resolve(tokensPath, TOKENS_FILE);
  } catch {
    // the read below reports a path that does not exist
  }
  const show = (p) => safeText(displayPath(p, baseDir));
  const tokensShown = show(tokensPath);

  let tokensBuffer;
  try {
    tokensBuffer = await readBounded(tokensPath, limits);
  } catch (error) {
    throw new Error(`${safeText(tokensFile)}: ${safeText(error.reason ?? error.message)}`);
  }

  const notes = [];
  const note = (text) => notes.push(safeText(text, 600));
  const all = [];
  const add = (id, file, line, subject, message, fix, severity = BY_ID[id].severity) => {
    all.push({ id, severity, file, line: Math.max(1, Number(line) || 1), subject: safeText(subject), message: safeText(message, 1200), fix: safeText(fix, 1200) });
  };

  // The tokens file.
  let model = null;
  try {
    model = buildTokens(parseJson(tokensBuffer.toString('utf8'), 'tokens', { allowDuplicateKeys: true }));
  } catch (error) {
    const { line, text } = splitError(error.message);
    add('tokens-invalid', tokensShown, line, 'tokens', `${tokensShown} cannot be read: ${text}`, 'Fix the file so that it is JSON; the Design Tokens format is described at https://tr.designtokens.org/format/');
  }
  const tokens = model ? model.tokens : new Map();
  const fromTokens = (t) => `${tokensShown}:${t.line}`;
  const lowerIndex = new Map();
  for (const t of tokens.values()) if (!lowerIndex.has(t.path.toLowerCase())) lowerIndex.set(t.path.toLowerCase(), t.path);
  const colors = new Map();
  const resolver = createResolver(tokens);

  if (model) {
    for (const i of model.issues) {
      if (i.id === 'tokens-invalid') add(i.id, tokensShown, i.line, 'tokens', `${tokensShown}: ${i.message}`, i.fix);
      else add(i.id, tokensShown, i.line, i.path, i.message, i.fix);
    }
    for (const t of model.list) checkToken(t);
  }

  function checkToken(t) {
    const where = `${tokensShown}:${t.line}`;
    if (t.explicitType !== null && !TOKEN_TYPES.includes(t.explicitType)) {
      add('unknown-type', tokensShown, t.typeLine, t.path, `${t.path} has the $type "${safeText(t.explicitType, 60)}", which the Design Tokens format does not have`, `Use one of: ${TOKEN_TYPES.join(', ')}`);
    }
    if (t.kind === 'alias') {
      const result = resolver.resolve(t.path);
      if (!result.ok && result.cause === 'cycle' && result.member) {
        const cycle = cycleText(result.cycle, t.path);
        add('alias-cycle', tokensShown, t.aliasLine, t.path, `${t.path} is part of an alias cycle (${safeText(cycle, 500)}), so none of the tokens in it has a value`, 'Make one token in the cycle hold a value of its own');
      } else if (!result.ok && result.cause === 'missing' && result.at === t.path && result.target !== '') {
        const target = result.target;
        const group = model.groupPaths.has(target);
        const near = lowerIndex.get(target.toLowerCase());
        const why = group ? `${target} is a group, not a token; an alias names a token` : near && near !== target ? `no token has that path; ${near} does, and letter case counts` : `no token has the path ${target}`;
        add('unresolved-alias', tokensShown, t.aliasLine, t.path, `${t.path} is an alias of ${safeText(target, 200)}: ${safeText(why, 300)}`, 'Write the path of an existing token, groups and token joined with periods');
      } else if (result.ok && t.explicitType !== null) {
        const target = resolver.type(t.alias);
        if (target !== null && target !== t.explicitType) {
          add('alias-type-mismatch', tokensShown, t.typeLine, t.path, `${t.path} says $type "${safeText(t.explicitType, 60)}" and is an alias of ${t.alias}, which is "${safeText(target, 60)}"`, 'Remove the $type of the alias, or alias a token of the same type');
        }
      }
      return;
    }
    const type = resolver.type(t.path);
    if (type === null) {
      add('missing-type', tokensShown, t.line, t.path, `${t.path} has no $type and no group above it sets one, so its type cannot be known and the format calls it invalid`, 'Add "$type" to the token, or to the group that holds it');
      return;
    }
    if (type === 'color') {
      const c = parseColor(t.valueNode);
      if (c.ok) colors.set(t.path, c.color);
      else add('invalid-color', tokensShown, t.valueNode.line, t.path, `${t.path} (${where}) is not a color the tool reads: ${safeText(c.reason, 300)}`, 'Write the color as { "colorSpace": "srgb", "components": [0, 0.4, 0.8] }, as "#0066cc" or as "rgb(0, 102, 204)"');
    } else if (type === 'dimension') {
      const d = parseDimension(t.valueNode);
      if (!d.ok) add('invalid-dimension', tokensShown, t.valueNode.line, t.path, `${t.path} (${where}) is not a dimension: ${safeText(d.reason, 300)}`, 'Write the dimension as { "value": 16, "unit": "px" }');
    }
  }

  // The rules file.
  let ruleSet = null;
  let rulesShown = null;
  let rulesProblem = null;
  {
    let rulesPath;
    const explicit = rules !== null;
    if (explicit) rulesPath = resolve(baseDir, rules);
    else rulesPath = resolve(dirname(tokensPath), RULES_FILE);
    rulesShown = show(rulesPath);
    let skip = false;
    try {
      if (!explicit) {
        let link;
        try {
          link = await lstat(rulesPath);
        } catch (error) {
          if (error.code === 'ENOENT') {
            skip = true;
            rulesShown = null;
            note(`no ${RULES_FILE} next to the tokens file and no --rules, so no contrast pair and no touch target was checked`);
          } else throw error;
        }
        if (link && link.isSymbolicLink()) throw Object.assign(new Error('x'), { reason: 'a symbolic link, which is not followed' });
      }
      if (!skip) ruleSet = parseRules(parseJson((await readBounded(rulesPath, limits)).toString('utf8'), 'rules'));
    } catch (error) {
      if (error.code === 'ENOENT' || error.reason) {
        rulesProblem = 'missing';
        add('rules-missing', rulesShown, 1, RULES_FILE, `the rules file ${rulesShown} cannot be used: ${safeText(error.reason ?? 'no such file')}`, 'Name an existing JSON file with --rules; docs/rules-file.md describes the format');
      } else {
        rulesProblem = 'invalid';
        const { line, text } = splitError(error.message);
        add('rules-invalid', rulesShown, line, RULES_FILE, `${rulesShown} cannot be used: ${text}`, 'Fix the file so that it is JSON; docs/rules-file.md shows the format');
      }
    }
  }

  const contrast = [];
  const targets = [];
  let themes = [];
  const remBase = ruleSet ? ruleSet.remBase : 16;

  if (ruleSet) {
    for (const i of ruleSet.issues) add(i.id, rulesShown, i.line, RULES_FILE, `${rulesShown}: ${i.message}`, i.fix);
    const finalColor = new Map();

    // Finds the token a rule names and checks that it holds a value of the wanted type. Returns the token that
    // holds the value, or null after a finding.
    const use = (ref, wanted, what) => {
      const named = tokens.get(ref.path);
      if (!named) {
        const near = lowerIndex.get(ref.path.toLowerCase());
        const why = model && model.groupPaths.has(ref.path) ? 'it is a group, not a token' : near && near !== ref.path ? `no token has that path; ${near} does, and letter case counts` : 'no token has that path';
        add('missing-token', rulesShown, ref.line, ref.path, `${what} names ${safeText(ref.path, 200)}: ${why}`, 'Write the path of a token of the tokens file, groups and token joined with periods');
        return null;
      }
      const resolved = resolver.resolve(ref.path);
      if (!resolved.ok) {
        add('unchecked-rule', rulesShown, ref.line, ref.path, `${what} was not checked: ${ref.path} (${fromTokens(named)}) leads to no value because of an alias problem, reported in the same run`, 'Fix the alias, then run the check again');
        return null;
      }
      const type = resolved.type;
      if (type === null) {
        add('unchecked-rule', rulesShown, ref.line, ref.path, `${what} was not checked: ${ref.path} (${fromTokens(named)}) has no type`, 'Give the token a $type, then run the check again');
        return null;
      }
      if (type !== wanted) {
        add('wrong-token-type', rulesShown, ref.line, ref.path, `${what} names ${ref.path} (${fromTokens(named)}), which is a ${safeText(type, 60)} token, and a ${wanted} is needed`, `Name a ${wanted} token`);
        return null;
      }
      return { named, final: resolved.token };
    };

    const colorOf = (ref, what) => {
      const found = use(ref, 'color', what);
      if (!found) return null;
      let color = colors.get(found.final.path);
      if (!color) {
        // the value of a color token that was refused is reported on the token; a literal that parses is stored
        const parsed = parseColor(found.final.valueNode);
        if (parsed.ok) color = parsed.color;
      }
      if (!color) {
        add('unchecked-rule', rulesShown, ref.line, ref.path, `${what} was not checked: ${found.final.path} (${fromTokens(found.final)}) is not a color the tool reads, reported in the same run`, 'Fix the color, then run the check again');
        return null;
      }
      finalColor.set(ref.path, color);
      return { color, named: found.named };
    };

    // Themes: a theme that some pairs list and others do not.
    const union = new Set();
    for (const p of ruleSet.pairs) for (const t of p.themes) union.add(t.theme);
    themes = [...union].sort(compare);
    for (const p of ruleSet.pairs) {
      const have = new Set(p.themes.map((t) => t.theme));
      const lacking = themes.filter((t) => !have.has(t));
      if (lacking.length) {
        const others = ruleSet.pairs.filter((q) => q !== p && lacking.some((t) => q.themes.some((x) => x.theme === t))).map((q) => q.name);
        add('theme-missing', rulesShown, p.line, p.name, `${p.name} has no ${lacking.map((t) => `"${t}"`).join(', ')} theme, which ${others.slice(0, 3).map((n) => `"${n}"`).join(', ')}${others.length > 3 ? ' and others' : ''} list${others.length === 1 ? 's' : ''}; that theme's colors are not checked for it`, `Add the ${lacking.map((t) => `"${t}"`).join(', ')} theme to the pair with its foreground and background tokens`);
      }
    }

    // Contrast.
    for (const p of ruleSet.pairs) {
      let sizePt = null;
      let large = false;
      let weight = p.weight;
      if (p.kind === 'text') {
        if (p.size) {
          let dim = null;
          if (p.size.type === 'dimension') dim = p.size.dim;
          else {
            const found = use({ path: p.size.path, line: p.size.line }, 'dimension', `the size of ${p.name}`);
            if (found) {
              const d = parseDimension(found.final.valueNode);
              if (d.ok) dim = d;
              else add('unchecked-rule', rulesShown, p.size.line, p.size.path, `the size of ${p.name} was not read: ${found.final.path} (${fromTokens(found.final)}) is not a dimension, reported in the same run`, 'Fix the dimension, then run the check again');
            }
          }
          if (dim) {
            sizePt = textPoints(dim, p.platform, remBase);
            const bold = weight !== null && weight >= BOLD_WEIGHT;
            large = sizePt + EPSILON >= LARGE_TEXT.points || (bold && sizePt + EPSILON >= LARGE_TEXT.boldPoints);
          }
        }
      }
      for (const t of p.themes) {
        const what = `${p.name} (${t.theme})`;
        const fg = colorOf(t.foreground, what);
        const bg = colorOf(t.background, what);
        if (!fg || !bg) continue;
        if (bg.color.a < 1) {
          add('translucent-background', rulesShown, t.background.line, t.background.path, `${what}: the background ${t.background.path} (${fromTokens(bg.named)}) has an alpha of ${number(bg.color.a)}, so the ratio would depend on what lies behind it`, 'Give the background an opaque color, or name the opaque color it is drawn on');
          continue;
        }
        const drawn = fg.color.a < 1 ? composite(fg.color, bg.color) : fg.color;
        const ratio = contrastRatio(drawn, bg.color);
        const rule = p.kind === 'ui' ? CONTRAST.nonText : large ? CONTRAST.largeText : CONTRAST.text;
        const pass = ratio + EPSILON >= rule.ratio;
        const row = {
          pair: p.name,
          theme: t.theme,
          kind: p.kind,
          text: p.kind === 'text' ? { sizePt: sizePt === null ? null : Number(sizePt.toFixed(4)), weight, large } : null,
          foreground: { token: t.foreground.path, hex: toHex(drawn), file: tokensShown, line: fg.named.line },
          background: { token: t.background.path, hex: toHex(bg.color), file: tokensShown, line: bg.named.line },
          ratio: Number(formatRatio(ratio)),
          required: rule.ratio,
          criterion: rule.criterion,
          pass,
          file: rulesShown,
          line: t.line
        };
        contrast.push(row);
        if (!pass) {
          const exact = Number(formatRatio(ratio)) >= rule.ratio ? ` (exactly ${ratio.toFixed(4)}; WCAG compares the value without rounding)` : '';
          const kind = p.kind === 'ui' ? 'a non-text component' : large ? 'large text' : 'text';
          const blend = fg.color.a < 1 ? ` (drawn over the background at an alpha of ${number(fg.color.a)})` : '';
          add('low-contrast', rulesShown, t.line, t.foreground.path, `${what}: ${t.foreground.path} (${fromTokens(fg.named)}, ${row.foreground.hex}) on ${t.background.path} (${fromTokens(bg.named)}, ${row.background.hex})${blend} has a contrast ratio of ${formatRatio(ratio)}:1${exact}; ${kind} needs at least ${number(rule.ratio)}:1 (WCAG 2.2 SC ${rule.criterion})`, `Change ${t.foreground.path} or ${t.background.path} until the ratio is at least ${number(rule.ratio)}:1`);
        }
      }
    }

    // Touch targets.
    for (const target of ruleSet.targets) {
      const rule = TARGETS[target.platform];
      const what = `${target.name} (${target.platform})`;
      const found = use(target.token, 'dimension', what);
      if (!found) continue;
      const dim = parseDimension(found.final.valueNode);
      if (!dim.ok) {
        add('unchecked-rule', rulesShown, target.token.line, target.token.path, `${what} was not checked: ${found.final.path} (${fromTokens(found.final)}) is not a dimension, reported in the same run`, 'Fix the dimension, then run the check again');
        continue;
      }
      const size = toPlatform(dim, target.platform, remBase);
      if (!size.ok) {
        add('unit-mismatch', tokensShown, found.named.line, target.token.path, `${what}: ${target.token.path} is ${number(dim.value)} ${dim.unit}, and ${safeText(size.reason, 200)}`, `Write ${target.token.path} in ${rule.unit}`);
        continue;
      }
      const pass = size.value + EPSILON >= rule.minimum;
      targets.push({
        name: target.name,
        token: target.token.path,
        platform: target.platform,
        value: Number(number(dim.value)),
        unit: dim.unit,
        size: Number(number(size.value)),
        sizeUnit: size.unit,
        conversion: size.how,
        minimum: rule.minimum,
        pass,
        severity: pass ? null : rule.severity,
        file: tokensShown,
        line: found.named.line
      });
      if (!pass) {
        const read = size.how ? ` (${size.how} = ${number(size.value)} ${size.unit})` : '';
        const low = target.platform === 'ios' && size.value < APPLE_ABSOLUTE_MINIMUM ? `; Apple's page gives ${APPLE_ABSOLUTE_MINIMUM} pt as the smallest control size, and this is below even that` : '';
        add('small-target', tokensShown, found.named.line, target.token.path, `${what}: ${target.token.path} is ${number(dim.value)} ${dim.unit}${read}, below the ${rule.minimum} ${rule.unit} minimum (${rule.source})${low}`, `Make ${target.token.path} at least ${rule.minimum} ${rule.unit}`, rule.severity);
      }
    }
  }

  const findings = all.sort((a, b) => RANK[a.severity] - RANK[b.severity]
    || ORDER[a.id] - ORDER[b.id]
    || compare(a.file, b.file)
    || a.line - b.line
    || compare(a.subject, b.subject)
    || compare(a.message, b.message));
  const counts = { error: 0, warning: 0 };
  for (const f of findings) counts[f.severity] += 1;
  const failing = findings.filter((f) => meetsThreshold(f.severity, failOn));
  const reason = failOn === 'error'
    ? plural(counts.error, 'error')
    : [counts.error ? plural(counts.error, 'error') : '', counts.warning ? plural(counts.warning, 'warning') : ''].filter(Boolean).join(', ');
  const passing = contrast.filter((c) => c.pass).length;
  return {
    tool: 'design-token-check',
    version,
    tokens: {
      file: tokensShown,
      readable: Boolean(model),
      tokens: model ? model.list.length : 0,
      aliases: model ? model.list.filter((t) => t.kind === 'alias').length : 0,
      groups: model ? model.groups : 0
    },
    rules: {
      file: rulesShown,
      readable: Boolean(ruleSet),
      problem: rulesProblem,
      pairs: ruleSet ? ruleSet.pairs.length : 0,
      targets: ruleSet ? ruleSet.targets.length : 0,
      remBase
    },
    themes,
    contrast,
    contrastSummary: { checked: contrast.length, pass: passing, fail: contrast.length - passing },
    targets,
    counts,
    findings,
    notes,
    gate: { failOn, pass: failing.length === 0, reason: failing.length ? reason : null }
  };
}
