import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { APPLE_ABSOLUTE_MINIMUM, BOLD_WEIGHT, CONTRAST, CONTRAST_FORMULA, CONTRAST_OFFSET, DEFAULT_REM_BASE, FONT_WEIGHTS, LARGE_TEXT, LARGE_TEXT_DEFINITION, LUMINANCE_WEIGHTS, POINTS_PER_CSS_PIXEL, SOURCES, SRGB, TARGETS, TOKEN_TYPES } from '../src/index.js';

const source = async (id) => {
  const entry = SOURCES.find((s) => s.id === id);
  return readFile(new URL(`../research/sources/${entry.file}`, import.meta.url), 'utf8');
};
// Text compared without line breaks, runs of white space or the typographic apostrophe.
const flat = (t) => t.replace(/\u2019/g, "'").replace(/\s+/g, ' ').toLowerCase();
const has = (text, needle) => flat(text).includes(flat(needle));

test('sources: every saved page has its address on the first line, as listed in src/data.js', async () => {
  for (const s of SOURCES) {
    const text = await source(s.id);
    assert.equal(text.split('\n')[0], `Source: ${s.url}`, s.file);
    assert.ok(text.length > 1000, `${s.file} holds the page text`);
  }
  assert.equal(SOURCES.length, new Set(SOURCES.map((s) => s.url)).size);
});

test('sources: the seven pages named for the check are all saved', () => {
  const urls = SOURCES.map((s) => s.url);
  for (const url of [
    'https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html',
    'https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html',
    'https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html',
    'https://www.w3.org/TR/WCAG22/#dfn-relative-luminance',
    'https://developer.apple.com/tutorials/data/design/human-interface-guidelines/accessibility.json',
    'https://developer.android.com/guide/topics/ui/accessibility/apps',
    'https://tr.designtokens.org/format/'
  ]) assert.ok(urls.includes(url), url);
});

test('contrast thresholds: 4.5:1 for text and 3:1 for large text are those of success criterion 1.4.3', async () => {
  const page = await source('wcag-contrast-minimum');
  assert.ok(has(page, 'The visual presentation of text and images of text has a contrast ratio of at least 4.5:1'));
  assert.ok(has(page, 'Large-scale text and images of large-scale text have a contrast ratio of at least 3:1'));
  assert.equal(CONTRAST.text.ratio, 4.5);
  assert.equal(CONTRAST.largeText.ratio, 3);
  assert.ok(has(page, 'Contrast (Minimum) (Level AA)'));
});

test('contrast thresholds: 3:1 for non-text components is that of success criterion 1.4.11', async () => {
  const page = await source('wcag-non-text-contrast');
  assert.ok(has(page, 'have a contrast ratio of at least 3:1 against adjacent color(s)'));
  assert.ok(has(page, 'Non-text Contrast (Level AA)'));
  assert.equal(CONTRAST.nonText.ratio, 3);
});

test('contrast thresholds: WCAG compares the computed value without rounding', async () => {
  const text = await source('wcag-contrast-minimum');
  const nonText = await source('wcag-non-text-contrast');
  assert.ok(has(text, 'the computed values should not be rounded (e.g., 4.499:1 would not meet the 4.5:1 threshold)'));
  assert.ok(has(nonText, 'the computed values should not be rounded (e.g. 2.999:1 would not meet the 3:1 threshold)'));
});

test('large text: the definition is exactly W3C\'s, and the sizes are 18 point and 14 point bold', async () => {
  const definitions = await source('wcag-definitions');
  assert.ok(has(definitions, `large scale (text) ${LARGE_TEXT_DEFINITION}`));
  assert.ok(has(await source('wcag-contrast-minimum'), LARGE_TEXT_DEFINITION));
  assert.equal(LARGE_TEXT.points, 18);
  assert.equal(LARGE_TEXT.boldPoints, 14);
  assert.ok(has(definitions, 'with at least 18 point or 14 point bold'));
});

test('large text: a CSS pixel is 0.75 point, as the page says 1pt = 1.333px', async () => {
  const page = await source('wcag-contrast-minimum');
  assert.ok(has(page, '1pt = 1.333px'));
  assert.ok(Math.abs(POINTS_PER_CSS_PIXEL - 1 / 1.333) < 0.001);
});

test('formula: the relative luminance weights and the sRGB constants are those of the WCAG definition', async () => {
  const definitions = await source('wcag-definitions');
  assert.ok(has(definitions, 'L = 0.2126 * R + 0.7152 * G + 0.0722 * B'));
  assert.deepEqual(LUMINANCE_WEIGHTS, { r: 0.2126, g: 0.7152, b: 0.0722 });
  assert.ok(has(definitions, 'if RsRGB <= 0.04045 then R = RsRGB/12.92 else R = ((RsRGB+0.055)/1.055) ^ 2.4'));
  assert.deepEqual(SRGB, { linearLimit: 0.04045, linearDivisor: 12.92, offset: 0.055, scale: 1.055, exponent: 2.4 });
  assert.ok(has(definitions, 'RsRGB = R8bit/255'));
});

test('formula: the contrast ratio is (L1 + 0.05) / (L2 + 0.05) with L1 the lighter, from 1 to 21', async () => {
  const definitions = await source('wcag-definitions');
  assert.ok(has(definitions, CONTRAST_FORMULA));
  assert.equal(CONTRAST_OFFSET, 0.05);
  assert.ok(has(definitions, 'L1 is the relative luminance of the lighter of the colors'));
  assert.ok(has(definitions, 'Contrast ratios can range from 1 to 21'));
});

test('touch targets: 44 pt on iOS and iPadOS is the default control size on Apple\'s page, 28 pt the minimum', async () => {
  const page = await source('apple-hig-accessibility');
  assert.ok(page.includes('Platform | Default control size | Minimum control size'));
  assert.ok(page.includes('iOS, iPadOS | 44x44 pt | 28x28 pt'));
  assert.equal(TARGETS.ios.minimum, 44);
  assert.equal(TARGETS.ios.unit, 'pt');
  assert.equal(APPLE_ABSOLUTE_MINIMUM, 28);
  assert.equal(TARGETS.ios.severity, 'warning');
});

test('touch targets: 48dp on Android is the size on the Android page', async () => {
  const page = await source('android-accessibility-apps');
  assert.ok(has(page, 'touch target size, of at least 48dpx48dp'));
  assert.equal(TARGETS.android.minimum, 48);
  assert.equal(TARGETS.android.unit, 'dp');
  assert.equal(TARGETS.android.severity, 'warning');
});

test('touch targets: 24 CSS pixels on the web is success criterion 2.5.8 at level AA, and an error', async () => {
  const page = await source('wcag-target-size-minimum');
  assert.ok(has(page, 'The size of the target for pointer inputs is at least 24 by 24 CSS pixels'));
  assert.ok(has(page, 'Target Size (Minimum) (Level AA)'));
  assert.equal(TARGETS.web.minimum, 24);
  assert.equal(TARGETS.web.unit, 'px');
  assert.equal(TARGETS.web.severity, 'error');
});

test('Android page: text under 18sp, or bold under 14sp, needs 4.5:1, which is the large text rule', async () => {
  const page = await source('android-accessibility-apps');
  assert.ok(has(page, 'If the text is smaller than 18sp, or if the text is bold and smaller than 14sp'));
  assert.ok(has(page, 'at least 4.5:1'));
  assert.ok(has(page, 'For all other text, set the color contrast ratio to at least 3:1'));
});

test('Apple page: its contrast table gives 4.5:1 up to 17 pts, and 3:1 at 18 pts and for bold text', async () => {
  const page = await source('apple-hig-accessibility');
  assert.ok(page.includes('Up to 17 pts | All | 4.5:1'));
  assert.ok(page.includes('18 pts | All | 3:1'));
  assert.ok(page.includes('All | Bold | 3:1'));
});

test('Design Tokens format: the type names are those of the saved format page', async () => {
  const page = await source('dtcg-format');
  for (const type of TOKEN_TYPES) assert.ok(page.includes(`"$type": "${type}"`), type);
  assert.equal(TOKEN_TYPES.length, 13);
});

test('Design Tokens format: dimension units, the px equivalents and the usual rem base', async () => {
  const page = await source('dtcg-format');
  assert.ok(has(page, 'The equivalent in Android is dp and iOS is pt'));
  assert.ok(has(page, 'Supported values: "px", "rem"'));
  assert.ok(has(page, 'assuming a default font size (usually 16px)'));
  assert.equal(DEFAULT_REM_BASE, 16);
});

test('Design Tokens format: the font weight names and numbers are those of the format page, and 700 is bold', async () => {
  const page = await source('dtcg-format');
  const lines = page.split('\n');
  const table = {};
  for (let i = 0; i < lines.length - 1; i += 1) {
    const number = /^(\d+) \|\s*$/.exec(lines[i]);
    const names = /^([a-z, -]+) \|\s*$/.exec(lines[i + 1]);
    if (number && names) for (const name of names[1].split(',')) table[name.trim()] = Number(number[1]);
  }
  assert.deepEqual(FONT_WEIGHTS, table);
  assert.equal(FONT_WEIGHTS.bold, BOLD_WEIGHT);
});

test('Design Tokens format: a token without a type that none of its parents sets is invalid, and alias cycles are errors', async () => {
  const page = await source('dtcg-format');
  assert.ok(has(page, 'the token\'s type cannot be determined and the token MUST be considered invalid'));
  assert.ok(has(page, 'Tools MUST detect and report this as an error affecting all tokens in the circular chain'));
});

test('Design Tokens color module: an srgb color has three components from 0 to 1 and an optional alpha', async () => {
  const page = await source('dtcg-color');
  assert.ok(has(page, 'Red: A number between 0 and 1 representing the red component of the color'));
  assert.ok(has(page, 'alpha (optional): A number that represents the alpha value of the color'));
  assert.ok(has(page, 'If omitted, the alpha value of the color MUST be assumed to be 1'));
});
