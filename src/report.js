// Report formats: text for a terminal, Markdown for a pull request or job summary, JSON for other tools, CSV
// for a spreadsheet.

function plural(count, one, many = `${one}s`) {
  return `${count.toLocaleString('en-US')} ${count === 1 ? one : many}`;
}

function countsLine(c) {
  return `${c.error} error, ${c.warning} warning`;
}

function where(f) {
  return `${f.file}:${f.line}`;
}

function ratioText(c) {
  return `${c.ratio.toFixed(2)}:1`;
}

function requiredText(c) {
  return `${c.required}:1`;
}

function sizeText(t) {
  return `${t.value} ${t.unit}`;
}

function conversionText(t) {
  return t.conversion ? ` (${t.conversion} = ${t.size} ${t.sizeUnit})` : '';
}

function gateLine(r) {
  return r.gate.pass ? `GATE: PASS (--fail-on ${r.gate.failOn})` : `GATE: FAIL - ${r.gate.reason}`;
}

function tokensLine(r) {
  if (!r.tokens.readable) return `${r.tokens.file}, not usable`;
  return `${plural(r.tokens.tokens, 'token')} (${plural(r.tokens.aliases, 'alias', 'aliases')}), ${plural(r.tokens.groups, 'group')}`;
}

function rulesLine(r) {
  if (r.rules.file === null) return 'none';
  if (!r.rules.readable) return `${r.rules.file}, not usable`;
  return `${r.rules.file}, ${plural(r.rules.pairs, 'pair')}, ${plural(r.rules.targets, 'target')}, rem base ${r.rules.remBase}`;
}

export function toText(r) {
  const lines = [`design-token-check: ${r.tokens.file}`, `tokens: ${tokensLine(r)}`, `rules: ${rulesLine(r)}`];
  if (r.themes.length) lines.push(`themes: ${r.themes.join(', ')}`);
  if (r.rules.readable) {
    lines.push(`contrast: ${r.contrastSummary.checked} checked, ${r.contrastSummary.pass} pass, ${r.contrastSummary.fail} fail`);
    const width = Math.max(0, ...r.contrast.map((c) => c.theme.length));
    for (const c of r.contrast) {
      lines.push(`  ${c.pass ? 'ok  ' : 'FAIL'}  ${c.theme.padEnd(width)}  ${c.pair}: ${c.foreground.token} on ${c.background.token}  ${ratioText(c)}  needs ${requiredText(c)}`);
    }
    lines.push(`touch targets: ${r.targets.length} checked`);
    for (const t of r.targets) {
      lines.push(`  ${t.pass ? 'ok  ' : 'FAIL'}  ${t.platform.padEnd(7)}  ${t.name}: ${t.token}  ${sizeText(t)}${conversionText(t)}  needs ${t.minimum} ${t.sizeUnit}`);
    }
  }
  lines.push(`findings: ${countsLine(r.counts)}`);
  if (!r.findings.length) lines.push('', 'no findings');
  for (const f of r.findings) {
    lines.push('', `${f.severity.toUpperCase().padEnd(7)}  ${f.id}  ${where(f)}  ${f.subject}`, `         ${f.message}`, `         fix: ${f.fix}`);
  }
  if (r.notes.length) lines.push('');
  for (const note of r.notes) lines.push(`note: ${note}`);
  lines.push('', gateLine(r));
  return lines.join('\n') + '\n';
}

// A Markdown table cell: backslashes and pipes escaped, line breaks flattened, and <, > and & written as
// entities, so text from an input file cannot break the table or be read as HTML.
export function mdCell(t) {
  return String(t)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n|\r/g, ' ');
}

export function toMarkdown(r) {
  const lines = [`## design-token-check: ${countsLine(r.counts)}`, '', `Tokens: \`${mdCell(r.tokens.file).replace(/`/g, "'")}\`, ${mdCell(tokensLine(r))}. Rules: ${mdCell(rulesLine(r))}.`];
  if (r.contrast.length) {
    lines.push('', '| Result | Theme | Pair | Foreground | Background | Ratio | Needs |', '| --- | --- | --- | --- | --- | --- | --- |');
    for (const c of r.contrast) lines.push(`| ${c.pass ? 'pass' : '**fail**'} | ${mdCell(c.theme)} | ${mdCell(c.pair)} | ${mdCell(c.foreground.token)} | ${mdCell(c.background.token)} | ${ratioText(c)} | ${requiredText(c)} |`);
  }
  if (r.targets.length) {
    lines.push('', '| Result | Platform | Target | Token | Size | Needs |', '| --- | --- | --- | --- | --- | --- |');
    for (const t of r.targets) lines.push(`| ${t.pass ? 'pass' : '**fail**'} | ${t.platform} | ${mdCell(t.name)} | ${mdCell(t.token)} | ${mdCell(sizeText(t) + conversionText(t))} | ${t.minimum} ${t.sizeUnit} |`);
  }
  if (!r.findings.length) lines.push('', 'No findings.');
  else {
    lines.push('', '| Severity | Check | Where | Message | Fix |', '| --- | --- | --- | --- | --- |');
    for (const f of r.findings) lines.push(`| ${f.severity} | ${mdCell(f.id)} | ${mdCell(where(f))} | ${mdCell(f.message)} | ${mdCell(f.fix)} |`);
  }
  if (r.notes.length) lines.push('');
  for (const note of r.notes) lines.push(`- ${mdCell(note)}`);
  lines.push('', r.gate.pass ? `**Gate passed** (--fail-on ${r.gate.failOn}).` : `**Gate failed:** ${mdCell(r.gate.reason)}.`);
  return lines.join('\n') + '\n';
}

export function toJson(r) {
  return JSON.stringify(r, null, 2) + '\n';
}

// RFC 4180 quoting, and a leading quote on cells a spreadsheet would read as a formula.
export function csvCell(value) {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// One row per finding.
export function toCsv(r) {
  const rows = [['severity', 'id', 'file', 'line', 'subject', 'message', 'fix']];
  for (const f of r.findings) rows.push([f.severity, f.id, f.file, String(f.line), f.subject, f.message, f.fix]);
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
