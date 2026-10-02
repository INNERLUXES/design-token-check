# Changes

## 1.0.0

First release.

- Checks the design tokens of a mobile app design system, in the format of the W3C Design Tokens Community Group, against accessibility and platform rules. Reads two files only: the tokens file and a small rules file; never runs a design tool or a program and never fetches anything.
- Computes the WCAG 2.x contrast ratio of every text and background pair listed in the rules file, per theme: below 4.5:1 for text, below 3:1 for large text (18 point, or 14 point bold) and below 3:1 for non-text components is an error. The ratio is shown with two decimals and compared without rounding.
- Compares the touch target tokens with the minimum of their platform: below 44 pt on iOS and iPadOS and below 48 dp on Android are warnings, below 24 CSS px on the web is an error. A unit that does not belong on the platform is an error; a px read as the native unit and a rem times the base are shown in the report.
- Reads color tokens in srgb (the object of the Design Tokens Color Module), hex and rgb(); dimension tokens in px, pt, dp, sp and rem; aliases written as `{path}` and as `$ref` JSON Pointers, with cycle detection.
- Reports unresolved aliases, alias cycles, invalid colors and dimensions, tokens with no type, duplicate and invalid names, pairs and targets that name a missing token, and themes that some pairs list and others do not.
- The thresholds and formulas come from the official pages, which are saved in `research/sources`; a test compares `src/data.js` with the saved text.
- Every finding has an id, a severity (error, warning), the token path, the file and line, a message and a fix.
- Reports as text, Markdown, JSON and CSV; `--fail-on` for a pipeline gate; exit code `2` for a usage or input error.
- Safe input: only the two files are read, files over 10 MB are refused, JSON nested more than 64 deep is refused, long strings are refused before a pattern runs on them, alias chains are resolved once per token, and control characters are removed from every text shown.
- Release packages come with a CycloneDX SBOM, SHA-256 checksums and a build provenance attestation.
