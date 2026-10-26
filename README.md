# CS2 Font Studio Web

Change the fonts of Counter-Strike 2 in the browser: pick fonts for the game's font groups, see them on the game's own
screens, then download one zip and unpack it into the game folder. No program to install, nothing runs on a server.

It is the web version of [CS2 Font Studio](https://github.com/spddl/CS2FontStudio), the Windows program: same font
groups, same preview, same `99-spddl.conf`. The Windows program applies the fonts straight to the game folder (no zip to
unpack), offers every installed font in any browser, resets cleanly and restarts CS2:
[download it here](https://github.com/spddl/CS2FontStudio/releases).

## Fonts

- **Google Fonts**: the whole catalog (about 1,970 families), loaded from [Fontsource](https://fontsource.org) on demand.
- **Your own files**: upload `.ttf`, `.otf` or `.ttc` files (or a `.zip` of them), or drop them onto the page. They stay
  in your browser (IndexedDB) and are never uploaded anywhere.
- **From a link**: a direct link to a font file or a zip of fonts. Works when the server allows downloads from web pages
  (CORS), e.g. GitHub (raw links) and jsDelivr.
- **Fonts of this PC**: in Chrome and Edge the page can use the installed fonts (the browser asks once). A zip with them
  is for your own PC only: these fonts are usually not free to share.

WOFF/WOFF2 files are web-only formats the game cannot read: use the `.ttf`/`.otf` file of the font.

## The zip

The zip holds one folder, `game`. Unpack it into
`…\steamapps\common\Counter-Strike Global Offensive` (in Steam: right-click *Counter-Strike 2* › *Properties…* ›
*Installed Files* › *Browse…* opens it) and let it replace files:

```
game/core/panorama/fonts/conf.d/99-spddl.conf        the rules (fontconfig)
game/csgo/panorama/fonts/notosans-*.ttf               the fonts (the game only loads files named notosans*)
game/csgo/panorama/fonts/notosans-licenses/*.txt      license texts of the Google fonts
```

Restart CS2 afterwards: it reads its fonts only at startup.

**Undo:** delete `99-spddl.conf`, or unpack a zip downloaded without any changes. The `notosans-…` files the zip added can
be deleted as well. Keep the game's own Noto files (`notosans-regular.ttf`, `notosans-bold.ttf`, `notosansjp-*.ttf`, …).

Details:

- The game's fontconfig cannot use variable fonts. Google fonts therefore come as static files, one per weight, style and
  character set (Latin, Latin Extended, Cyrillic, Greek, Vietnamese). Other scripts use the game's own Noto fonts.
- Fontsource names some weights as families of their own (e.g. "Barlow Condensed SemiBold"). The page rewrites the name
  table of every Google font so that all files of a family carry the same name, and fontconfig can pick the weight.
- Only the weights the rules need go into the zip: the chosen weight, or regular and bold when the game decides.

## Development

Plain static files, no build step. Serve the folder and open it:

```
python -m http.server 8000
```

`npm test` (Node 20+) checks the conf writer against the output of the Windows program (`test/conf.golden.json`), the
font name rewriting and the zip writer/reader.

| File | |
|---|---|
| `index.html`, `app.css`, `app.js` | the page: preview, font groups, configurations |
| `scenes*.js`, `scenes/` | the measured game screens of the preview |
| `fonts.js` | font sources: Fontsource, own files (IndexedDB), links, fonts of this PC; collects the files for the zip |
| `conf.js` | writes and reads `99-spddl.conf` |
| `sfnt.js` | reads font names, rewrites the name table |
| `zip.js` | zip writer and reader |
| `fonts/` | the preview's stand-in fonts (Saira, Chivo Mono, SIL OFL) |
| `licenses/` | license texts put into the zip |

## Licenses

Fonts keep their own licenses (Google Fonts: SIL Open Font License 1.1, Apache 2.0 or Ubuntu Font Licence; texts in
`licenses/`). Counter-Strike 2 and its screenshots belong to Valve. Not affiliated with Valve.
