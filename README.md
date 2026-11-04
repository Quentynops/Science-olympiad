# Browser Boy

A small Game Boy DMG emulator that runs locally in the browser. Serve this folder with a static web server and open `index.html`; choose a `.gb` or `.gbc` ROM file to play. ROM contents are read locally by the browser and are never uploaded.

## Controls

- Arrow keys: D-pad
- Z: A
- X: B
- Enter: Start
- Shift: Select

## Implementation and limits

The existing `emulator.js` remains the CPU, memory, timer, and graphics core. `pokemon-compat.js` applies small cartridge-bus compatibility patches before starting that core, adding MBC3 banking/RTC (used by some Pokémon titles) and MBC5 banking. This improves compatibility with more ROMs but does not make this a fully accurate emulator; LCD timing, audio, color hardware, battery-backed save persistence, and some cartridge features remain incomplete. Game compatibility can vary. Use ROM files you are legally entitled to use.

## Run locally

Because the compatibility loader fetches the existing core, run the files through a local static server rather than opening `index.html` directly. For example, run `python3 -m http.server 8000` in this directory and visit `http://localhost:8000`.
