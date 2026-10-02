# Rules and sources

Every number the tool uses comes from an official page, opened and saved under [research/sources](../research/sources) with its address on the first line. `src/data.js` holds the numbers, and `test/data.test.js` compares each of them with the saved text, so a number cannot change without the page text changing with it. Nothing here was taken from memory or from a blog post.

## Contrast

| Rule | Value | Where it is written |
| --- | --- | --- |
| Text | contrast ratio of at least 4.5:1 | Success Criterion 1.4.3 Contrast (Minimum), Level AA. https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html ([wcag-contrast-minimum.txt](../research/sources/wcag-contrast-minimum.txt)) and https://www.w3.org/TR/WCAG22/#dfn-relative-luminance ([wcag-definitions.txt](../research/sources/wcag-definitions.txt)) |
| Large text | contrast ratio of at least 3:1 | the same criterion, "Large-scale text and images of large-scale text have a contrast ratio of at least 3:1" |
| Non-text | contrast ratio of at least 3:1 against adjacent colors, for the visual information needed to identify user interface components and states, and for the parts of graphics needed to understand the content | Success Criterion 1.4.11 Non-text Contrast, Level AA. https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html ([wcag-non-text-contrast.txt](../research/sources/wcag-non-text-contrast.txt)) |
| Not rounded | "the computed values should not be rounded (e.g., 4.499:1 would not meet the 4.5:1 threshold)" | the Understanding page of 1.4.3; the page of 1.4.11 says the same for 2.999:1 and 3:1 |

**Large text.** The definition in WCAG 2.2, as W3C gives it:

> large scale: with at least 18 point or 14 point bold or font size that would yield equivalent size for Chinese, Japanese and Korean (CJK) fonts

The tool applies it as 18 pt, or 14 pt with a weight of 700 or more. It does not know a font's script, so the CJK clause is not applied. The page says "18 point" and "bold" can have different meanings in different fonts, and that fonts with very thin strokes are harder to read; the tool cannot see a font, so a thin weight is not special-cased. The Understanding page gives the size in points as the CSS point: "1pt = 1.333px, therefore 14pt and 18pt are equivalent to approximately 18.5px and 24px". The tool uses 0.75 pt per CSS pixel.

**Relative luminance and the contrast ratio.** From the WCAG definitions: the relative luminance of an sRGB color is `L = 0.2126 * R + 0.7152 * G + 0.0722 * B`, where each channel `C` is the 8-bit value divided by 255 and then `C / 12.92` when that is at most 0.04045, else `((C + 0.055) / 1.055) ^ 2.4`. The contrast ratio is `(L1 + 0.05) / (L2 + 0.05)`, L1 the lighter and L2 the darker, from 1 to 21. Known values, which the tests check: black on white is 21:1, `#777777` on white is 4.48:1, `#767676` on white is 4.54:1.

**What Android and Apple say about text.** Android's page uses the same split: below 18sp, or bold below 14sp, 4.5:1; otherwise 3:1. Apple's page gives a table taken from WCAG level AA: up to 17 pts 4.5:1, 18 pts 3:1, and bold text 3:1. Apple's table lets bold text of any size use 3:1, which WCAG does not (WCAG needs 14 pt bold). The tool follows WCAG, the stricter and the one that is a standard, so a bold 12 pt text is checked at 4.5:1.

## Touch targets

| Platform | Value | Severity | Where it is written |
| --- | --- | --- | --- |
| iOS and iPadOS | 44 pt | warning | Apple Human Interface Guidelines, Accessibility, "Offer sufficiently sized controls": a table with default control size 44x44 pt and minimum control size 28x28 pt for iOS and iPadOS. https://developer.apple.com/tutorials/data/design/human-interface-guidelines/accessibility.json ([apple-hig-accessibility.txt](../research/sources/apple-hig-accessibility.txt)) |
| Android | 48 dp | warning | "we recommend that each interactive UI element have a focusable area, or touch target size, of at least 48dpx48dp". https://developer.android.com/guide/topics/ui/accessibility/apps ([android-accessibility-apps.txt](../research/sources/android-accessibility-apps.txt)) |
| Web | 24 CSS px | error | Success Criterion 2.5.8 Target Size (Minimum), Level AA: "The size of the target for pointer inputs is at least 24 by 24 CSS pixels". https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html ([wcag-target-size-minimum.txt](../research/sources/wcag-target-size-minimum.txt)) |

**The iOS number.** The task of the tool is to warn below 44 pt, and 44x44 pt is what Apple's page gives as the default control size. The same table gives 28x28 pt as the minimum control size. So 44 is Apple's recommended size and 28 is the smallest it names. The tool warns below 44 and adds a sentence to the message when the size is below 28; it is a warning in both cases, because Apple writes both as guidance ("strive to meet").

**Why the web is an error and the others are warnings.** Success criterion 2.5.8 is a level AA requirement, so failing it is a failure against the standard. The Apple and Android numbers are recommendations of the platform vendors. WCAG 2.5.8 has five exceptions: spacing (undersized targets whose 24 px circles do not intersect), an equivalent control on the same page, an inline target, a target the user agent draws, and an essential presentation. A token cannot say whether one applies, so the tool reports the size and leaves the decision to the reviewer; [limits.md](limits.md) repeats this.

**Units.** The Design Tokens format says a `px` is an idealized pixel whose equivalent is `dp` on Android and `pt` on iOS, and that `rem` is a multiple of the system's default font size, "usually 16px" when a platform has no equivalent. The tool follows both: a `px` on `ios` or `android` is the native unit, a `rem` is multiplied by `remBase` (default 16). A unit from another platform (`pt` on Android, `dp` on iOS, `pt` or `dp` on the web) is an error, because 1 pt is not 1 CSS pixel and a silent conversion would hide a mistake. 2.5.8 is about CSS pixels, so the web target is compared in `px`.

## Design Tokens format

https://tr.designtokens.org/format/ ([dtcg-format.txt](../research/sources/dtcg-format.txt)) for tokens, groups, types, aliases, `$root`, `$ref` and the dimension type, and https://tr.designtokens.org/color/ ([dtcg-color.txt](../research/sources/dtcg-color.txt)) for the color type, which the format page refers to. [tokens-format.md](tokens-format.md) lists what the tool reads from them.

## When a page changes

Save the new page text in `research/sources` (the address on the first line), change `src/data.js` to match, and update this page. `test/data.test.js` fails when a number and its page disagree.
