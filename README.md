# Browser Boy

A small, self-contained Game Boy DMG emulator that runs locally in the browser. Serve this folder with any static web server and open `index.html`; choose a `.gb` or `.gbc` ROM file to play. ROM contents are read locally by the browser and are never uploaded.

## Controls

- Arrow keys: D-pad
- Z: A
- X: B
- Enter: Start
- Shift: Select

## Implementation and limits

The emulator includes an LR35902 CPU instruction decoder, memory map, ROM-only/MBC1/MBC2 banking basics, timer, interrupt handling, joypad input, and pixel rendering for DMG backgrounds, windows, and sprites. It is intentionally dependency-free. Audio, color Game Boy features, save-state/persistent battery RAM, and some cartridge mappers and hardware timing details are not implemented, so commercial game compatibility is not guaranteed. Use ROM files you are legally entitled to use.

## Run locally

Open `index.html` directly in a modern browser, or start a static server in this directory (for example, `python3 -m http.server 8000`) and visit `http://localhost:8000`.
