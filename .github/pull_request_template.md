## What changes

<!-- One or two sentences. -->

## Checks

- [ ] `npm test`, `npm run check` and `npm run example` pass, and the files under `examples/output` are the ones `npm run example` wrote
- [ ] A change to a check, a threshold or a reader is described in docs/method.md, and has a test with the tokens and the rules written inline, and a near miss that must not match
- [ ] A change to a threshold, a formula or a unit rule follows the official pages: the new page text is saved in research/sources, `src/data.js` and docs/rules-and-sources.md match it, and nothing was added from memory
- [ ] Text from the input goes through `safeText`, and the tool still fetches nothing, opens no connection, runs no program and follows no symbolic link it was not given
- [ ] Paths are opened with `path.resolve`, shown relative with forward slashes, and token paths and file names are compared exactly, so the result is the same on Linux, macOS and Windows
- [ ] No real design tokens, no real product names and no real key or token in fixtures or examples
- [ ] The commit messages of this pull request follow Conventional Commits
