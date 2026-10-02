import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkTokens } from '../src/index.js';
import { check, color, dim, find, ids, json, lineOf, pair, withFiles } from './helpers.js';

// One text pair on white, in one theme, with the given text color, size and weight.
async function textPair(fg, extra = {}, bg = '#ffffff') {
  return check(
    { light: { fg: color(fg), bg: color(bg) } },
    { pairs: [pair('Body', ['light'], extra)] }
  );
}

async function target(platform, value, unit, rules = {}) {
  return check(
    { size: dim(value, unit) },
    { ...rules, targets: [{ name: 'Button', token: 'size', platform }] }
  );
}

test('contrast: #777 on white is an error with the ratio 4.48:1, at the line of the theme in the rules file', async () => {
  const rules = { pairs: [pair('Body', ['light'], { size: { value: 16, unit: 'pt' } })] };
  const report = await check({ light: { fg: color('#777777'), bg: color('#ffffff') } }, rules);
  const [f] = find(report, 'low-contrast');
  assert.equal(f.severity, 'error');
  assert.match(f.message, /4\.48:1/);
  assert.match(f.message, /needs at least 4\.5:1/);
  assert.equal(f.subject, 'light.fg');
  assert.equal(f.file, 'token-rules.json');
  assert.equal(f.line, lineOf(json(rules), '"light": {'));
  assert.equal(report.contrast[0].ratio, 4.48);
  assert.equal(report.contrast[0].pass, false);
  assert.equal(report.gate.pass, false);
});

test('contrast: the finding names both tokens with the file and line of each', async () => {
  const tokens = { light: { fg: color('#777777'), bg: color('#ffffff') } };
  const report = await check(tokens, { pairs: [pair('Body', ['light'])] });
  const [f] = find(report, 'low-contrast');
  assert.match(f.message, new RegExp(`light\\.fg \\(tokens\\.json:${lineOf(json(tokens), '"fg"')}, #777777\\)`));
  assert.match(f.message, new RegExp(`light\\.bg \\(tokens\\.json:${lineOf(json(tokens), '"bg"')}, #ffffff\\)`));
});

test('contrast: black on white passes with 21.00:1 and no finding', async () => {
  const report = await textPair('#000000');
  assert.deepEqual(ids(report), []);
  assert.equal(report.contrast[0].ratio, 21);
  assert.equal(report.contrast[0].required, 4.5);
  assert.equal(report.gate.pass, true);
});

test('contrast: a ratio of 4.4992 is shown as 4.50 and still fails, with the exact value in the message', async () => {
  const report = await textPair('#64779d');
  const [f] = find(report, 'low-contrast');
  assert.match(f.message, /ratio of 4\.50:1 \(exactly 4\.4992;/);
});

test('contrast: text below 4.5:1 fails at 17 pt regular, and large text needs only 3:1 at 18 pt', async () => {
  assert.deepEqual(ids(await textPair('#777777', { size: { value: 17, unit: 'pt' } })), ['low-contrast']);
  const large = await textPair('#777777', { size: { value: 18, unit: 'pt' } });
  assert.deepEqual(ids(large), []);
  assert.equal(large.contrast[0].required, 3);
  assert.equal(large.contrast[0].text.large, true);
});

test('contrast: bold text is large from 14 pt, and 13.9 pt bold is not', async () => {
  assert.deepEqual(ids(await textPair('#777777', { size: { value: 14, unit: 'pt' }, weight: 'bold' })), []);
  assert.deepEqual(ids(await textPair('#777777', { size: { value: 14, unit: 'pt' }, weight: 600 })), ['low-contrast']);
  assert.deepEqual(ids(await textPair('#777777', { size: { value: 13.9, unit: 'pt' }, weight: 700 })), ['low-contrast']);
  assert.deepEqual(ids(await textPair('#777777', { size: { value: 14, unit: 'pt' } })), ['low-contrast']);
});

test('contrast: a text pair without a size is checked as small text', async () => {
  const report = await textPair('#777777');
  assert.deepEqual(ids(report), ['low-contrast']);
  assert.equal(report.contrast[0].text.sizePt, null);
});

test('contrast: a px size on the web is 0.75 point, so 24px is large and 23px is not; on ios px is a point', async () => {
  assert.deepEqual(ids(await textPair('#777777', { size: { value: 24, unit: 'px' }, platform: 'web' })), []);
  assert.deepEqual(ids(await textPair('#777777', { size: { value: 23, unit: 'px' }, platform: 'web' })), ['low-contrast']);
  assert.deepEqual(ids(await textPair('#777777', { size: { value: 18, unit: 'px' }, platform: 'ios' })), []);
  assert.deepEqual(ids(await textPair('#777777', { size: { value: 18, unit: 'px' } })), ['low-contrast']);
});

test('contrast: the size can be a dimension token, and a token that is not a dimension is reported', async () => {
  const ok = await check({ light: { fg: color('#777777'), bg: color('#ffffff') }, big: dim(20, 'pt') }, { pairs: [pair('Title', ['light'], { size: 'big' })] });
  assert.deepEqual(ids(ok), []);
  const bad = await check({ light: { fg: color('#777777'), bg: color('#ffffff') } }, { pairs: [pair('Title', ['light'], { size: 'light.fg' })] });
  assert.ok(ids(bad).includes('wrong-token-type'));
});

test('contrast: a non-text pair (icon, border, focus ring) needs 3:1: #949494 passes and #959595 does not', async () => {
  const run = (fg) => check({ light: { fg: color(fg), bg: color('#ffffff') } }, { pairs: [pair('Border', ['light'], { kind: 'ui' })] });
  const pass = await run('#949494');
  assert.deepEqual(ids(pass), []);
  assert.equal(pass.contrast[0].required, 3);
  assert.equal(pass.contrast[0].criterion, '1.4.11 Non-text Contrast');
  const fail = await run('#a0a0a0');
  assert.deepEqual(ids(fail), ['low-contrast']);
  assert.match(find(fail, 'low-contrast')[0].message, /a non-text component needs at least 3:1/);
});

test('contrast: both themes are checked, and a failing dark pair is reported with its theme', async () => {
  const tokens = {
    light: { fg: color('#000000'), bg: color('#ffffff') },
    dark: { fg: color('#555555'), bg: color('#000000') }
  };
  const report = await check(tokens, { pairs: [pair('Body', ['light', 'dark'])] });
  assert.deepEqual(report.contrast.map((c) => [c.theme, c.pass]), [['light', true], ['dark', false]]);
  assert.match(find(report, 'low-contrast')[0].message, /^Body \(dark\):/);
});

test('contrast: rgb() and object colors are read, and an alias to a palette color works', async () => {
  const tokens = {
    palette: { ink: color({ colorSpace: 'srgb', components: [0, 0, 0] }), paper: color('rgb(255, 255, 255)') },
    light: { fg: color('{palette.ink}'), bg: { $value: '{palette.paper}' } }
  };
  const report = await check(tokens, { pairs: [pair('Body', ['light'])] });
  assert.deepEqual(ids(report), []);
  assert.equal(report.contrast[0].ratio, 21);
});

test('contrast: a text color with alpha is drawn over the background first', async () => {
  const report = await textPair('#00000080');
  assert.equal(report.contrast[0].foreground.hex, '#7f7f7f');
  assert.deepEqual(ids(report), ['low-contrast']);
  assert.match(find(report, 'low-contrast')[0].message, /drawn over the background at an alpha of 0\.502/);
});

test('contrast: a background with alpha below 1 is an error, because the ratio would depend on what lies behind', async () => {
  const report = await textPair('#000000', {}, '#ffffff80');
  assert.deepEqual(ids(report), ['translucent-background']);
  assert.equal(report.contrast.length, 0);
});

test('touch targets: iOS below 44 pt is a warning, 44 pt passes, and below 28 pt says it is under Apple\'s smallest size', async () => {
  const warn = await target('ios', 40, 'pt');
  assert.equal(find(warn, 'small-target')[0].severity, 'warning');
  assert.equal(warn.gate.pass, true);
  assert.equal(warn.counts.warning, 1);
  assert.deepEqual(ids(await target('ios', 44, 'pt')), []);
  assert.deepEqual(ids(await target('ios', 43.9, 'pt')), ['small-target']);
  assert.match(find(await target('ios', 20, 'pt'), 'small-target')[0].message, /below even that/);
  assert.doesNotMatch(find(warn, 'small-target')[0].message, /below even that/);
});

test('touch targets: Android below 48 dp is a warning, and 48 dp passes', async () => {
  const warn = await target('android', 44, 'dp');
  assert.equal(find(warn, 'small-target')[0].severity, 'warning');
  assert.match(find(warn, 'small-target')[0].message, /below the 48 dp minimum/);
  assert.deepEqual(ids(await target('android', 48, 'dp')), []);
});

test('touch targets: the web below 24 CSS px is an error, 24 px passes, and the gate fails', async () => {
  const bad = await target('web', 20, 'px');
  const [f] = find(bad, 'small-target');
  assert.equal(f.severity, 'error');
  assert.match(f.message, /WCAG 2\.2 success criterion 2\.5\.8/);
  assert.equal(bad.gate.pass, false);
  assert.deepEqual(ids(await target('web', 24, 'px')), []);
});

test('touch targets: the finding is at the token in the tokens file, and names its path', async () => {
  const tokens = { size: dim(20, 'px') };
  const report = await check(tokens, { targets: [{ token: 'size', platform: 'web' }] });
  const [f] = find(report, 'small-target');
  assert.equal(f.file, 'tokens.json');
  assert.equal(f.line, lineOf(json(tokens), '"size"'));
  assert.equal(f.subject, 'size');
});

test('units: px on ios and android is read as pt and dp, rem uses the rem base, and each conversion is shown', async () => {
  const ios = await target('ios', 40, 'px');
  assert.equal(ios.targets[0].conversion, 'px read as pt');
  assert.match(find(ios, 'small-target')[0].message, /\(px read as pt = 40 pt\)/);
  const rem = await target('web', 1.25, 'rem', { remBase: 16 });
  assert.equal(rem.targets[0].size, 20);
  assert.deepEqual(ids(rem), ['small-target']);
  assert.deepEqual(ids(await target('web', 1.5, 'rem', { remBase: 16 })), []);
  assert.deepEqual(ids(await target('web', 1.5, 'rem', { remBase: 10 })), ['small-target']);
});

test('units: a unit that is not used on the platform is an error, and the target is not compared', async () => {
  for (const [platform, unit] of [['android', 'pt'], ['ios', 'dp'], ['web', 'pt'], ['web', 'dp']]) {
    const report = await target(platform, 60, unit);
    assert.deepEqual(ids(report), ['unit-mismatch'], `${unit} on ${platform}`);
    assert.equal(report.targets.length, 0);
    assert.equal(find(report, 'unit-mismatch')[0].severity, 'error');
  }
});

test('touch targets: a target that is not a dimension token is reported', async () => {
  const report = await check({ size: color('#000') }, { targets: [{ token: 'size', platform: 'ios' }] });
  assert.deepEqual(ids(report), ['wrong-token-type']);
});

test('tokens file: an alias cycle is an error for every token in it, with its path, file and line', async () => {
  const text = json({ a: { $type: 'color', $value: '{b}' }, b: { $type: 'color', $value: '{c}' }, c: { $type: 'color', $value: '{a}' } });
  const report = await check(text, null);
  const cycles = find(report, 'alias-cycle');
  assert.deepEqual(cycles.map((f) => f.subject), ['a', 'b', 'c']);
  assert.deepEqual(cycles.map((f) => f.line), [lineOf(text, '"a"') + 2, lineOf(text, '"b"') + 2, lineOf(text, '"c"') + 2]);
  assert.ok(cycles.every((f) => f.file === 'tokens.json' && f.severity === 'error'));
  assert.match(cycles[0].message, /a -> b -> c -> a/);
});

test('tokens file: a token that only leads into a cycle gets no cycle finding of its own', async () => {
  const report = await check({ $type: 'color', in: { $value: '{a}' }, a: { $value: '{b}' }, b: { $value: '{a}' } }, null);
  assert.deepEqual(find(report, 'alias-cycle').map((f) => f.subject), ['a', 'b']);
});

test('tokens file: an unresolved alias names the missing path, and a group or a different letter case in the hint', async () => {
  const report = await check({ $type: 'color', base: { primary: { $value: '#000' } }, a: { $value: '{base.secondary}' }, b: { $value: '{base}' }, c: { $value: '{Base.primary}' } }, null);
  const found = find(report, 'unresolved-alias');
  assert.deepEqual(found.map((f) => f.subject), ['a', 'b', 'c']);
  assert.match(found[0].message, /no token has the path base\.secondary/);
  assert.match(found[1].message, /base is a group, not a token/);
  assert.match(found[2].message, /base\.primary does, and letter case counts/);
});

test('tokens file: an invalid color is an error at the line of its value', async () => {
  const text = json({ ok: color('#000'), bad: color('#12345') });
  const report = await check(text, null);
  const [f] = find(report, 'invalid-color');
  assert.equal(f.subject, 'bad');
  assert.equal(f.line, lineOf(text, '#12345'));
  assert.equal(f.severity, 'error');
});

test('tokens file: an invalid dimension is an error', async () => {
  const report = await check({ ok: dim(1, 'px'), bad: { $type: 'dimension', $value: { value: 1, unit: 'em' } } }, null);
  assert.deepEqual(find(report, 'invalid-dimension').map((f) => f.subject), ['bad']);
});

test('tokens file: a missing $type that no group supplies is an error, and an inherited one is not', async () => {
  const text = json({ typed: { $type: 'color', one: { $value: '#000' } }, loose: { $value: '#000' } });
  const report = await check(text, null);
  assert.deepEqual(find(report, 'missing-type').map((f) => f.subject), ['loose']);
  assert.equal(find(report, 'missing-type')[0].line, lineOf(text, '"loose"'));
});

test('tokens file: an alias takes its type from the token it names, so it needs none of its own', async () => {
  const report = await check({ base: color('#000'), alias: { $value: '{base}' } }, null);
  assert.deepEqual(ids(report), []);
});

test('tokens file: a $type that differs from the aliased token\'s type is an error', async () => {
  const report = await check({ base: color('#000'), alias: { $type: 'dimension', $value: '{base}' } }, null);
  assert.deepEqual(ids(report), ['alias-type-mismatch']);
});

test('tokens file: an unknown $type is a warning', async () => {
  const report = await check({ a: { $type: 'colour', $value: '#000' } }, null);
  assert.deepEqual(ids(report), ['unknown-type']);
  assert.equal(report.findings[0].severity, 'warning');
});

test('tokens file: a duplicate name is an error with both lines, and the repeated token is ignored', async () => {
  const text = '{\n  "$type": "color",\n  "a": { "$value": "#000" },\n  "a": { "$value": "#fff" }\n}\n';
  const report = await check(text, null);
  const [f] = find(report, 'duplicate-name');
  assert.equal(f.line, 4);
  assert.equal(f.subject, 'a');
  assert.match(f.message, /first at line 3/);
  assert.equal(report.tokens.tokens, 1);
});

test('tokens file: names that break the alias syntax are errors', async () => {
  const report = await check({ 'a.b': { $value: 1 }, $odd: { $value: 1 } }, null);
  assert.deepEqual(find(report, 'invalid-name').map((f) => f.subject).sort(), ['$odd', 'a.b']);
});

test('tokens file: a file that is not JSON is a tokens-invalid error with the line, and the run goes on', async () => {
  const report = await check('{\n  "a": {\n    "$value": \n  }\n}\n', { pairs: [pair('x', ['light'])] });
  const [f] = find(report, 'tokens-invalid');
  assert.equal(f.severity, 'error');
  assert.equal(f.line, 4);
  assert.equal(report.tokens.readable, false);
  assert.ok(ids(report).includes('missing-token'));
});

test('tokens file: a JSON value that is not an object is tokens-invalid', async () => {
  assert.deepEqual(ids(await check('[1, 2]', null)), ['tokens-invalid']);
});

test('rules: a pair that names a missing token is an error at the line of the name', async () => {
  const rules = { pairs: [{ name: 'Body', themes: { light: { foreground: 'light.fgg', background: 'light.bg' } } }] };
  const report = await check({ light: { fg: color('#000'), bg: color('#fff') } }, rules);
  const [f] = find(report, 'missing-token');
  assert.equal(f.file, 'token-rules.json');
  assert.equal(f.line, lineOf(json(rules), '"foreground"'));
  assert.equal(f.subject, 'light.fgg');
  assert.equal(report.contrast.length, 0);
});

test('rules: token paths are compared exactly, letter case included, and the hint says so', async () => {
  const rules = { pairs: [{ name: 'Body', themes: { light: { foreground: 'Light.fg', background: 'light.bg' } } }] };
  const report = await check({ light: { fg: color('#000'), bg: color('#fff') } }, rules);
  assert.match(find(report, 'missing-token')[0].message, /light\.fg does, and letter case counts/);
});

test('rules: a pair that names a token that is not a color is an error', async () => {
  const report = await check({ light: { fg: dim(1, 'px'), bg: color('#fff') } }, { pairs: [pair('Body', ['light'])] });
  assert.deepEqual(ids(report), ['wrong-token-type']);
});

test('rules: a pair whose token leads into an alias cycle is reported as not checked, not skipped', async () => {
  const report = await check({ light: { fg: color('{light.bg}'), bg: color('{light.fg}') } }, { pairs: [pair('Body', ['light'])] });
  assert.ok(ids(report).includes('unchecked-rule'));
  assert.equal(report.contrast.length, 0);
});

test('themes: a theme that one pair lists and another does not is a warning on the pair without it', async () => {
  const tokens = {
    light: { fg: color('#000'), bg: color('#fff') },
    dark: { fg: color('#fff'), bg: color('#000') }
  };
  const rules = { pairs: [pair('Body', ['light', 'dark']), pair('Caption', ['light'])] };
  const report = await check(tokens, rules);
  const [f] = find(report, 'theme-missing');
  assert.equal(f.severity, 'warning');
  assert.equal(f.subject, 'Caption');
  assert.match(f.message, /no "dark" theme, which "Body" lists/);
  assert.equal(f.line, lineOf(json(rules), '"name": "Caption"') - 1);
  assert.equal(report.gate.pass, true);
  assert.deepEqual(report.themes, ['dark', 'light']);
});

test('themes: pairs that all list the same single theme give no warning', async () => {
  const report = await check({ light: { fg: color('#000'), bg: color('#fff') } }, { pairs: [pair('A', ['light']), pair('B', ['light'])] });
  assert.deepEqual(ids(report), []);
});

test('rules file: without one next to the tokens file, only the token checks run, and a note says so', async () => {
  const report = await check({ a: color('#000') }, null);
  assert.equal(report.rules.file, null);
  assert.match(report.notes[0], /no token-rules\.json next to the tokens file/);
  assert.deepEqual(ids(report), []);
});

test('rules file: one named with --rules that does not exist is an error finding', async () => {
  const report = await check({ a: color('#000') }, null, { rules: 'nowhere.json' });
  assert.deepEqual(ids(report), ['rules-missing']);
  assert.equal(report.rules.problem, 'missing');
});

test('rules file: JSON that is broken is rules-invalid with the line, and the tokens are still checked', async () => {
  const report = await check({ a: { $value: '#000' } }, '{\n  "pairs": [\n    oops\n  ]\n}\n');
  assert.deepEqual(ids(report).sort(), ['missing-type', 'rules-invalid']);
  assert.equal(find(report, 'rules-invalid')[0].line, 3);
});

test('rules file: another folder and file name can be given, and paths in findings stay relative with forward slashes', async () => {
  const files = {
    'design/tokens.json': json({ size: dim(20, 'px') }),
    'config/my-rules.json': json({ targets: [{ token: 'size', platform: 'web' }] })
  };
  const report = await withFiles(files, (dir) => checkTokens('design/tokens.json', { rules: `${dir}/config/my-rules.json`, base: dir }));
  assert.equal(report.tokens.file, 'design/tokens.json');
  assert.equal(report.rules.file, 'config/my-rules.json');
  assert.equal(find(report, 'small-target')[0].file, 'design/tokens.json');
  assert.ok(report.findings.every((f) => !f.file.includes('\\')));
});

test('rules file: a folder given in place of the tokens file stands for tokens.json in it', async () => {
  const report = await withFiles({ 'app/tokens.json': json({ a: color('#000') }), 'app/token-rules.json': json({ pairs: [pair('x', ['light'])] }) }, (dir) => checkTokens('app', { base: dir }));
  assert.equal(report.tokens.file, 'app/tokens.json');
  assert.equal(report.rules.file, 'app/token-rules.json');
});

test('input: a tokens file that does not exist, or is a folder without tokens.json, stops the run with an error', async () => {
  await withFiles({ 'x/readme.txt': 'hi' }, async (dir) => {
    await assert.rejects(() => checkTokens('missing.json', { base: dir }), /missing\.json: no such file/);
    await assert.rejects(() => checkTokens('x', { base: dir }), /x: no such file/);
  });
});

test('input: a tokens file over the size limit is refused', async () => {
  await withFiles({ 'tokens.json': json({ a: color('#000') }) }, async (dir) => {
    await assert.rejects(() => checkTokens('tokens.json', { base: dir, limits: { maxFileBytes: 10 } }), /over the .* limit/);
  });
});

test('every finding has an id, a severity, a file, a line of 1 or more, a subject, a message and a fix', async () => {
  const report = await check(
    { $type: 'color', a: { $value: '{a}' }, b: { $value: '#12345' }, size: { $type: 'dimension', $value: { value: 1, unit: 'pt' } }, loose: { $value: '#000' } },
    { pairs: [pair('x', ['light']), pair('y', ['dark'])], targets: [{ token: 'size', platform: 'web' }] }
  );
  assert.ok(report.findings.length >= 6);
  for (const f of report.findings) {
    assert.match(f.id, /^[a-z-]+$/);
    assert.ok(['error', 'warning'].includes(f.severity));
    assert.ok(f.file && !f.file.includes('\\'), f.id);
    assert.ok(Number.isInteger(f.line) && f.line >= 1, f.id);
    assert.ok(f.subject, f.id);
    assert.ok(f.message.length > 10 && f.fix.length > 5, f.id);
  }
});

test('gate: warnings fail the run only with --fail-on warning', async () => {
  const tokens = { size: dim(40, 'pt') };
  const rules = { targets: [{ token: 'size', platform: 'ios' }] };
  const error = await check(tokens, rules);
  assert.deepEqual([error.counts.error, error.counts.warning, error.gate.pass], [0, 1, true]);
  const warning = await check(tokens, rules, { failOn: 'warning' });
  assert.equal(warning.gate.pass, false);
  assert.equal(warning.gate.reason, '1 warning');
});

test('the same files always give the same report', async () => {
  const tokens = { light: { fg: color('#777'), bg: color('#fff') }, size: dim(20, 'px') };
  const rules = { pairs: [pair('Body', ['light'])], targets: [{ token: 'size', platform: 'web' }] };
  assert.deepEqual(await check(tokens, rules), await check(tokens, rules));
});

test('a cycle of 3,000 tokens is reported for every token, with a chain cut after eight, and the run stays fast', async () => {
  const count = 3000;
  const tokens = { $type: 'color' };
  for (let k = 0; k < count; k += 1) tokens[`t${k}`] = { $value: `{t${(k + 1) % count}}` };
  const started = Date.now();
  const report = await check(tokens, null);
  const cycles = find(report, 'alias-cycle');
  assert.equal(cycles.length, count);
  assert.match(cycles[0].message, /t0 -> t1 -> t2 -> t3 -> t4 -> t5 -> t6 -> t7 -> \.\.\. 2992 more/);
  assert.ok(Date.now() - started < 5000, 'finished within five seconds');
});
