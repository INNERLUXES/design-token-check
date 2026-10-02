// Shared test helpers: token files and rules files written inline into a temporary folder that is removed
// after the test.

import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { checkTokens, main } from '../src/index.js';

export async function withFiles(files, fn) {
  const dir = await mkdtemp(resolve(tmpdir(), 'design-token-check-'));
  try {
    for (const [rel, content] of Object.entries(files)) {
      await mkdir(dirname(resolve(dir, rel)), { recursive: true });
      await writeFile(resolve(dir, rel), content);
    }
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export const json = (value) => `${JSON.stringify(value, null, 2)}\n`;

// A color token, and a dimension token.
export const color = (value) => ({ $type: 'color', $value: value });
export const dim = (value, unit) => ({ $type: 'dimension', $value: { value, unit } });

// The line (from 1) of the first line of the text that holds the needle.
export function lineOf(text, needle) {
  const index = text.split('\n').findIndex((l) => l.includes(needle));
  return index === -1 ? -1 : index + 1;
}

// A pair of the rules file with the same two colors in the given themes.
export function pair(name, themes, extra = {}) {
  return { name, ...extra, themes: Object.fromEntries(themes.map((t) => [t, { foreground: `${t}.fg`, background: `${t}.bg` }])) };
}

// Writes tokens.json and token-rules.json (objects are written as JSON, strings as they are) and checks them.
export async function check(tokens, rules, options = {}, extra = {}) {
  const files = { ...extra };
  files['tokens.json'] = typeof tokens === 'string' ? tokens : json(tokens);
  if (rules !== null && rules !== undefined) files['token-rules.json'] = typeof rules === 'string' ? rules : json(rules);
  return withFiles(files, (dir) => checkTokens('tokens.json', { base: dir, ...options }));
}

// Writes the files and runs the command line with these arguments (paths relative to the folder).
export async function run(files, args = [], limits) {
  return withFiles(files, async (dir) => {
    let out = '';
    let err = '';
    const code = await main(args, { out: (t) => { out += t; }, err: (t) => { err += t; } }, limits, dir);
    return { code, out, err };
  });
}

// Runs the command line with exactly these arguments.
export async function cli(argv) {
  let out = '';
  let err = '';
  const code = await main(argv, { out: (t) => { out += t; }, err: (t) => { err += t; } });
  return { code, out, err };
}

export const ids = (report) => report.findings.map((f) => f.id);
export const find = (report, id) => report.findings.filter((f) => f.id === id);

// The light/dark tokens of a made-up app: a fg and bg color for each theme.
export function twoThemes(light = ['#000000', '#ffffff'], dark = ['#ffffff', '#000000']) {
  return {
    light: { fg: color(light[0]), bg: color(light[1]) },
    dark: { fg: color(dark[0]), bg: color(dark[1]) }
  };
}
