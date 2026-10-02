// The numbers and names the checks rest on. Each one comes from an official page that is saved, with its
// address on the first line, in research/sources, and test/data.test.js compares this file with the saved text.
// Change a value here only after saving the new page text and updating docs/rules-and-sources.md.

export const SOURCES = [
  { id: 'wcag-contrast-minimum', file: 'wcag-contrast-minimum.txt', url: 'https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html' },
  { id: 'wcag-non-text-contrast', file: 'wcag-non-text-contrast.txt', url: 'https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html' },
  { id: 'wcag-target-size-minimum', file: 'wcag-target-size-minimum.txt', url: 'https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html' },
  { id: 'wcag-definitions', file: 'wcag-definitions.txt', url: 'https://www.w3.org/TR/WCAG22/#dfn-relative-luminance' },
  { id: 'apple-hig-accessibility', file: 'apple-hig-accessibility.txt', url: 'https://developer.apple.com/tutorials/data/design/human-interface-guidelines/accessibility.json' },
  { id: 'android-accessibility-apps', file: 'android-accessibility-apps.txt', url: 'https://developer.android.com/guide/topics/ui/accessibility/apps' },
  { id: 'dtcg-format', file: 'dtcg-format.txt', url: 'https://tr.designtokens.org/format/' },
  { id: 'dtcg-color', file: 'dtcg-color.txt', url: 'https://tr.designtokens.org/color/' }
];

// A folder given in place of the tokens file stands for tokens.json in it. The default rules file is looked for
// next to the tokens file when --rules is not given.
export const TOKENS_FILE = 'tokens.json';
export const RULES_FILE = 'token-rules.json';

// WCAG 2.2, the definitions of relative luminance and contrast ratio.
export const LUMINANCE_WEIGHTS = { r: 0.2126, g: 0.7152, b: 0.0722 };
export const SRGB = { linearLimit: 0.04045, linearDivisor: 12.92, offset: 0.055, scale: 1.055, exponent: 2.4 };
export const CONTRAST_OFFSET = 0.05;
export const CONTRAST_FORMULA = '(L1 + 0.05) / (L2 + 0.05)';

// WCAG 2.2 success criteria 1.4.3 (Contrast (Minimum)) and 1.4.11 (Non-text Contrast), both level AA.
export const CONTRAST = {
  text: { ratio: 4.5, criterion: '1.4.3 Contrast (Minimum)' },
  largeText: { ratio: 3, criterion: '1.4.3 Contrast (Minimum)' },
  nonText: { ratio: 3, criterion: '1.4.11 Non-text Contrast' }
};

// The definition of large-scale text, exactly as WCAG 2.2 gives it, and the sizes it names.
export const LARGE_TEXT_DEFINITION = 'with at least 18 point or 14 point bold or font size that would yield equivalent size for Chinese, Japanese and Korean (CJK) fonts';
export const LARGE_TEXT = { points: 18, boldPoints: 14 };

// WCAG: "The ratio between sizes in points and CSS pixels is 1pt = 1.333px", so a CSS pixel is 0.75 point.
export const POINTS_PER_CSS_PIXEL = 0.75;

// The Design Tokens format: 700 is "bold" in the font weight table.
export const BOLD_WEIGHT = 700;
export const FONT_WEIGHTS = {
  thin: 100, hairline: 100,
  'extra-light': 200, 'ultra-light': 200,
  light: 300,
  normal: 400, regular: 400, book: 400,
  medium: 500,
  'semi-bold': 600, 'demi-bold': 600,
  bold: 700,
  'extra-bold': 800, 'ultra-bold': 800,
  black: 900, heavy: 900,
  'extra-black': 950, 'ultra-black': 950
};

// Touch targets. Apple: 44x44 pt is the default control size on iOS and iPadOS, 28x28 pt the minimum control
// size. Android: at least 48dp x 48dp. WCAG 2.2 success criterion 2.5.8 (level AA): 24 by 24 CSS pixels.
export const TARGETS = {
  ios: { minimum: 44, unit: 'pt', severity: 'warning', source: 'Apple Human Interface Guidelines, Accessibility: default control size on iOS and iPadOS' },
  android: { minimum: 48, unit: 'dp', severity: 'warning', source: 'Android accessibility guidance: touch target of at least 48dp x 48dp' },
  web: { minimum: 24, unit: 'px', severity: 'error', source: 'WCAG 2.2 success criterion 2.5.8 Target Size (Minimum), level AA: 24 by 24 CSS pixels' }
};
export const APPLE_ABSOLUTE_MINIMUM = 28;
export const PLATFORMS = Object.keys(TARGETS);

// Units a dimension may carry, and the units that mean something on each platform. The Design Tokens format
// says a px is an idealized pixel whose equivalent is dp on Android and pt on iOS, so px is read as the native
// unit there; rem is multiplied by the rem base. Any other unit is a finding, never a silent conversion.
export const UNITS = ['px', 'pt', 'dp', 'sp', 'rem'];
export const DEFAULT_REM_BASE = 16;
export const PLATFORM_UNITS = {
  ios: { native: 'pt', accepted: ['pt', 'px', 'rem'] },
  android: { native: 'dp', accepted: ['dp', 'px', 'rem'] },
  web: { native: 'px', accepted: ['px', 'rem'] }
};

// The types of the Design Tokens format (the types and the composite types of the format page).
export const TOKEN_TYPES = ['color', 'dimension', 'fontFamily', 'fontWeight', 'duration', 'cubicBezier', 'number', 'strokeStyle', 'border', 'transition', 'shadow', 'gradient', 'typography'];

// Properties the format reserves: on a group, and on a token. Names that start with $ are not token names.
export const GROUP_PROPERTIES = ['$type', '$description', '$extensions', '$deprecated', '$extends', '$schema'];
export const TOKEN_PROPERTIES = ['$value', '$type', '$description', '$extensions', '$deprecated', '$ref'];
export const ROOT_TOKEN = '$root';
