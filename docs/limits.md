# Limits

## What the tool can know

- **It sees what the tokens say, not what the screens show.** A pair is checked when the rules file lists it. A text color that is not listed is not checked, and the absence of a finding is not a statement that every screen is readable. Text drawn over an image, a gradient or a blurred layer has no single background token, and the tool does not check it.
- **The rules file is a claim.** The tool checks that the pairs are what they say. It cannot know that the "light" and "dark" themes you list are all the themes the app has, or that a pair is the one used on a given screen. A theme that one pair lists and another lacks is a warning, but a theme that no pair lists is not seen.
- **Contrast is for opaque backgrounds.** A foreground with alpha is drawn over the background before the ratio is taken. A background with alpha is an error. Colors are taken as sRGB; a color in another color space is refused, not converted.
- **WCAG 2.5.8 has exceptions.** A web target below 24 CSS px is an error here, because a token cannot say whether the spacing, equivalent, inline, user agent or essential exception applies. Where one does, the finding is a prompt to say so in your review, not a verdict. The tool does not read the spacing around a target.
- **A target is a size, not a layout.** The size of a token is compared with the minimum. Whether the button really gets that size, with its padding and hit slop, depends on the code.
- **Apple's number is a recommendation.** 44 pt is Apple's default control size, and its page names 28 pt as the minimum control size. The tool warns below 44, whichever you target.
- **Bold means 700.** WCAG does not give a number for bold; the Design Tokens format calls 700 bold, and the tool uses that. A semi-bold of 600 is not bold. Fonts with very thin strokes and the CJK clause of the large-text definition are not special-cased.
- **Text size units.** A `px` text size is a CSS pixel unless the pair names `ios` or `android`, where it is a point, as the Design Tokens format says. A `rem` text size uses `remBase`. The sizes on a real device also depend on the user's text size setting, which the tokens do not hold.
- **Not every part of the format is read.** `$extends`, composite tokens, color spaces other than `srgb` and references inside a value are not followed; [tokens-format.md](tokens-format.md) lists them.

## What the tool does not check

- Contrast of focus indicators against each other, of states that never appear next to each other, and of text in images.
- Touch target spacing, the target of a gesture, motion, text spacing and every other success criterion of WCAG.
- Whether the tokens are the ones the app uses: the check is of the file, not of the built app.
- Contrast algorithms other than the WCAG 2.x ratio. The Accessible Perceptual Contrast Algorithm (APCA), which Apple's page also names, is not computed.

## Size

- A tokens file or a rules file over 10 MB is not read: the run stops for the tokens file and the rules file becomes a finding.
- JSON nested deeper than 64 levels, or with more than 200,000 values, is refused.
- Text shown in a report is cut to a fixed length: 300 characters for a name, a subject or a path, 1,200 for a message or a fix, 600 for a note.

Every limit is reported, as a finding, a note or a stopped run, so a cut is never silent.
