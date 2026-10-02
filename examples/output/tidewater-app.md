## design-token-check: 2 error, 0 warning

Tokens: `examples/tidewater-app/tokens.json`, 30 tokens (12 aliases), 19 groups. Rules: examples/tidewater-app/token-rules.json, 6 pairs, 5 targets, rem base 16.

| Result | Theme | Pair | Foreground | Background | Ratio | Needs |
| --- | --- | --- | --- | --- | --- | --- |
| pass | light | Body text | color.light.text.primary | color.light.surface.default | 16.69:1 | 4.5:1 |
| pass | dark | Body text | color.dark.text.primary | color.dark.surface.default | 16.30:1 | 4.5:1 |
| pass | light | Secondary text | color.light.text.secondary | color.light.surface.default | 7.58:1 | 4.5:1 |
| pass | dark | Secondary text | color.dark.text.secondary | color.dark.surface.default | 12.02:1 | 4.5:1 |
| pass | light | Caption | color.light.text.muted | color.light.surface.default | 4.76:1 | 4.5:1 |
| **fail** | dark | Caption | color.dark.text.muted | color.dark.surface.default | 3.75:1 | 4.5:1 |
| pass | light | Section label | color.light.text.muted | color.light.surface.default | 4.76:1 | 3:1 |
| pass | dark | Section label | color.dark.text.muted | color.dark.surface.default | 3.75:1 | 3:1 |
| pass | light | Input border | color.light.border.input | color.light.surface.default | 4.83:1 | 3:1 |
| pass | dark | Input border | color.dark.border.input | color.dark.surface.default | 3.75:1 | 3:1 |
| pass | light | Focus ring | color.light.focus.ring | color.light.surface.default | 5.17:1 | 3:1 |
| pass | dark | Focus ring | color.dark.focus.ring | color.dark.surface.default | 7.02:1 | 3:1 |

| Result | Platform | Target | Token | Size | Needs |
| --- | --- | --- | --- | --- | --- |
| pass | ios | Primary button | size.touch.ios.button | 44 pt | 44 pt |
| pass | ios | Tab bar item | size.touch.ios.tab | 49 pt | 44 pt |
| pass | android | Primary button | size.touch.android.button | 48 dp | 48 dp |
| **fail** | web | Icon button | size.touch.web.icon-button | 20 px | 24 px |
| pass | web | Link row | size.touch.web.link-row | 2.5 rem (rem x 16 = 40 px) | 24 px |

| Severity | Check | Where | Message | Fix |
| --- | --- | --- | --- | --- |
| error | low-contrast | examples/tidewater-app/token-rules.json:26 | Caption (dark): color.dark.text.muted (examples/tidewater-app/tokens.json:33, #64748b) on color.dark.surface.default (examples/tidewater-app/tokens.json:29, #0f172a) has a contrast ratio of 3.75:1; text needs at least 4.5:1 (WCAG 2.2 SC 1.4.3 Contrast (Minimum)) | Change color.dark.text.muted or color.dark.surface.default until the ratio is at least 4.5:1 |
| error | small-target | examples/tidewater-app/tokens.json:57 | Icon button (web): size.touch.web.icon-button is 20 px, below the 24 px minimum (WCAG 2.2 success criterion 2.5.8 Target Size (Minimum), level AA: 24 by 24 CSS pixels) | Make size.touch.web.icon-button at least 24 px |

**Gate failed:** 2 errors.
