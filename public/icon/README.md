# Icons

Drop the extension icons here as `{size}.png`. WXT auto-discovers files
matching `public/icon/{N}.png` and writes the `icons` field of the
produced `manifest.json` for you — no config change needed.

This directory ships **no PNGs today**. Both Chrome Web Store and
Firefox AMO reject extension uploads without icons, so the placeholder
state below has to be filled in before the release workflow at
[`.github/workflows/release.yml`](../../.github/workflows/release.yml)
can produce store-acceptable artifacts.

## Required files

| Filename | Required for | Used as |
| --- | --- | --- |
| `16.png` | Chrome MV3, Firefox MV2 | Toolbar pinned-icon, favicon |
| `32.png` | Chrome MV3 | Windows display scale variant |
| `48.png` | Chrome MV3, Firefox MV2 | `chrome://extensions` card |
| `96.png` | Firefox MV2 | AMO listing |
| `128.png` | Chrome Web Store listing | Web store hero icon |

All PNGs must be square, transparent background preferred. Chrome's
review rejects icons with letterboxing, watermarks, or off-canvas
glyphs.

## Generating the five sizes from a single SVG

The cheapest pipeline if you have a single vector source:

```bash
# Install once.
brew install librsvg                                   # macOS
# or: sudo apt-get install librsvg2-bin                 # Debian/Ubuntu

# Generate. Replace icon-source.svg with the master.
for size in 16 32 48 96 128; do
  rsvg-convert -w "$size" -h "$size" \
    icon-source.svg \
    -o "public/icon/${size}.png"
done
```

Alternative with ImageMagick (slightly fuzzier at small sizes):

```bash
brew install imagemagick
for size in 16 32 48 96 128; do
  magick icon-source.svg -resize "${size}x${size}" "public/icon/${size}.png"
done
```

After generation, verify WXT picks them up:

```bash
pnpm build
jq '.icons' .output/chrome-mv3/manifest.json
# Should print {"16": "icon/16.png", "32": "icon/32.png", ...}
```

## Design notes

- The product is privacy-themed; the landing page accents are a dark
  midnight blue. An icon that reads at 16×16 is essential — favour a
  bold mark over fine detail.
- Avoid a literal Gorgon (Medusa) illustration; reviewers occasionally
  flag mythological imagery as "macabre" depending on rendering.
- Test against both light and dark Chrome toolbars before submitting.

## Master SVG (where to put it)

The master vector belongs at `public/icon/icon-source.svg` so the
generation snippet above works as-written. That file is **not** auto-
picked up by WXT (only PNGs at the documented sizes are), so it is safe
to commit alongside the rendered outputs.
