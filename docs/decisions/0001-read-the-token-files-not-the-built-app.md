# 1. Check the token files, with the pairs written down, instead of the built app

## Context

The tool needs to tell whether the colors and sizes of a mobile design system respect the accessibility rules before developers build from them. There are richer ways to know what a user sees: render the screens and measure the pixels, scan the built app with an accessibility scanner on a device, read the layouts in the code, or take the colors from the design tool through its own interface. Each of them needs the finished app, a device or an emulator, or an account and a token for a design tool, and the answer comes when the cost of a change is already high. The people who need the answer most often need it at handoff: when the tokens change in a pull request, in a pipeline on Linux, or in a review of a design system sent by an agency.

A tokens file does not say which text sits on which background, so there is nothing to compute until the pairs are written down. A contrast check that guesses the pairs from the names of tokens would be wrong in both directions.

## Decision

The tool reads the tokens as files, in the format of the W3C Design Tokens Community Group, and a small rules file that lists the pairs (per theme, with the text size and weight) and the touch target tokens (with their platform). The contrast is the WCAG 2.x formula, the thresholds are those of WCAG 2.2, Apple's Human Interface Guidelines and Android's accessibility guidance, and every number is saved from the official page and compared with the code by a test. The tool never runs a design tool or a program, never evaluates a script, and never fetches anything.

A value the tool cannot read with certainty is refused, not converted: a color in another color space, a unit from another platform, a token with no type. The report says what was refused and where.

## Consequences

The check runs in a second, on Windows, Linux or macOS, with only Node, no device, no account and no network access, and no input can make it run code or reach out to a host. The same files always give the same report, so it can run on every pull request and gate a release branch. The cost is that it sees what the tokens say, not what the screens show: a pair that is not in the rules file is not checked, text over an image is not seen, and the exceptions that WCAG allows for small web targets are for a person to decide. The tool says what it left out, lists its limits in docs/limits.md, and leaves the final answer to the people who know the design.
