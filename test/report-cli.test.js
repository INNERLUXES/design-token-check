import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, symlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkTokens, csvCell, displayPath, fileError, main, mdCell, parseArgs, readBounded, toCsv, toJson, toMarkdown, toText, VERSION } from '../src/index.js';
import { check, cli, color, dim, json, pair, run, withFiles } from './helpers.js';

const root = resolve(fileURLToPath(import.meta.url), '..', '..');
const control = (n) => String.fromCharCode(n);

// A project with one failing dark pair and one web target at 20px, as files of a folder.
const FILES = {
  'app/tokens.json': json({
    light: { fg: color('#000000'), bg: color('#ffffff') },
    dark: { fg: color('#555555'), bg: color('#000000') },
    size: dim(20, 'px')
  }),
  'app/token-rules.json': json({
    pairs: [pair('Body', ['light', 'dark'])],
    targets: [{ name: 'Icon button', token: 'size', platform: 'web' }]
  })
};

test('exit code 1 when an error is found, and the text report names the token, the file and the line', async () => {
  const r = await run(FILES, ['app']);
  assert.equal(r.code, 1);
  assert.match(r.out, /^design-token-check: app\/tokens\.json\n/);
  assert.match(r.out, /contrast: 2 checked, 1 pass, 1 fail/);
  assert.match(r.out, /FAIL {2}dark {3}Body: dark\.fg on dark\.bg {2}2\.\d\d:1 {2}needs 4\.5:1/);
  assert.match(r.out, /ERROR {4}low-contrast {2}app\/token-rules\.json:\d+ {2}dark\.fg/);
  assert.match(r.out, /ERROR {4}small-target {2}app\/tokens\.json:\d+ {2}size/);
  assert.match(r.out, /GATE: FAIL - 2 errors\n$/);
  assert.equal(r.err, '');
});

test('exit code 0 when nothing is at the --fail-on level, and 1 for a warning with --fail-on warning', async () => {
  const files = {
    'tokens.json': json({ size: dim(40, 'pt') }),
    'token-rules.json': json({ targets: [{ token: 'size', platform: 'ios' }] })
  };
  assert.equal((await run(files, ['tokens.json'])).code, 0);
  assert.equal((await run(files, ['tokens.json', '--fail-on', 'error'])).code, 0);
  const strict = await run(files, ['tokens.json', '--fail-on', 'warning']);
  assert.equal(strict.code, 1);
  assert.match(strict.out, /GATE: FAIL - 1 warning/);
});

test('exit code 2 for a usage or input error, with the reason and the usage on standard error', async () => {
  for (const args of [[], ['a.json', 'b.json'], ['a.json', '--format', 'xml'], ['a.json', '--fail-on', 'review'], ['a.json', '--nope'], ['a.json', '--rules'], ['-'], ['https://example.test/tokens.json'], ['a.json', '--rules', 'file://x/y.json']]) {
    const r = await cli(args);
    assert.equal(r.code, 2, args.join(' '));
    assert.match(r.err, /^design-token-check: /);
    assert.match(r.err, /Usage: design-token-check/);
    assert.equal(r.out, '');
  }
});

test('exit code 2 for a tokens file that does not exist', async () => {
  const r = await run({ 'x.txt': '' }, ['nowhere.json']);
  assert.equal(r.code, 2);
  assert.match(r.err, /nowhere\.json: no such file/);
});

test('--help and --version print and exit 0, and the version is the package version', async () => {
  const help = await cli(['--help']);
  assert.equal(help.code, 0);
  assert.match(help.out, /^Usage: design-token-check/);
  assert.match(help.out, /Exit codes: 0 no finding/);
  const version = await cli(['--version']);
  assert.equal(version.out, `${VERSION}\n`);
  assert.equal(VERSION, JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8')).version);
});

test('parseArgs reads every option, and the options may come before the file', () => {
  const o = parseArgs(['--rules', 'r.json', '--format', 'csv', '--fail-on', 'warning', 't.json']);
  assert.deepEqual(o, { tokens: 't.json', rules: 'r.json', format: 'csv', failOn: 'warning', help: false, version: false });
});

test('--rules names another rules file, relative to the folder the command runs in', async () => {
  const files = {
    'tokens.json': json({ size: dim(20, 'px') }),
    'other/web.json': json({ targets: [{ token: 'size', platform: 'web' }] })
  };
  const r = await run(files, ['tokens.json', '--rules', 'other/web.json']);
  assert.equal(r.code, 1);
  assert.match(r.out, /rules: other\/web\.json, 0 pairs, 1 target/);
});

test('JSON report: the whole report, with every pair, every target and every finding', async () => {
  const r = await run(FILES, ['app', '--format', 'json']);
  assert.equal(r.code, 1);
  const report = JSON.parse(r.out);
  assert.equal(report.tool, 'design-token-check');
  assert.equal(report.tokens.file, 'app/tokens.json');
  assert.equal(report.contrast.length, 2);
  assert.equal(report.contrast[1].ratio, 2.82);
  assert.equal(report.contrast[0].ratio, 21);
  assert.equal(report.contrast[1].foreground.token, 'dark.fg');
  assert.equal(report.targets[0].size, 20);
  assert.equal(report.targets[0].sizeUnit, 'px');
  assert.equal(report.findings.length, 2);
  assert.deepEqual(report.gate, { failOn: 'error', pass: false, reason: '2 errors' });
});

test('Markdown report: tables of pairs, targets and findings, and a gate line', async () => {
  const r = await run(FILES, ['app', '--format', 'markdown']);
  assert.match(r.out, /^## design-token-check: 2 error, 0 warning\n/);
  assert.match(r.out, /\| Result \| Theme \| Pair \| Foreground \| Background \| Ratio \| Needs \|/);
  assert.match(r.out, /\| \*\*fail\*\* \| dark \| Body \| dark\.fg \| dark\.bg \|/);
  assert.match(r.out, /\| Severity \| Check \| Where \| Message \| Fix \|/);
  assert.match(r.out, /\*\*Gate failed:\*\* 2 errors\.\n$/);
});

test('CSV report: one row per finding, CRLF line ends, and the header of the columns', async () => {
  const r = await run(FILES, ['app', '--format', 'csv']);
  const lines = r.out.split('\r\n');
  assert.equal(lines[0], 'severity,id,file,line,subject,message,fix');
  assert.equal(lines.length, 4);
  assert.equal(lines[3], '');
  assert.ok(lines[1].startsWith('error,low-contrast,app/token-rules.json,'));
});

test('CSV: a cell that a spreadsheet would run as a formula gets a leading quote, and quotes are doubled', () => {
  assert.equal(csvCell('=1+1'), "'=1+1");
  assert.equal(csvCell('+x'), "'+x");
  assert.equal(csvCell('-x'), "'-x");
  assert.equal(csvCell('@SUM(A1)'), "'@SUM(A1)");
  assert.equal(csvCell('a "b", c'), '"a ""b"", c"');
  assert.equal(csvCell(null), '');
});

test('Markdown: pipes, angle brackets, ampersands, backslashes and line breaks cannot break a table', () => {
  assert.equal(mdCell('a|b'), 'a\\|b');
  assert.equal(mdCell('<img src=x>'), '&lt;img src=x&gt;');
  assert.equal(mdCell('a&b'), 'a&amp;b');
  assert.equal(mdCell('a\\b'), 'a\\\\b');
  assert.equal(mdCell('a\nb'), 'a b');
});

test('text from the input: control and direction characters in a token name are removed from every format', async () => {
  const name = `bad${control(27)}[2Jname${control(0x202e)}rtl`;
  const tokens = json({ [name]: { $value: 1, $type: 'number', child: { $value: 2 } } });
  const report = await check(tokens, null);
  for (const format of [toText, toMarkdown, toJson, toCsv]) {
    const out = format(report);
    assert.ok(!out.includes(control(27)), format.name);
    assert.ok(!out.includes(control(0x202e)), format.name);
  }
  assert.ok(report.findings.length > 0);
});

test('text from the input: a name that could break a Markdown table or start a CSV formula is made harmless', async () => {
  const tokens = json({ '|<b>x': { $value: 1, child: { $value: 2 } }, '=cmd': { $value: 1, child: { $value: 2 } } });
  const report = await check(tokens, null);
  const md = toMarkdown(report);
  assert.ok(!md.includes('<b>'));
  const csv = toCsv(report);
  assert.ok(csv.split('\r\n').every((row) => !/^(?:[^,]*,){4}=/.test(row)));
  assert.ok(report.findings.some((f) => f.subject.startsWith('=cmd')));
  assert.ok(csv.includes("'=cmd"));
});

test('a key named __proto__ in the tokens file is just a name', async () => {
  const report = await check('{ "__proto__": { "$type": "number", "$value": 1 } }', null);
  assert.deepEqual(report.findings, []);
  assert.equal(report.tokens.tokens, 1);
  assert.equal({}.polluted, undefined);
});

test('a tokens file nested too deep is refused as tokens-invalid, not by running out of stack', async () => {
  const deep = `${'{"a":'.repeat(200)}1${'}'.repeat(200)}`;
  const report = await check(deep, null);
  assert.equal(report.findings[0].id, 'tokens-invalid');
  assert.match(report.findings[0].message, /nested more than 64 deep/);
});

test('a symbolic link in place of the default rules file is not followed', { skip: process.platform === 'win32' }, async () => {
  await withFiles({ 'real.json': json({ pairs: [pair('x', ['light'])] }), 'tokens.json': json({ a: color('#000') }) }, async (dir) => {
    await symlink(resolve(dir, 'real.json'), resolve(dir, 'token-rules.json'));
    const report = await checkTokens('tokens.json', { base: dir });
    assert.deepEqual(report.findings.map((f) => f.id), ['rules-missing']);
    assert.match(report.findings[0].message, /symbolic link/);
  });
});

test('a rules file in the middle of nowhere: the report says which file was read and how many rules', async () => {
  const r = await run(FILES, ['app']);
  assert.match(r.out, /rules: app\/token-rules\.json, 1 pair, 1 target, rem base 16/);
  assert.match(r.out, /themes: dark, light/);
});

test('the example app fails with the dark caption and the 20px web target, as the README shows', async () => {
  const report = await checkTokens(resolve(root, 'examples/tidewater-app'), { base: root });
  assert.deepEqual(report.findings.map((f) => `${f.id} ${f.subject}`), ['low-contrast color.dark.text.muted', 'small-target size.touch.web.icon-button']);
  assert.equal(report.contrastSummary.fail, 1);
  assert.equal(report.contrast.find((c) => !c.pass).ratio, 3.75);
});

test('the fixed example app passes with --fail-on warning, and the broken tokens find the cycle', async () => {
  const fixed = await checkTokens(resolve(root, 'examples/tidewater-app-fixed'), { base: root, failOn: 'warning' });
  assert.deepEqual(fixed.findings, []);
  assert.equal(fixed.gate.pass, true);
  const broken = await checkTokens(resolve(root, 'examples/broken-tokens'), { base: root });
  assert.equal(broken.findings.filter((f) => f.id === 'alias-cycle').length, 3);
  assert.equal(broken.gate.pass, false);
});

test('the reports in examples/output are what the tool prints now', async () => {
  for (const [format, name] of [['markdown', 'md'], ['json', 'json'], ['csv', 'csv']]) {
    const out = [];
    await main([resolve(root, 'examples/tidewater-app'), '--format', format], { out: (t) => out.push(t), err: () => {} }, undefined, root);
    const saved = await readFile(resolve(root, `examples/output/tidewater-app.${name}`), 'utf8');
    assert.equal(out.join(''), saved, name);
  }
});

test('paths: a path below the base is shown relative with forward slashes, one outside it is shown whole', () => {
  const base = resolve(root, 'examples');
  assert.equal(displayPath(resolve(base, 'tidewater-app', 'tokens.json'), base), 'tidewater-app/tokens.json');
  assert.equal(displayPath(base, base), '.');
  assert.ok(!displayPath(resolve(root, 'package.json'), base).includes('\\'));
  assert.equal(displayPath(resolve(root, 'package.json'), base).startsWith('..'), false);
});

test('files: a missing file, a folder and a file over the limit are refused with the reason alone in .reason', async () => {
  await withFiles({ 'a.json': '{}', 'dir/x.txt': '' }, async (dir) => {
    await assert.rejects(() => readBounded(resolve(dir, 'nope.json')), (e) => e.reason === 'no such file' && e.message.includes('nope.json'));
    await assert.rejects(() => readBounded(resolve(dir, 'dir')), (e) => /folder|regular file|cannot be read/.test(e.reason));
    await assert.rejects(() => readBounded(resolve(dir, 'a.json'), { maxFileBytes: 1 }), (e) => /over the/.test(e.reason));
    assert.equal((await readBounded(resolve(dir, 'a.json'))).toString('utf8'), '{}');
  });
  assert.equal(fileError('x.json', 'because').message, 'x.json: because');
});
