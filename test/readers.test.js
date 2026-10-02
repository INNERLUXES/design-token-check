import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTokens, composite, createResolver, contrastRatio, effectiveType, formatRatio, parseColor, parseDimension, parseJson, parseRules, relativeLuminance, resolveToken, textPoints, toHex, toPlatform } from '../src/index.js';

const node = (value) => parseJson(JSON.stringify(value));
const hex = (value) => {
  const result = parseColor({ t: 'string', value });
  assert.ok(result.ok, `${value}: ${result.reason}`);
  return result.color;
};
const ratio = (a, b) => contrastRatio(hex(a), hex(b));
const model = (value) => buildTokens(parseJson(JSON.stringify(value), 'tokens', { allowDuplicateKeys: true }));
const color = (v) => ({ $type: 'color', $value: v });

test('contrast: black on white is 21:1 and white on white is 1:1', () => {
  assert.equal(ratio('#000000', '#ffffff'), 21);
  assert.equal(formatRatio(ratio('#000', '#fff')), '21.00');
  assert.equal(ratio('#ffffff', '#ffffff'), 1);
});

test('contrast: #777 on white is about 4.48:1, which is below 4.5', () => {
  const r = ratio('#777', '#fff');
  assert.equal(formatRatio(r), '4.48');
  assert.ok(r < 4.5);
});

test('contrast: #767676 on white is the lightest gray that reaches 4.5:1', () => {
  assert.equal(formatRatio(ratio('#767676', '#ffffff')), '4.54');
  assert.ok(ratio('#767676', '#ffffff') >= 4.5);
});

test('contrast: the ratio is the same whichever color is the lighter', () => {
  assert.equal(ratio('#2563eb', '#ffffff'), ratio('#ffffff', '#2563eb'));
  assert.equal(formatRatio(ratio('#0000ff', '#ffffff')), '8.59');
});

test('contrast: values from other tools, red and green on white', () => {
  assert.equal(formatRatio(ratio('#ff0000', '#ffffff')), '4.00');
  assert.equal(formatRatio(ratio('#00ff00', '#000000')), '15.30');
});

test('contrast: a ratio of 4.4992 is shown as 4.50 and is still below 4.5, because it is not rounded', () => {
  const r = ratio('#64779d', '#ffffff');
  assert.equal(formatRatio(r), '4.50');
  assert.ok(r < 4.5);
});

test('relative luminance: 0 for black, 1 for white, and the weights of red, green and blue', () => {
  assert.equal(relativeLuminance(hex('#000000')), 0);
  assert.ok(Math.abs(relativeLuminance(hex('#ffffff')) - 1) < 1e-12);
  assert.ok(Math.abs(relativeLuminance(hex('#ff0000')) - 0.2126) < 1e-12);
  assert.ok(Math.abs(relativeLuminance(hex('#00ff00')) - 0.7152) < 1e-12);
  assert.ok(Math.abs(relativeLuminance(hex('#0000ff')) - 0.0722) < 1e-12);
});

test('relative luminance: the dark branch of the sRGB curve is used up to 0.04045', () => {
  // 10/255 = 0.0392 is below the limit, 11/255 = 0.0431 is above it
  assert.ok(Math.abs(relativeLuminance(hex('#0a0a0a')) - (10 / 255 / 12.92)) < 1e-12);
  assert.ok(Math.abs(relativeLuminance(hex('#0b0b0b')) - (((11 / 255 + 0.055) / 1.055) ** 2.4)) < 1e-12);
});

test('color forms: short and long hex, with and without alpha', () => {
  assert.deepEqual(hex('#fff'), { r: 1, g: 1, b: 1, a: 1 });
  assert.equal(toHex(hex('#AbCdEf')), '#abcdef');
  assert.equal(toHex(hex('#abc')), '#aabbcc');
  assert.equal(hex('#00000080').a, 128 / 255);
  assert.equal(toHex(hex('#0f08')), '#00ff0088');
});

test('color forms: rgb() with commas or spaces, rgba(), percentages and a slash alpha', () => {
  assert.equal(toHex(hex('rgb(0, 102, 204)')), '#0066cc');
  assert.equal(toHex(hex('rgb(0 102 204)')), '#0066cc');
  assert.equal(toHex(hex('rgb(100%, 0%, 0%)')), '#ff0000');
  assert.equal(hex('rgba(0, 0, 0, 0.5)').a, 0.5);
  assert.equal(hex('rgb(0 0 0 / 25%)').a, 0.25);
});

test('color forms: the object of the Design Tokens Color Module in srgb, with none and alpha', () => {
  const ok = parseColor(node({ colorSpace: 'srgb', components: [0, 0.4, 0.8], alpha: 0.5, hex: '#0066cc' }));
  assert.ok(ok.ok);
  assert.equal(toHex(ok.color), '#0066cc80');
  const none = parseColor(node({ colorSpace: 'srgb', components: ['none', 1, 0] }));
  assert.equal(toHex(none.color), '#00ff00');
});

test('color forms: a color the tool cannot read is refused with a reason, never converted', () => {
  for (const value of ['#12345', '#gggggg', 'blue', 'rgb(256, 0, 0)', 'rgb(0, 0)', '', 'hsl(0, 100%, 50%)']) {
    const r = parseColor({ t: 'string', value });
    assert.equal(r.ok, false, value);
    assert.match(r.reason, /hex color/);
  }
  const p3 = parseColor(node({ colorSpace: 'display-p3', components: [1, 0, 0] }));
  assert.equal(p3.ok, false);
  assert.match(p3.reason, /does not convert between color spaces/);
  assert.equal(parseColor(node({ colorSpace: 'srgb', components: [0, 0] })).ok, false);
  assert.equal(parseColor(node({ colorSpace: 'srgb', components: [0, 0, 2] })).ok, false);
  assert.equal(parseColor(node({ colorSpace: 'srgb', components: [0, 0, 0], alpha: 3 })).ok, false);
  assert.equal(parseColor(node(7)).ok, false);
});

test('color: a translucent color is drawn over its background before the ratio is taken', () => {
  const half = composite({ r: 0, g: 0, b: 0, a: 0.5 }, { r: 1, g: 1, b: 1, a: 1 });
  assert.equal(toHex(half), '#808080');
  assert.equal(half.a, 1);
});

test('dimension: the object form, the older string form, and every unit', () => {
  assert.deepEqual(parseDimension(node({ value: 16, unit: 'px' })), { ok: true, value: 16, unit: 'px' });
  assert.deepEqual(parseDimension(node('2.5rem')), { ok: true, value: 2.5, unit: 'rem' });
  for (const unit of ['px', 'pt', 'dp', 'sp', 'rem']) assert.equal(parseDimension(node({ value: 0, unit })).ok, true, unit);
});

test('dimension: a missing or unknown unit, a text value and a bare number are refused', () => {
  assert.match(parseDimension(node({ value: 16 })).reason, /needs a unit/);
  assert.match(parseDimension(node({ value: 16, unit: 'em' })).reason, /not one of/);
  assert.match(parseDimension(node({ value: '16', unit: 'px' })).reason, /numeric value/);
  assert.equal(parseDimension(node('wide')).ok, false);
  assert.equal(parseDimension(node(16)).ok, false);
});

test('units: px is read as the native unit on ios and android, rem is multiplied, and the conversion is reported', () => {
  assert.deepEqual(toPlatform({ value: 44, unit: 'pt' }, 'ios', 16), { ok: true, value: 44, unit: 'pt', how: '' });
  assert.deepEqual(toPlatform({ value: 44, unit: 'px' }, 'ios', 16), { ok: true, value: 44, unit: 'pt', how: 'px read as pt' });
  assert.deepEqual(toPlatform({ value: 48, unit: 'px' }, 'android', 16), { ok: true, value: 48, unit: 'dp', how: 'px read as dp' });
  assert.deepEqual(toPlatform({ value: 3, unit: 'rem' }, 'web', 16), { ok: true, value: 48, unit: 'px', how: 'rem x 16' });
  assert.equal(toPlatform({ value: 3, unit: 'rem' }, 'android', 10).value, 30);
});

test('units: a unit that does not belong on the platform is refused, never converted silently', () => {
  for (const [unit, platform] of [['dp', 'ios'], ['pt', 'android'], ['pt', 'web'], ['dp', 'web'], ['sp', 'android']]) {
    const r = toPlatform({ value: 44, unit }, platform, 16);
    assert.equal(r.ok, false, `${unit} on ${platform}`);
    assert.match(r.reason, new RegExp(`${unit} is not used on ${platform}`));
  }
});

test('text size: pt, dp and sp are points; a web px is 0.75 point; on ios and android px is a point', () => {
  assert.equal(textPoints({ value: 18, unit: 'pt' }, undefined, 16), 18);
  assert.equal(textPoints({ value: 18, unit: 'sp' }, 'android', 16), 18);
  assert.equal(textPoints({ value: 24, unit: 'px' }, 'web', 16), 18);
  assert.equal(textPoints({ value: 24, unit: 'px' }, undefined, 16), 18);
  assert.equal(textPoints({ value: 18, unit: 'px' }, 'ios', 16), 18);
  assert.equal(textPoints({ value: 1.5, unit: 'rem' }, 'web', 16), 18);
});

test('tokens: groups are flattened to paths joined with periods, and the type comes down from the group', () => {
  const m = model({ color: { $type: 'color', brand: { primary: { $value: '#000' } } }, size: { small: { $type: 'dimension', $value: { value: 1, unit: 'px' } } } });
  assert.deepEqual(m.list.map((t) => t.path), ['color.brand.primary', 'size.small']);
  assert.equal(effectiveType(m.tokens, 'color.brand.primary'), 'color');
  assert.equal(effectiveType(m.tokens, 'size.small'), 'dimension');
  assert.equal(m.groups, 3);
  assert.deepEqual(m.issues, []);
});

test('tokens: a $type on the root object reaches every token below it', () => {
  const m = model({ $type: 'color', a: { b: { $value: '#000' } } });
  assert.equal(effectiveType(m.tokens, 'a.b'), 'color');
});

test('tokens: $root is a token name and part of the path', () => {
  const m = model({ color: { accent: { $type: 'color', $root: { $value: '#dd0000' }, light: { $value: '#ff0000' } } } });
  assert.deepEqual(m.list.map((t) => t.path).sort(), ['color.accent.$root', 'color.accent.light']);
  assert.deepEqual(m.issues, []);
});

test('tokens: an alias is followed to the token that holds the value, through other aliases', () => {
  const m = model({ a: color('{b}'), b: color('{c}'), c: color('#112233') });
  const r = resolveToken(m.tokens, 'a');
  assert.equal(r.ok, true);
  assert.equal(r.token.path, 'c');
  assert.equal(r.type, 'color');
});

test('tokens: a $ref JSON Pointer is an alias too', () => {
  const m = model({ base: color('#112233'), alias: { $ref: '#/base' }, deep: { x: { $ref: '#/base' } } });
  assert.equal(resolveToken(m.tokens, 'alias').token.path, 'base');
  assert.equal(effectiveType(m.tokens, 'alias'), 'color');
});

test('tokens: an alias cycle is found, for two tokens, three tokens and a token that names itself', () => {
  for (const [value, members] of [
    [{ a: { $value: '{b}' }, b: { $value: '{a}' } }, ['a', 'b']],
    [{ a: { $value: '{b}' }, b: { $value: '{c}' }, c: { $value: '{a}' } }, ['a', 'b', 'c']],
    [{ a: { $value: '{a}' } }, ['a']]
  ]) {
    const r = resolveToken(model(value).tokens, 'a');
    assert.equal(r.ok, false);
    assert.equal(r.cause, 'cycle');
    assert.deepEqual([...r.cycle].sort(), members);
  }
});

test('tokens: a token that only leads into a cycle is not a member of it', () => {
  const m = model({ in: { $value: '{a}' }, a: { $value: '{b}' }, b: { $value: '{a}' } });
  const r = resolveToken(m.tokens, 'in');
  assert.equal(r.cause, 'cycle');
  assert.deepEqual([...r.cycle].sort(), ['a', 'b']);
});

test('tokens: an alias to a missing token or to a group does not resolve', () => {
  const m = model({ a: { $value: '{nope}' }, b: { $value: '{grp}' }, grp: { c: { $value: '#000' } } });
  assert.deepEqual(resolveToken(m.tokens, 'a'), { ok: false, cause: 'missing', at: 'a', target: 'nope' });
  assert.equal(resolveToken(m.tokens, 'b').cause, 'missing');
  assert.ok(m.groupPaths.has('grp'));
});

test('tokens: the type of an alias is the type of the token it names, before the group type', () => {
  const m = model({ base: color('#000'), group: { $type: 'dimension', alias: { $value: '{base}' } } });
  assert.equal(effectiveType(m.tokens, 'group.alias'), 'color');
});

test('tokens: no type from the token, an alias or a group means null', () => {
  const m = model({ a: { $value: '#000' }, b: { $value: '{a}' } });
  assert.equal(effectiveType(m.tokens, 'a'), null);
  assert.equal(effectiveType(m.tokens, 'b'), null);
});

test('tokens: names with {, } or a period, or a leading $, are issues, and $root is allowed', () => {
  const m = model({ 'a{b': { $value: 1 }, 'c}d': { $value: 1 }, $odd: { $value: 1 }, ok: { $value: 1 } });
  const names = m.issues.filter((i) => i.id === 'invalid-name').map((i) => i.path).sort();
  assert.deepEqual(names, ['$odd', 'a{b', 'c}d']);
  assert.deepEqual(m.list.map((t) => t.path), ['ok']);
  const dotted = model({ 'a.b': { $value: 1 } });
  assert.equal(dotted.issues[0].id, 'invalid-name');
});

test('tokens: a name written twice in a group is reported with the first line, and the first token is kept', () => {
  const text = '{\n  "size": { "$value": 1 },\n  "size": { "$value": 2 }\n}';
  const m = buildTokens(parseJson(text, 'tokens', { allowDuplicateKeys: true }));
  assert.equal(m.issues.length, 1);
  assert.equal(m.issues[0].id, 'duplicate-name');
  assert.equal(m.issues[0].line, 3);
  assert.match(m.issues[0].message, /first at line 2/);
  assert.equal(m.tokens.get('size').valueNode.value, 1);
});

test('tokens: a token that is also a group, and a value that is neither, are issues', () => {
  const m = model({ a: { $value: 1, child: { $value: 2 } }, b: 5, c: [1] });
  assert.deepEqual(m.issues.map((i) => i.id), ['invalid-token', 'invalid-token', 'invalid-token']);
});

test('tokens: names that differ only in letter case are a collision, and both tokens exist', () => {
  const m = model({ Color: { $value: 1 }, color: { $value: 2 } });
  assert.equal(m.list.length, 2);
  assert.equal(m.issues[0].id, 'case-collision');
});

test('tokens: $extends is reported as unsupported', () => {
  const m = model({ button: { $extends: '{base}', label: { $value: 1 } }, base: { x: { $value: 1 } } });
  assert.equal(m.issues[0].id, 'unsupported-extends');
});

test('json: a key named __proto__ is a name, and an unbalanced file names its line', () => {
  const root = parseJson('{"__proto__": {"$value": 1}}');
  assert.equal(root.props[0].key, '__proto__');
  assert.equal(Object.getPrototypeOf({}).polluted, undefined);
  assert.throws(() => parseJson('{\n  "a": 1,\n  "b": \n}', 'tokens'), /tokens: line 4: an unexpected character/);
  assert.throws(() => parseJson('{"a": 1, "a": 2}', 'rules'), /appears twice/);
  assert.throws(() => parseJson('[1, 2,]', 'x'), /unexpected character/);
});

test('rules: pairs, themes, size, weight and targets are read with their lines', () => {
  const text = JSON.stringify({
    remBase: 10,
    pairs: [{ name: 'Body', size: { value: 16, unit: 'pt' }, weight: 'bold', platform: 'ios', themes: { light: { foreground: 'a', background: 'b' } } }],
    targets: [{ name: 'Button', token: 'size.btn', platform: 'android' }]
  }, null, 2);
  const r = parseRules(parseJson(text));
  assert.deepEqual(r.issues, []);
  assert.equal(r.remBase, 10);
  assert.equal(r.pairs[0].weight, 700);
  assert.equal(r.pairs[0].kind, 'text');
  assert.equal(r.pairs[0].themes[0].foreground.path, 'a');
  assert.equal(r.targets[0].platform, 'android');
  assert.ok(r.targets[0].line > 1);
});

test('rules: a size that is a token path is kept as a path, and a bad one is refused', () => {
  const ok = parseRules(parseJson(JSON.stringify({ pairs: [{ size: 'font.size.body', themes: { l: { foreground: 'a', background: 'b' } } }] })));
  assert.equal(ok.pairs[0].size.type, 'token');
  assert.equal(ok.pairs[0].size.path, 'font.size.body');
  const bad = parseRules(parseJson(JSON.stringify({ pairs: [{ size: '16 big', themes: { l: { foreground: 'a', background: 'b' } } }] })));
  assert.equal(bad.pairs.length, 0);
  assert.equal(bad.issues[0].id, 'invalid-rule');
});

test('rules: every malformed rule is reported and left out, and the others are kept', () => {
  const good = { name: 'ok', themes: { l: { foreground: 'a', background: 'b' } } };
  const r = parseRules(parseJson(JSON.stringify({
    pairs: [
      good,
      { name: 'no themes' },
      { name: 'bad kind', kind: 'icon', themes: good.themes },
      { name: 'bad platform', platform: 'windows', themes: good.themes },
      { name: 'bad weight', weight: 'heavyish', themes: good.themes },
      { name: 'bad theme', themes: { l: { foreground: 'a' } } },
      'text'
    ],
    targets: [{ token: 'x' }, { token: 'x', platform: 'tizen' }, { platform: 'ios' }, { token: 'x', platform: 'ios', name: '' }]
  })));
  assert.equal(r.pairs.length, 1);
  assert.equal(r.targets.length, 0);
  assert.equal(r.issues.filter((i) => i.id === 'invalid-rule').length, 10);
});

test('rules: an unknown key is a warning and is ignored; a size on a ui pair is ignored too', () => {
  const r = parseRules(parseJson(JSON.stringify({ colour: 1, pairs: [{ name: 'x', kind: 'ui', size: { value: 1, unit: 'pt' }, themes: { l: { foreground: 'a', background: 'b' } } }] })));
  assert.deepEqual(r.issues.map((i) => i.id), ['unknown-rule-key', 'unknown-rule-key']);
  assert.equal(r.pairs.length, 1);
  assert.equal(r.pairs[0].size, null);
});

test('rules: a rules file with nothing to check, or that is not an object, is invalid', () => {
  assert.equal(parseRules(parseJson('{}')).issues[0].id, 'invalid-rule');
  assert.equal(parseRules(parseJson('[]')).issues[0].id, 'invalid-rule');
  assert.equal(parseRules(parseJson('{"remBase": 0, "pairs": []}')).issues[0].id, 'invalid-rule');
});

test('hostile input: very long color and dimension strings are refused at once, not matched', () => {
  const started = Date.now();
  for (const value of [`rgb(1${' '.repeat(100000)}x`, `rgb(${'1'.repeat(100000)}x`, `#${'a'.repeat(100000)}`, `rgb(1,${' ,'.repeat(50000)}`]) {
    assert.equal(parseColor({ t: 'string', value }).ok, false);
  }
  for (const value of ['1'.repeat(200000) + 'x', `${'1'.repeat(100000)}.${'1'.repeat(100000)}px`, ' '.repeat(100000) + '1px']) {
    assert.equal(parseDimension({ t: 'string', value }).ok, false);
  }
  assert.ok(Date.now() - started < 1000, 'finished within a second');
});

test('aliases: a chain of 30,000 aliases and a cycle of 30,000 tokens are resolved in a moment, each token once', () => {
  const count = 30000;
  const value = { chainEnd: { $type: 'color', $value: '#000' }, loopEnd: { $value: '{loop0}' } };
  for (let k = 0; k < count; k += 1) {
    value[`chain${k}`] = { $value: `{${k === count - 1 ? 'chainEnd' : `chain${k + 1}`}}` };
    value[`loop${k}`] = { $value: `{${k === count - 1 ? 'loop0' : `loop${k + 1}`}}` };
  }
  const started = Date.now();
  const m = model(value);
  const resolver = createResolver(m.tokens);
  assert.equal(resolver.resolve('chain0').token.path, 'chainEnd');
  assert.equal(resolver.type('chain0'), 'color');
  const loop = resolver.resolve('loop17');
  assert.equal(loop.cause, 'cycle');
  assert.equal(loop.cycle.length, count);
  assert.equal(loop.member, true);
  assert.equal(resolver.resolve('loopEnd').member, false);
  assert.ok(Date.now() - started < 5000, 'finished within five seconds');
});
