# Landing page

Single-file, dependency-free HTML page at [`index.html`](index.html). Intended
to be deployed to GitHub Pages or any static host as the public face of the
project — judges and prospective contributors land here before clicking
through to the repo.

Why no React: this page must load and be visually complete in a single TCP
round-trip. The entire build artifact is the HTML file itself.

## Local preview

```bash
npx serve landing -p 4200
# open http://127.0.0.1:4200
```

## What to update before a release

- Replace the GitHub URLs (currently `aegishield/gorgon-eye`) with the real
  org/repo once the project is moved.
- Update the version badge and the build-instructions section if the install
  flow changes.
- Re-export from the demo playbook anything that needs to stay in sync.

## What NOT to put here

- Live data or remote analytics. The page is meant to look exactly like the
  product feels: zero outbound calls.
- Tracking pixels, third-party fonts, embedded videos. The page is one file
  so a privacy-minded visitor can read every byte before installing.
