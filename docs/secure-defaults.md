# Secure defaults

The default run is the safe run. Nothing below needs a flag, and none of it can be switched off.

## How the tool behaves by default

- **No network.** The tool reads the files it is given and sends nothing anywhere. It does not look up a color, a font or a page, does not follow an address from any file (a `$schema` address is only a string), and does not check for updates. An argument that looks like an address is refused. It can run in a locked-down job with no outbound access at all.
- **No commands.** The tool never runs a design tool, a package manager, a shell or any other program. No name, path or value from the input is ever put on a command line. A tokens file from an unknown source can be checked without running any of its code, which is not true of opening a design file or running a token build script.
- **No dependencies.** Node 22 or newer and nothing else, so a design check does not add a supply chain of its own. There is no `node_modules` to install before it runs.
- **Strict JSON.** The tokens file and the rules file are read by a small reader that accepts only JSON: no comments, no trailing commas, nesting no deeper than 64 levels. A key twice in one object is refused in the rules file and reported as `duplicate-name` in the tokens file. A key named `__proto__` is read as data.
- **Strict parsing, no guessing.** A tokens file that is not JSON, a rule that is not in the format, a color the tool does not read and a token with no type are refused with the file and the line, and reported as findings that fail the gate by default. A report that skipped something it did not understand is never written without saying so.
- **Reads only what is named.** The tool opens the tokens file (or `tokens.json` in the folder named) and the rules file. It does not follow a symbolic link for the default rules file, and does not look at the folders around.
- **Regular files only, bounded.** Each file is opened once, its type and size are taken from the open file, and anything that is not a regular file or is over 10 MB is refused before it is read.
- **Clean output.** Text from the input has control characters, line separators and direction controls removed and its length capped before it reaches a report or an error message, so a hostile token name cannot rewrite the terminal or reorder what a reader sees. Markdown cells escape pipes, backslashes, line breaks and `<`, `>` and `&`. CSV cells are quoted as RFC 4180 says, and a cell that a spreadsheet would read as a formula gets a leading `'`.
- **No prototype tricks.** JSON is read into lists and tokens are stored in a `Map`, so a key named `__proto__` or `constructor` is just data.
- **The gate is on.** Without any option, an error makes the run exit with `1`. A pipeline that adds the tool notices a broken alias, a color it cannot read and a pair below the WCAG ratio from the first run.
- **Writes nothing to disk.** The report goes to the screen. Redirect it to a file or the job summary only when you need to keep it.

## Running it safely on tokens you do not know

1. Run the check before anything else touches the tokens: before a token build script, before a package that transforms them. Each of those runs code; the check does not.
2. Run it as a user with read access to the files and nothing else. It needs no design tool, no account, no keys and no network.
3. Read the notes: they say when a rules file was not found, so no pair and no target was checked.
