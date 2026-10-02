# Security

## Reporting a problem

Write to info@innerluxes.dev with the subject line "design-token-check security", or use private vulnerability reporting on this repository. Please do not open a public issue for a vulnerability.

Include a small made-up tokens file, rules file or folder layout that shows the problem, what you expected and what happened. Use made-up token names and app names, and no real keys, internal addresses or customer files.

## Scope

In scope:

- an input that makes the tool open a network connection or run a program
- an input that makes the tool read a file other than the tokens file and the rules file it was given, through a symbolic link or a path or an address written in a file
- a tokens file or a rules file that makes the JSON reader accept something JSON does not allow, or follow a path
- an input that makes the tool hang, take very long, or use unbounded memory or stack, such as deep nesting, very many values, a very long string or alias chain, or a path that is not a regular file
- text from a token name, a pair name or a theme name that breaks a Markdown table, injects a formula into a CSV report, or rewrites the terminal through control or direction characters
- a key name that changes how objects behave inside the tool
- a contrast ratio or a size that docs/method.md says is computed one way and the tool computes another way, for an input the tool accepts
- a finding that docs/method.md says is reported, for an input the tool accepts, that the report leaves out

Out of scope: how the app uses the tokens, whether the rules file lists every pair, the exceptions that WCAG allows (docs/limits.md lists what a check of the files cannot see), and the accessibility guidance of the platform vendors themselves.

Read [docs/threat-model.md](docs/threat-model.md) for the rest.
