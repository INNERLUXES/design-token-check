# design-token-check

Checks the design tokens of a mobile app design system before they are handed to developers. You give it the tokens file, in the format of the W3C Design Tokens Community Group (JSON with `$value` and `$type`, nested groups and `{alias.references}`), and a small rules file that says which text color sits on which background color in each theme, with the text size and weight, and which tokens are touch target sizes on which platform. It computes the WCAG 2.x contrast ratio of every pair, compares every touch target with the minimum of its platform, and checks the tokens file itself: aliases that lead nowhere or round in a circle, colors it cannot read, tokens with no type. Every finding names the token path, the file and the line.

A design system is checked by eye in a design tool, and then it is exported to files. The export is where a dark theme text color drifts below the contrast it needs, where a web icon button ends up at 20 px, and where one renamed token leaves an alias pointing at nothing. None of it breaks a build. It shows up later, in an accessibility audit or in a review of the finished screens. This tool compares the tokens with the rules in a second, so the check can run on every pull request that touches the tokens.

- Every finding has an id, a severity (error or warning), the token path, the file, the line, a plain message and a fix.
- The thresholds come from the official pages: WCAG 2.2 (contrast 4.5:1 for text, 3:1 for large text and for non-text components, 24 by 24 CSS pixels for a web target), Apple's Human Interface Guidelines (44 pt on iOS and iPadOS) and Android's accessibility guidance (48dp). They are kept in [src/data.js](src/data.js), and a test compares them with the saved text of the pages in [research/sources](research/sources). [docs/rules-and-sources.md](docs/rules-and-sources.md) shows each threshold with its source address.
- The contrast ratio is the WCAG formula, `(L1 + 0.05) / (L2 + 0.05)` with the relative luminance of the sRGB colors, shown with two decimals. WCAG says the computed value is compared with the threshold as it is, so a ratio of 4.4992 is shown as 4.50 and still fails, and the message says so.
- Units are never mixed silently. A touch target in a unit that does not belong on its platform is an error. A `px` on iOS or Android is read as `pt` or `dp`, as the Design Tokens format says, and a `rem` is multiplied by a documented base; both are shown in the report.
- The tokens file is read by a small, strict JSON reader that keeps the line of every value. Colors in `srgb` (the object of the Design Tokens Color Module), hex and `rgb()` are read; any other color space is refused, not converted.
- Reports as text, Markdown, JSON and CSV, with an exit code for a pipeline gate.
- It reads two files only. It runs no design tool, fetches nothing and opens no network connection.
- Plain JavaScript, no dependencies; the same files always give the same report.

```
npm test
```

```
ℹ tests 134
ℹ pass 133
ℹ fail 0
ℹ skipped 1
```

The skipped test makes a symbolic link, which Windows does not allow without a privilege; on Linux and macOS all 134 run.

## Quick start

Requires Node 22 or newer. There is nothing to install.

```
git clone https://github.com/INNERLUXES/design-token-check.git
cd design-token-check
node bin/design-token-check.js examples/tidewater-app
```

Or without a clone, in the folder of your tokens:

```
npx --yes github:INNERLUXES/design-token-check tokens.json
```

The tool reads the tokens file you name (a folder stands for the `tokens.json` in it) and the rules file `token-rules.json` next to it; `--rules <file>` names another one. [docs/rules-file.md](docs/rules-file.md) describes the rules format, and [docs/tokens-format.md](docs/tokens-format.md) says which parts of the Design Tokens format are read.

`examples/` holds the tokens of a made-up ferry timetable app, "Tidewater", with a light and a dark theme. `examples/tidewater-app` is wrong on purpose: the muted text color of the dark theme is below 4.5:1 on the dark surface when it is used for a small caption, and the icon button of the web app is 20 px wide. `examples/tidewater-app-fixed` is the same app with both corrected. `examples/broken-tokens` is a separate, smaller file with an alias cycle, an alias to a token that does not exist, a color that is not a color, a token with no type, a pair that names a missing token, and a pair that lists only one theme. `examples/output` holds the reports of the first project in every format; `npm run example` writes them again and fails if the README no longer shows what a real run prints.

## Usage

```
node bin/design-token-check.js examples/tidewater-app
```

```
design-token-check: examples/tidewater-app/tokens.json
tokens: 30 tokens (12 aliases), 19 groups
rules: examples/tidewater-app/token-rules.json, 6 pairs, 5 targets, rem base 16
themes: dark, light
contrast: 12 checked, 11 pass, 1 fail
  ok    light  Body text: color.light.text.primary on color.light.surface.default  16.69:1  needs 4.5:1
  ok    dark   Body text: color.dark.text.primary on color.dark.surface.default  16.30:1  needs 4.5:1
  ok    light  Secondary text: color.light.text.secondary on color.light.surface.default  7.58:1  needs 4.5:1
  ok    dark   Secondary text: color.dark.text.secondary on color.dark.surface.default  12.02:1  needs 4.5:1
  ok    light  Caption: color.light.text.muted on color.light.surface.default  4.76:1  needs 4.5:1
  FAIL  dark   Caption: color.dark.text.muted on color.dark.surface.default  3.75:1  needs 4.5:1
  ok    light  Section label: color.light.text.muted on color.light.surface.default  4.76:1  needs 3:1
  ok    dark   Section label: color.dark.text.muted on color.dark.surface.default  3.75:1  needs 3:1
  ok    light  Input border: color.light.border.input on color.light.surface.default  4.83:1  needs 3:1
  ok    dark   Input border: color.dark.border.input on color.dark.surface.default  3.75:1  needs 3:1
  ok    light  Focus ring: color.light.focus.ring on color.light.surface.default  5.17:1  needs 3:1
  ok    dark   Focus ring: color.dark.focus.ring on color.dark.surface.default  7.02:1  needs 3:1
touch targets: 5 checked
  ok    ios      Primary button: size.touch.ios.button  44 pt  needs 44 pt
  ok    ios      Tab bar item: size.touch.ios.tab  49 pt  needs 44 pt
  ok    android  Primary button: size.touch.android.button  48 dp  needs 48 dp
  FAIL  web      Icon button: size.touch.web.icon-button  20 px  needs 24 px
  ok    web      Link row: size.touch.web.link-row  2.5 rem (rem x 16 = 40 px)  needs 24 px
findings: 2 error, 0 warning

ERROR    low-contrast  examples/tidewater-app/token-rules.json:26  color.dark.text.muted
         Caption (dark): color.dark.text.muted (examples/tidewater-app/tokens.json:33, #64748b) on color.dark.surface.default (examples/tidewater-app/tokens.json:29, #0f172a) has a contrast ratio of 3.75:1; text needs at least 4.5:1 (WCAG 2.2 SC 1.4.3 Contrast (Minimum))
         fix: Change color.dark.text.muted or color.dark.surface.default until the ratio is at least 4.5:1

ERROR    small-target  examples/tidewater-app/tokens.json:57  size.touch.web.icon-button
         Icon button (web): size.touch.web.icon-button is 20 px, below the 24 px minimum (WCAG 2.2 success criterion 2.5.8 Target Size (Minimum), level AA: 24 by 24 CSS pixels)
         fix: Make size.touch.web.icon-button at least 24 px

GATE: FAIL - 2 errors
```

The exit code is `1`: a text pair below 4.5:1 and a web target below 24 px are errors, and errors fail the run by default. The dark "Section label" uses the same color at 20 pt, which is large text, so 3:1 is enough and it passes; the "Caption" uses it at 12 pt and needs 4.5:1. The link row of the web app is 2.5 rem, which the report shows as 40 px at the rem base of 16. The finding for a contrast pair is at the line of the theme in the rules file, with the tokens' own lines in the message; the finding for a target is at the token.

The fixed app passes, also with `--fail-on warning`:

```
node bin/design-token-check.js examples/tidewater-app-fixed --fail-on warning
```

```
design-token-check: examples/tidewater-app-fixed/tokens.json
tokens: 30 tokens (12 aliases), 19 groups
rules: examples/tidewater-app-fixed/token-rules.json, 6 pairs, 5 targets, rem base 16
themes: dark, light
contrast: 12 checked, 12 pass, 0 fail
  ok    light  Body text: color.light.text.primary on color.light.surface.default  16.69:1  needs 4.5:1
  ok    dark   Body text: color.dark.text.primary on color.dark.surface.default  16.30:1  needs 4.5:1
  ok    light  Secondary text: color.light.text.secondary on color.light.surface.default  7.58:1  needs 4.5:1
  ok    dark   Secondary text: color.dark.text.secondary on color.dark.surface.default  12.02:1  needs 4.5:1
  ok    light  Caption: color.light.text.muted on color.light.surface.default  4.76:1  needs 4.5:1
  ok    dark   Caption: color.dark.text.muted on color.dark.surface.default  6.96:1  needs 4.5:1
  ok    light  Section label: color.light.text.muted on color.light.surface.default  4.76:1  needs 3:1
  ok    dark   Section label: color.dark.text.muted on color.dark.surface.default  6.96:1  needs 3:1
  ok    light  Input border: color.light.border.input on color.light.surface.default  4.83:1  needs 3:1
  ok    dark   Input border: color.dark.border.input on color.dark.surface.default  3.75:1  needs 3:1
  ok    light  Focus ring: color.light.focus.ring on color.light.surface.default  5.17:1  needs 3:1
  ok    dark   Focus ring: color.dark.focus.ring on color.dark.surface.default  7.02:1  needs 3:1
touch targets: 5 checked
  ok    ios      Primary button: size.touch.ios.button  44 pt  needs 44 pt
  ok    ios      Tab bar item: size.touch.ios.tab  49 pt  needs 44 pt
  ok    android  Primary button: size.touch.android.button  48 dp  needs 48 dp
  ok    web      Icon button: size.touch.web.icon-button  32 px  needs 24 px
  ok    web      Link row: size.touch.web.link-row  2.5 rem (rem x 16 = 40 px)  needs 24 px
findings: 0 error, 0 warning

no findings

GATE: PASS (--fail-on warning)
```

The broken tokens show what the token file checks report:

```
node bin/design-token-check.js examples/broken-tokens
```

```
design-token-check: examples/broken-tokens/tokens.json
tokens: 8 tokens (5 aliases), 4 groups
rules: examples/broken-tokens/token-rules.json, 3 pairs, 1 target, rem base 16
themes: dark, light
contrast: 0 checked, 0 pass, 0 fail
touch targets: 0 checked
findings: 12 error, 1 warning

ERROR    missing-type  examples/broken-tokens/tokens.json:16  size.touch.button
         size.touch.button has no $type and no group above it sets one, so its type cannot be known and the format calls it invalid
         fix: Add "$type" to the token, or to the group that holds it

ERROR    invalid-color  examples/broken-tokens/tokens.json:12  color.border
         color.border (examples/broken-tokens/tokens.json:12) is not a color the tool reads: "#12345" is not a hex color (#rgb, #rrggbb, #rrggbbaa) or an rgb() color with channels from 0 to 255
         fix: Write the color as { "colorSpace": "srgb", "components": [0, 0.4, 0.8] }, as "#0066cc" or as "rgb(0, 102, 204)"

ERROR    unresolved-alias  examples/broken-tokens/tokens.json:11  color.accent
         color.accent is an alias of color.brand: no token has the path color.brand
         fix: Write the path of an existing token, groups and token joined with periods

ERROR    alias-cycle  examples/broken-tokens/tokens.json:7  color.text.primary
         color.text.primary is part of an alias cycle (color.text.primary -> color.text.body -> color.text.default -> color.text.primary), so none of the tokens in it has a value
         fix: Make one token in the cycle hold a value of its own

ERROR    alias-cycle  examples/broken-tokens/tokens.json:8  color.text.body
         color.text.body is part of an alias cycle (color.text.body -> color.text.default -> color.text.primary -> color.text.body), so none of the tokens in it has a value
         fix: Make one token in the cycle hold a value of its own

ERROR    alias-cycle  examples/broken-tokens/tokens.json:9  color.text.default
         color.text.default is part of an alias cycle (color.text.default -> color.text.primary -> color.text.body -> color.text.default), so none of the tokens in it has a value
         fix: Make one token in the cycle hold a value of its own

ERROR    missing-token  examples/broken-tokens/token-rules.json:21  color.text.hint
         Hint text (light) names color.text.hint: no token has that path
         fix: Write the path of a token of the tokens file, groups and token joined with periods

ERROR    unchecked-rule  examples/broken-tokens/token-rules.json:7  color.text.primary
         Body text (light) was not checked: color.text.primary (examples/broken-tokens/tokens.json:7) leads to no value because of an alias problem, reported in the same run
         fix: Fix the alias, then run the check again

ERROR    unchecked-rule  examples/broken-tokens/token-rules.json:8  color.text.primary
         Body text (dark) was not checked: color.text.primary (examples/broken-tokens/tokens.json:7) leads to no value because of an alias problem, reported in the same run
         fix: Fix the alias, then run the check again

ERROR    unchecked-rule  examples/broken-tokens/token-rules.json:15  color.accent
         Link text (light) was not checked: color.accent (examples/broken-tokens/tokens.json:11) leads to no value because of an alias problem, reported in the same run
         fix: Fix the alias, then run the check again

ERROR    unchecked-rule  examples/broken-tokens/token-rules.json:22  color.border
         Hint text (dark) was not checked: color.border (examples/broken-tokens/tokens.json:12) is not a color the tool reads, reported in the same run
         fix: Fix the color, then run the check again

ERROR    unchecked-rule  examples/broken-tokens/token-rules.json:27  size.touch.button
         Primary button (ios) was not checked: size.touch.button (examples/broken-tokens/tokens.json:16) has no type
         fix: Give the token a $type, then run the check again

WARNING  theme-missing  examples/broken-tokens/token-rules.json:11  Link text
         Link text has no "dark" theme, which "Body text", "Hint text" list; that theme's colors are not checked for it
         fix: Add the "dark" theme to the pair with its foreground and background tokens

GATE: FAIL - 12 errors
```

An alias cycle is reported for every token in it, with the chain. A pair that names a token with no usable value is reported as `unchecked-rule`, never skipped without a word.

```
design-token-check <tokens-file-or-folder> [options]
```

```
--rules <file>     the rules file (default: token-rules.json in the folder of the tokens file)
--format <name>    text, markdown, json or csv (default: text)
--fail-on <level>  exit with 1 when a finding is at this level or above: error or warning
                   (default: error)
--help             show the usage
--version          show the version
```

Paths in the report are relative to the folder you run the command in, with forward slashes on every system; a file outside it is shown with its absolute path. Token paths are the names of the groups and the token joined with periods, and are compared exactly, letter case included.

## Checks

| Id | Severity | What it reports |
| --- | --- | --- |
| `low-contrast` | error | A pair below 4.5:1 for text, below 3:1 for large text, or below 3:1 for a non-text component (an icon, a border, a focus ring) |
| `small-target` | warning, error on web | A touch target below 44 pt on `ios`, below 48 dp on `android` (warnings), or below 24 CSS px on `web` (an error) |
| `unit-mismatch` | error | A touch target in a unit that is not used on its platform, such as `pt` on Android |
| `tokens-invalid` | error | The tokens file is not JSON, or not an object; the line is shown |
| `invalid-token` | error | A token that is also a group, a value that is neither, a `$type` or `$ref` that is not a string |
| `invalid-name` | error | A name with `{`, `}` or a period in it, or one that starts with `$` (except `$root`) |
| `duplicate-name` | error | The same name twice in one group, so one token is lost |
| `missing-type` | error | A token with no `$type` of its own, none from the token it is an alias of and none from a group |
| `invalid-color` | error | A color token whose value is not a color the tool reads |
| `invalid-dimension` | error | A dimension token whose value is not a number with a unit |
| `unresolved-alias` | error | An alias or `$ref` that names no token, or names a group |
| `alias-cycle` | error | Aliases that lead back to themselves; every token in the cycle is reported |
| `alias-type-mismatch` | error | A token with a `$type` that differs from the type of the token it is an alias of |
| `missing-token` | error | A pair or a target names a token that the tokens file does not have |
| `wrong-token-type` | error | A pair names a token that is not a color, or a target one that is not a dimension |
| `unchecked-rule` | error | A pair or a target that could not be checked, because a token it names has no usable value |
| `translucent-background` | error | The background of a pair has an alpha below 1, so the ratio would depend on what lies behind it |
| `rules-missing` | error | The rules file named with `--rules` does not exist, or is not a regular file |
| `rules-invalid` | error | The rules file is not JSON; the line is shown |
| `invalid-rule` | error | A pair, a target or a key of the rules file that is not in the documented format; the rule is left out |
| `theme-missing` | warning | A theme that some pairs list and this pair does not |
| `case-collision` | warning | Two token names that differ only in letter case |
| `unknown-type` | warning | A `$type` that the Design Tokens format does not have |
| `unsupported-extends` | warning | A group with `$extends`, which the tool does not follow |
| `unknown-rule-key` | warning | A key of the rules file that the format does not have; it is ignored |

[docs/method.md](docs/method.md) gives each check, its exact rule and why it matters, and how the files are read.

## Thresholds

| Rule | Value | Source |
| --- | --- | --- |
| Text contrast | at least 4.5:1 | WCAG 2.2 success criterion 1.4.3 Contrast (Minimum), level AA: https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html |
| Large text contrast | at least 3:1 | the same criterion; large text is "with at least 18 point or 14 point bold or font size that would yield equivalent size for Chinese, Japanese and Korean (CJK) fonts" |
| Non-text contrast | at least 3:1 against adjacent colors | WCAG 2.2 success criterion 1.4.11 Non-text Contrast, level AA: https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html |
| Luminance and ratio | the WCAG definitions | https://www.w3.org/TR/WCAG22/#dfn-relative-luminance |
| iOS and iPadOS target | 44 pt (a warning) | Apple Human Interface Guidelines, Accessibility, default control size: https://developer.apple.com/tutorials/data/design/human-interface-guidelines/accessibility.json |
| Android target | 48 dp (a warning) | https://developer.android.com/guide/topics/ui/accessibility/apps |
| Web target | 24 by 24 CSS px (an error) | WCAG 2.2 success criterion 2.5.8 Target Size (Minimum), level AA: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html |
| Token format | `$value`, `$type`, groups, aliases, dimensions | https://tr.designtokens.org/format/ |

Apple's page gives 44x44 pt as the default control size on iOS and iPadOS and 28x28 pt as the minimum control size. The tool warns below the default, and says in the message when a size is below 28 pt as well. WCAG 2.5.8 has exceptions (spacing between small targets, an equivalent control, an inline link, a control the browser draws, an essential size) that a token cannot show, so a web target below 24 px is an error until you decide that an exception applies and say so in your own review. [docs/rules-and-sources.md](docs/rules-and-sources.md) has the details and the differences between the pages.

## Formats

- `text`: for a terminal: the files read, every pair with its ratio, every target with its size, the counts, then the findings, errors first, each with its check id, file, line and token path, message and fix.
- `markdown`: the same for a pull request comment or the job summary. Pipes, line breaks and angle brackets from the input are escaped, so a token name cannot break a table.
- `json`: the whole report: the files, the counts of tokens, every pair with its two colors, its ratio, the ratio it needs and the result, every target with its value, unit and conversion, every finding with id, severity, file, line, subject, message and fix, the notes and the gate.
- `csv`: one row per finding, quoted as RFC 4180 says. A cell that starts with `=`, `+`, `-` or `@` gets a leading `'`, so a spreadsheet does not run it as a formula.

To put the report in the job summary of a GitHub Actions run:

```yaml
permissions:
  contents: read
steps:
  - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
  - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
    with:
      node-version: 22
  - name: Design token report
    run: npx --yes github:INNERLUXES/design-token-check design/tokens.json --format markdown >> "$GITHUB_STEP_SUMMARY"
  - name: Design token gate
    run: npx --yes github:INNERLUXES/design-token-check design/tokens.json --fail-on error
```

It needs no design tool and no secrets; a Linux runner is enough.

## Exit codes

`0` no finding at the `--fail-on` level, `1` at least one such finding (by default: an error), `2` a usage or input error (a missing tokens file, a missing option, an unknown format).

A missing or unusable rules file named with `--rules` is not exit code `2`: it is a finding (`rules-missing`, `rules-invalid`), so the run still checks the tokens file and the gate fails. A tokens file that is not JSON is a finding too (`tokens-invalid`). Without `--rules` and without a `token-rules.json` next to the tokens file, only the token file checks run, and a note says that no pair and no target was checked.

## Limits

The tool reads what the tokens say, not what the screens show. A contrast pair is only as good as the rules file that lists it: a text color that is not listed is not checked, and so is a color drawn over an image or a gradient. The tool does not read `$extends`, composite tokens or color spaces other than `srgb`, it cannot see the spacing exceptions of WCAG 2.5.8, and it takes the weight 700 as bold. [docs/limits.md](docs/limits.md) lists these, with the size limits.

## Background

- How mobile apps are designed, specified and handed to developers, with checks like this one in the pipeline: [mobile app design services](https://innerluxes.dev/application/mobile/design).

## License

MIT
