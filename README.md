# Browser Boy

A browser-based Game Boy emulator that uses a real Game Boy runtime loaded from a CDN instead of the earlier custom prototype. Serve this folder with a local web server and open `index.html`; choose a `.gb` or `.gbc` ROM you legally own and play it in the browser.

## Controls

- Arrow keys: D-pad
- Z: A
- X: B
- Enter: Start
- Shift: Select

## Notes

This version uses the `gbajs` CDN build, which is much more compatible with real Pokémon ROMs than the custom one-off emulator. The page remains a lightweight browser app; the ROM is read locally and never uploaded.

## Run locally

Run a local static server, for example:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.
