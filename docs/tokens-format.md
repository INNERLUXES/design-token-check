# The tokens file

The tool reads the format of the W3C Design Tokens Community Group: https://tr.designtokens.org/format/ and, for colors, https://tr.designtokens.org/color/ (both saved in [research/sources](../research/sources)). This page says which parts it reads and what it does with the rest.

## Tokens and groups

An object with a `$value` (or a `$ref`) is a token. Any other object is a group. A group holds tokens and other groups, and may carry `$type`, `$description`, `$extensions` and `$deprecated`. The path of a token is the names of its groups and its own name joined with periods: in `{ "color": { "text": { "primary": { "$value": "#000000" } } } }` the token is `color.text.primary`. A group named `$root` inside another group is a token whose path ends in `.$root`.

The format forbids `{`, `}` and `.` in a name, and reserves every name that starts with `$`. The tool reports both (`invalid-name`). It reports a token that also holds child groups, a value that is neither a token nor a group (`invalid-token`), and a name written twice in one group (`duplicate-name`).

Properties that start with `$` and are not in the format are ignored, so a file written for a later version of the format is not refused for them. `$schema` is accepted.

## Types

A token has a type from its own `$type`, else from the token it is an alias of, else from the closest group with a `$type` (the root object counts). A token with no type is invalid in the format, and the tool says so (`missing-type`) rather than guess one from the value. The types the format lists are `color`, `dimension`, `fontFamily`, `fontWeight`, `duration`, `cubicBezier`, `number`, and the composite types `strokeStyle`, `border`, `transition`, `shadow`, `gradient` and `typography`. Another name is a warning (`unknown-type`). Only `color` and `dimension` tokens are read for their value; the others are kept as they are, and a `$ref` or `{alias}` to them still resolves.

## Aliases

An alias is a `$value` that is exactly a path in braces, `"{color.palette.white}"`, or a token with `"$ref": "#/color/palette/white"` (a JSON Pointer from the root; `~1` and `~0` are read). It names a whole token, never a group or a property inside a value. Aliases are followed through other aliases until a token holds a value. An alias to a path that is not a token is `unresolved-alias`; a loop is `alias-cycle`, reported for every token in it. Alias references inside a value (for example in one component of a color) are not followed: such a color is refused as `invalid-color`.

## Colors

The accepted forms:

- the object of the Design Tokens Color Module in the `srgb` color space: `{ "colorSpace": "srgb", "components": [0, 0.4, 0.8], "alpha": 1, "hex": "#0066cc" }`. The three components are numbers from 0 to 1, or the keyword `none` (read as 0); `alpha` is optional and is 1 when it is left out. The `hex` fallback is not used: the components decide;
- a hex string: `#rgb`, `#rgba`, `#rrggbb` or `#rrggbbaa`, which older drafts of the format used;
- an `rgb()` or `rgba()` string with channels from 0 to 255 (or percentages), written with commas or spaces, and an optional alpha after a comma or a slash.

Every other color space of the Color Module (`srgb-linear`, `hsl`, `hwb`, `lab`, `lch`, `oklab`, `oklch`, `display-p3` and the rest) is refused with the reason, not converted: a conversion would change the numbers that the ratio rests on, and the tool would be guessing which one you meant. Write the color in `srgb`, or give the pair a color that is.

## Dimensions

The accepted forms: the object `{ "value": 16, "unit": "px" }` of the format, and the string `"16px"` of older drafts. The format names two units, `px` and `rem`; the tool also accepts `pt`, `dp` and `sp`, because platforms write their sizes that way. The unit is required, also for 0. How each unit is read for a touch target or for a text size is in [method.md](method.md).

## Not read

- `$extends` (a group that inherits from another) is reported as a warning (`unsupported-extends`); the inherited tokens are not part of the check, and a pair that names one is `missing-token`.
- Composite tokens (shadow, border, typography and the rest) are not read inside; their `$type` is checked against the format's names only.
- `$extensions` and `$deprecated` are ignored.
- Themes are a convention of your files, not a feature of the format. The tool does not look for a mode or a theme in the tokens: the rules file says which token is the foreground and the background of which theme.
