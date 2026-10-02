# Contributing

Every change goes through a pull request and is reviewed before it is merged. The pipeline runs the tests on Linux, Windows and macOS, the repository checks, CodeQL, and a secure development check of the repository itself.

Commit messages in this repository follow Conventional Commits: `feat:`, `fix:`, `docs:`, `test:`, `ci:`, with `!` for a breaking change.

## Changing a check

1. Describe the change in docs/method.md first: what the check reports, its severity, and why it matters, with the page of the official documentation it follows. Where the tool makes its own choice (how a pixel is read on each platform, what counts as bold, what is a warning and what is an error), say so and say why.
2. Add a test with the tokens and the rules written inline, small enough that the result can be worked out by hand. Use made-up token names and app names.
3. Text from the input goes through `safeText` before it reaches a finding or a note, so control characters are removed.
4. A finding id, once released, keeps its meaning: pipelines and other tools read it from the JSON and CSV reports.

## Changing the thresholds

The numbers in `src/data.js` come from the pages saved in `research/sources`: WCAG 2.2 for the contrast ratios, the large-text definition and the web target size, Apple's Human Interface Guidelines for the iOS target size, Android's accessibility guidance for the Android target size, and the Design Tokens format for the types, the units and the font weights. When a page changes, save the new text in `research/sources` (the address on the first line), change `src/data.js` to match, and update docs/rules-and-sources.md. `test/data.test.js` compares the numbers with the saved text, so changing one without the other fails.

Never add a threshold, a unit rule or a type from memory or from a blog post. A new rule needs the official page, opened and saved, and the words of the page that give the number.

## Changing the readers

1. For the JSON, color, dimension, token and rules readers, add a test for every form you add and one that must be refused. Keep refusing a color in a color space the tool does not convert, and keep refusing JSON that is not JSON.
2. Keep the size, depth and value limits, and keep a limit on the length of a string before a pattern runs on it.
3. Paths are opened with `path.resolve`, never `path.join`, so an absolute path works on every system. Paths shown in a report are relative, with forward slashes. Token paths and file names are compared exactly, letter case included, on every system. Do not assume that a backslash is a separator on Linux or macOS.

## Rules for the code

- No runtime dependencies. Node 22 or newer and nothing else.
- The tool reads the two files it is given and writes only to the screen. It opens no network connection, runs no program, and never follows a URL, a symbolic link or a path from an input.
- Source files stay ASCII; write any other character in a pattern as a Unicode escape.
- Never commit real design tokens, even as a fixture. Write small made-up files, and never put a real key or token into one, even an expired one.

## Before you open the pull request

```
npm test
npm run check
npm run example
```
