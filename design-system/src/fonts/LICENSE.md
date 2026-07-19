# Fonts — provenance and licence

Both files are **self-hosted deliberately**. PLC previously pulled these from
`fonts.googleapis.com` at runtime, which fails wherever the network is
restricted — including the sandbox that renders Claude Design previews. A CDN
miss falls back to Courier, and a preview in the wrong typeface misrepresents
the design language to the very agent that is supposed to learn it. Self-hosting
also makes the cartridges work offline and by double-clicking `index.html`.

Only the **latin** subset of each face is shipped. The arcade is English-only, so
the cyrillic / greek / latin-ext subsets would roughly triple the payload for
glyphs nothing ever renders.

| File | Family | Source | Size |
|---|---|---|---|
| `PressStart2P-Regular.woff2` | Press Start 2P | Google Fonts (`fonts.gstatic.com`, v16) | 12.5 KB |
| `ShareTechMono-Regular.woff2` | Share Tech Mono | Google Fonts (`fonts.gstatic.com`, v16) | 13.5 KB |

## Licence

Both are licensed under the **SIL Open Font License, Version 1.1**, which permits
redistribution — including bundled inside another work — provided the fonts are
not sold on their own and the licence travels with them.

- Press Start 2P — Copyright © CodeMan38. <https://fonts.google.com/specimen/Press+Start+2P>
- Share Tech Mono — Copyright © Carrois Apostrophe. <https://fonts.google.com/specimen/Share+Tech+Mono>

Full licence text: <https://openfontlicense.org/open-font-license-official-text/>

## Refreshing them

These are pinned to Google Fonts **v16**. To re-fetch, request the CSS with a
modern browser User-Agent (an old or absent UA gets served `.ttf` instead of
`.woff2`), take the `@font-face` block whose `unicode-range` covers `U+0000-00FF`
— that is the latin subset — and download the URL inside it:

    https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Share+Tech+Mono&display=swap

Verify any replacement really is a WOFF2 before committing it: the first four
bytes must be `77 4f 46 32` (`wOF2`). A silent HTML error page saved under a
`.woff2` name is the failure mode this check catches.
