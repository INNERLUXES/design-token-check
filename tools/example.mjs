// Runs the README examples, checks that they report what the README shows, and writes the reports of the
// failing example app to examples/output. CI runs it and then fails if those files changed, so the example
// output in the repository is always the real output.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { main, LIMITS } from '../src/index.js';

const root = resolve(fileURLToPath(import.meta.url), '..', '..');

// Runs the tool on files of the repository; paths in the report are relative to the repository.
async function run(argv) {
  let out = '';
  const code = await main(argv, { out: (t) => { out += t; }, err: (t) => process.stderr.write(t) }, LIMITS, root);
  return { code, out };
}

const problems = [];
function expect(name, result, code, expected, unwanted) {
  const missing = expected.filter((e) => !result.out.includes(e));
  const wrong = unwanted.filter((e) => result.out.includes(e));
  if (result.code !== code || missing.length || wrong.length) {
    problems.push(`${name}: unexpected report (exit code ${result.code}, expected ${code}; missing: ${missing.join(' / ') || 'none'}; should not appear: ${wrong.join(' / ') || 'none'})`);
  }
}

const failing = await run([resolve(root, 'examples/tidewater-app')]);
process.stdout.write(failing.out);
expect('failing app', failing, 1, [
  'design-token-check: examples/tidewater-app/tokens.json',
  'contrast: 12 checked, 11 pass, 1 fail',
  '  FAIL  dark   Caption: color.dark.text.muted on color.dark.surface.default  3.75:1  needs 4.5:1',
  '  ok    light  Caption: color.light.text.muted on color.light.surface.default  4.76:1  needs 4.5:1',
  'touch targets: 5 checked',
  '  FAIL  web      Icon button: size.touch.web.icon-button  20 px  needs 24 px',
  '(rem x 16 = 40 px)',
  'findings: 2 error, 0 warning',
  'ERROR    low-contrast  examples/tidewater-app/token-rules.json:26  color.dark.text.muted',
  'ERROR    small-target  examples/tidewater-app/tokens.json:57  size.touch.web.icon-button',
  'GATE: FAIL - 2 errors'
], ['GATE: PASS']);

process.stdout.write('\n');
const fixed = await run([resolve(root, 'examples/tidewater-app-fixed'), '--fail-on', 'warning']);
process.stdout.write(fixed.out);
expect('fixed app with --fail-on warning', fixed, 0, [
  'contrast: 12 checked, 12 pass, 0 fail',
  '  ok    dark   Caption: color.dark.text.muted on color.dark.surface.default  6.96:1  needs 4.5:1',
  'findings: 0 error, 0 warning',
  'GATE: PASS (--fail-on warning)'
], ['ERROR', 'WARNING', 'FAIL']);

process.stdout.write('\n');
const broken = await run([resolve(root, 'examples/broken-tokens')]);
process.stdout.write(broken.out);
expect('broken tokens', broken, 1, [
  'findings: 12 error, 1 warning',
  'ERROR    alias-cycle  examples/broken-tokens/tokens.json:7  color.text.primary',
  '(color.text.primary -> color.text.body -> color.text.default -> color.text.primary)',
  'ERROR    unresolved-alias  examples/broken-tokens/tokens.json:11  color.accent',
  'ERROR    invalid-color  examples/broken-tokens/tokens.json:12  color.border',
  'ERROR    missing-token  examples/broken-tokens/token-rules.json:21  color.text.hint',
  'ERROR    missing-type  examples/broken-tokens/tokens.json:16  size.touch.button',
  'WARNING  theme-missing  examples/broken-tokens/token-rules.json:11  Link text',
  'GATE: FAIL - 12 errors'
], ['GATE: PASS']);

// The README shows the runs as they are printed.
const readme = (await readFile(resolve(root, 'README.md'), 'utf8')).split('\r\n').join('\n');
if (!readme.includes(failing.out)) problems.push('README: the sample output of the failing app differs from a real run');
if (!readme.includes(fixed.out)) problems.push('README: the sample output of the fixed app differs from a real run');
if (!readme.includes(broken.out)) problems.push('README: the sample output of the broken tokens differs from a real run');

// The same project in the other formats, kept as examples of what each one looks like.
await mkdir(resolve(root, 'examples/output'), { recursive: true });
await writeFile(resolve(root, 'examples/output/tidewater-app.txt'), failing.out);
for (const [format, name] of [['markdown', 'tidewater-app.md'], ['json', 'tidewater-app.json'], ['csv', 'tidewater-app.csv']]) {
  const r = await run([resolve(root, 'examples/tidewater-app'), '--format', format]);
  if (r.code !== 1) problems.push(`${format}: exit code ${r.code}, expected 1`);
  await writeFile(resolve(root, 'examples/output', name), r.out);
}

if (problems.length) {
  for (const p of problems) console.error(`example: ${p}`);
  process.exit(1);
}
