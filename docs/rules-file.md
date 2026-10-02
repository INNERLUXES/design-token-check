# The rules file

The rules file is a small JSON file kept next to the tokens. It says what the tool compares: which text color sits on which background color in each theme, and which tokens are touch target sizes. By default the tool reads `token-rules.json` in the folder of the tokens file; `--rules <file>` names another one. It is plain JSON, with no comments, no trailing commas and no key twice in one object.

```json
{
  "remBase": 16,
  "pairs": [
    {
      "name": "Body text",
      "size": "font.size.body",
      "weight": "normal",
      "themes": {
        "light": { "foreground": "color.light.text.primary", "background": "color.light.surface.default" },
        "dark": { "foreground": "color.dark.text.primary", "background": "color.dark.surface.default" }
      }
    },
    {
      "name": "Input border",
      "kind": "ui",
      "themes": {
        "light": { "foreground": "color.light.border.input", "background": "color.light.surface.default" }
      }
    }
  ],
  "targets": [
    { "name": "Primary button", "token": "size.touch.ios.button", "platform": "ios" },
    { "name": "Icon button", "token": "size.touch.web.icon-button", "platform": "web" }
  ]
}
```

## Top level

| Key | Meaning |
| --- | --- |
| `remBase` | The size of 1 rem in px, a number above 0. Optional; the default is 16, the size the Design Tokens format names as the usual default font size |
| `pairs` | A list of text or non-text pairs, below |
| `targets` | A list of touch target tokens, below |

At least one of `pairs` and `targets` must be there. A key that is not in this table is a warning (`unknown-rule-key`) and is ignored.

## A pair

| Key | Meaning |
| --- | --- |
| `name` | A name for the report. Optional; the default is `pair 1`, `pair 2` and so on |
| `kind` | `"text"` (the default) or `"ui"`. A `ui` pair is a component that is not text: an icon, a border, a focus ring, a chart line. It needs 3:1 |
| `size` | The text size: a dimension such as `{ "value": 16, "unit": "pt" }`, or the path of a dimension token. Optional; without it the text is checked as small text. Only for `text` pairs |
| `weight` | The font weight: a number from 1 to 1000, or a name of the Design Tokens format (`normal`, `regular`, `medium`, `semi-bold`, `bold` and the others of its table). 700 and above is bold. Optional. Only for `text` pairs |
| `platform` | `ios`, `android` or `web`. Used only to read a `px` or `rem` text size: a point on `ios` and `android`, a CSS pixel on `web`. Optional; without it a pixel is a CSS pixel |
| `themes` | An object with one entry per theme. The names are yours (`light`, `dark`, `high-contrast`); they are compared exactly |

Each theme is an object with `foreground` and `background`, each the path of a color token: the groups and the token joined with periods, as in `color.light.text.primary`. For text the foreground is the text color; for a `ui` pair it is the icon, the border or the ring, and the background is what it sits on. A foreground token may have alpha, and is drawn over the background; a background must be opaque.

The tool checks every theme of every pair. A theme that some pairs list and another pair does not is reported as `theme-missing`, a warning, on the pair that lacks it.

## A target

| Key | Meaning |
| --- | --- |
| `token` | The path of a dimension token that holds a touch target size. Required |
| `platform` | `ios`, `android` or `web`. Required |
| `name` | A name for the report. Optional; the default is the token path |

The units a target may use are `pt` on `ios`, `dp` on `android` and `px` on `web`, and `px` or `rem` on any of them: [method.md](method.md) says how each is read and what is reported.

## When a rule is wrong

A pair or a target that is not in this format is reported as `invalid-rule`, with the line, and is left out; the other rules are still checked. A rules file that is not JSON is `rules-invalid`. A rules file named with `--rules` that does not exist is `rules-missing`. All of them are errors, so the gate fails and the problem is seen on the first run.
