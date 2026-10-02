// Command line: design-token-check <tokens-file-or-folder> [options]

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { checkTokens, FINDINGS, LIMITS } from './check.js';
import { RULES_FILE, TOKENS_FILE } from './data.js';
import { toText, toMarkdown, toJson, toCsv } from './report.js';

export const VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

const FORMATS = { text: toText, markdown: toMarkdown, json: toJson, csv: toCsv };
const THRESHOLDS = ['error', 'warning'];

export const USAGE = `Usage: design-token-check <tokens-file-or-folder> [options]

Checks the design tokens of a mobile app design system before handoff to developers. The tokens file is in the
format of the W3C Design Tokens Community Group (JSON with $value and $type, groups, {alias.references}). A rules
file lists which text color sits on which background color, per theme, and which tokens are touch target sizes
for which platform. The tool computes the WCAG 2.x contrast ratio of every pair, compares the touch targets with
the minimum of their platform, and reports token file problems. It reads the two files only and opens no
connection.

A folder stands for the ${TOKENS_FILE} in it.

Options:
  --rules <file>     the rules file (default: ${RULES_FILE} in the folder of the tokens file)
  --format <name>    text, markdown, json or csv (default: text)
  --fail-on <level>  exit with 1 when a finding is at this level or above: error or warning
                     (default: error)
  --help             show this text
  --version          show the version

Checks: ${FINDINGS.map((f) => f.id).join(', ')}

Exit codes: 0 no finding at the --fail-on level, 1 such a finding, 2 usage or input error.
`;

export function parseArgs(argv) {
  const o = { tokens: null, rules: null, format: 'text', failOn: 'error', help: false, version: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) throw new Error(`${a} needs a value`);
      i += 1;
      return v;
    };
    if (a === '--help' || a === '-h') o.help = true;
    else if (a === '--version' || a === '-v') o.version = true;
    else if (a === '--rules') o.rules = next();
    else if (a === '--format') o.format = next();
    else if (a === '--fail-on') o.failOn = next();
    else if (a === '-') throw new Error('reading from standard input is not supported; give the path of the tokens file');
    else if (a.startsWith('-')) throw new Error(`unknown argument ${a}`);
    else if (o.tokens !== null) throw new Error(`give one tokens file, not ${a} as well`);
    else o.tokens = a;
  }
  if (!o.help && !o.version) {
    if (o.tokens === null) throw new Error('give the path of the tokens file');
    for (const value of [o.tokens, o.rules]) {
      if (value !== null && /^[a-z][a-z0-9+.-]*:\/\//i.test(value)) throw new Error('give a local path; the tool never fetches a URL');
    }
    if (!Object.hasOwn(FORMATS, o.format)) throw new Error(`unknown format ${o.format} (text, markdown, json or csv)`);
    if (!THRESHOLDS.includes(o.failOn)) throw new Error(`--fail-on takes error or warning, not ${o.failOn}`);
  }
  return o;
}

function clean(text) {
  return String(text).replace(/[\u0000-\u001f\u007f-\u009f\u200e\u200f\u2028\u2029\u202a-\u202e\u2066-\u2069]/g, ' ');
}

// Exit code: 0 no finding at the --fail-on level, 1 such a finding, 2 usage or input error.
export async function main(argv, io = { out: (t) => process.stdout.write(t), err: (t) => process.stderr.write(t) }, limits = LIMITS, base = process.cwd()) {
  let o;
  try {
    o = parseArgs(argv);
  } catch (error) {
    io.err(`design-token-check: ${clean(error.message)}\n\n${USAGE}`);
    return 2;
  }
  if (o.help) {
    io.out(USAGE);
    return 0;
  }
  if (o.version) {
    io.out(`${VERSION}\n`);
    return 0;
  }
  let report;
  try {
    report = await checkTokens(o.tokens, { rules: o.rules === null ? null : resolve(base, o.rules), failOn: o.failOn, version: VERSION, limits, base });
  } catch (error) {
    io.err(`design-token-check: ${clean(error.message)}\n`);
    return 2;
  }
  io.out(FORMATS[o.format](report));
  return report.gate.pass ? 0 : 1;
}
