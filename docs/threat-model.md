# Threat model

## What the tool touches

- It reads the tokens file named on the command line (or `tokens.json` in the folder named) and the rules file (`token-rules.json` next to the tokens file, or the file named with `--rules`). It does not follow a path or an address written inside a file, and it does not look at the folders around them.
- It writes only to the screen (standard output and standard error).
- It opens no network connection and runs no program: not a design tool, not a shell.

## What the input may hold

A tokens file is often checked in a pipeline that runs on pull requests, including pull requests from people outside the team, and a design system may come from an agency or a vendor. The tool treats both files as possibly hostile. A file can be huge, very deeply nested, or hold very many values. A tokens file can repeat a key, hold a key named `__proto__` or `constructor`, hold a very long alias chain, an alias cycle, or an alias that names itself. A token name can be made of control characters, direction characters, text meant to break a Markdown table or text that a spreadsheet reads as a formula. A color value can be a string made to slow a pattern down. The default rules file can be a symbolic link that points out of the folder, or a device or a pipe in place of a file.

## What could go wrong, and what stops it

| Risk | Control |
| --- | --- |
| A huge file, deeply nested JSON, or very many values exhaust memory or time | Files over 10 MB are refused from the size of the open file before they are read; JSON deeper than 64 levels, or with more than 200,000 values, is refused. The JSON reader recurses only as deep as its limit |
| A crafted color or dimension string makes a pattern run for a very long time | The patterns are short, anchored, and free of nested repetition; a value is matched whole, and a test runs a very long string |
| An alias chain is very long, or loops | Aliases are followed with a list of the paths already visited, so a loop ends at the first repeat; each token is resolved in a time bounded by the number of tokens. A cycle is reported, never followed again |
| A symbolic link leads to a file the user did not name | The default rules file is checked before it is opened, and a link there is refused. A file named on the command line is opened as given, because the person who runs the tool chose it |
| A device, a pipe or a folder in place of a file makes the tool hang or read without end | The type and size are taken from the open file, and anything that is not a regular file is refused |
| A key named `__proto__` or `constructor` changes how objects behave | JSON objects are read into lists of keys and values, and tokens are kept in a `Map`; tests check that no prototype changes |
| A token name rewrites the terminal through escape sequences, or reorders text with direction characters | Control characters (C0 and C1), line and paragraph separators and Unicode direction controls are replaced by a space before any text reaches a report or an error message, and the length is capped |
| A name breaks the Markdown table in the job summary, or hides text as an HTML tag | Pipes, backslashes, line breaks, `<`, `>` and `&` are escaped in every table cell |
| A CSV report runs a formula when opened in a spreadsheet | Cells that start with `=`, `+`, `-`, `@`, a tab or a carriage return get a leading `'`; every cell is quoted as RFC 4180 says |
| A file that is not understood is skipped, and a check passes without having run | A tokens file that is not JSON is a `tokens-invalid` error, a rule that cannot be read is an `invalid-rule` error, and a pair or a target that cannot be computed is an `unchecked-rule` error. Nothing is guessed |
| A color in another color space is converted wrongly, and a ratio is wrong | Only `srgb` is read; any other color space is refused with the reason |
| A unit is converted silently, and a too small target passes | A unit that does not belong on the platform is an error; the two conversions that are made (`px` read as the native unit, `rem` times the base) are shown in the report |
| The argument names a URL, so the tool becomes a fetcher | Arguments that look like addresses are refused, for the tokens file and for `--rules`; the tool has no code that opens a connection |

## Out of scope

What the app does with the tokens, the layouts built from them, the design tool the tokens were exported from, and whether the rules file lists everything. [limits.md](limits.md) lists what a check of the files cannot see.
