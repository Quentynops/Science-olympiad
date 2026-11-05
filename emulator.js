'use strict';

(() => {
  const W = 160, H = 144;
  const status = document.getElementById('status');
  const canvas = document.getElementById('screen');
  const fileInput = document.getElementById('rom-file');
  const pauseButton = document.getElementById('pause');
  const resetButton = document.getElementById('reset');

  let emulator = null;
  let lastRom = null;
  let paused = false;

  function setStatus(message) {
    status.textContent = message;
  }

  function createEmulator() {
    const candidates = [
      () => window.gbajs && window.gbajs.GameBoy ? new window.gbajs.GameBoy({ canvas }) : null,
      () => window.gbajs && window.gbajs.default && window.gbajs.default.GameBoy ? new window.gbajs.default.GameBoy({ canvas }) : null,
      () => window.GameBoy ? new window.GameBoy({ canvas }) : null,
      () => window.GB ? new window.GB({ canvas }) : null,
      () => window.jsGB && window.jsGB.GameBoy ? new window.jsGB.GameBoy({ canvas }) : null,
      () => window.EMU && window.EMU.GameBoy ? new window.EMU.GameBoy({ canvas }) : null,
    ];

    for (const candidate of candidates) {
      try {
        const instance = candidate();
        if (instance) return instance;
      } catch (err) {
        // keep trying other constructors
      }
    }

    return null;
  }

  function attachKeyboardShortcuts() {
    const keyMap = {
      ArrowLeft: 'left',
      ArrowRight: 'right',
      ArrowUp: 'up',
      ArrowDown: 'down',
      KeyZ: 'a',
      KeyX: 'b',
      Enter: 'start',
      ShiftLeft: 'select',
      ShiftRight: 'select',
    };

    const pressKey = (code, isDown) => {
      if (!emulator) return;
      const name = keyMap[code];
      if (!name) return;

      if (typeof emulator.keyDown === 'function') {
        emulator.keyDown(name, isDown);
        return;
      }
      if (typeof emulator.press === 'function') {
        emulator.press(name, isDown);
        return;
      }
      if (emulator.input && typeof emulator.input.press === 'function') {
        emulator.input.press(name, isDown);
        return;
      }
      if (emulator.keys && typeof emulator.keys === 'object') {
        emulator.keys[name] = isDown;
      }
    };

    document.addEventListener('keydown', (event) => {
      if (!keyMap[event.code]) return;
      event.preventDefault();
      pressKey(event.code, true);
    });

    document.addEventListener('keyup', (event) => {
      if (!keyMap[event.code]) return;
      event.preventDefault();
      pressKey(event.code, false);
    });
  }

  function initializeEmulator() {
    try {
      emulator = createEmulator();
      if (!emulator) {
        setStatus('Unable to initialize the browser Game Boy core. Try reloading the page.');
        return false;
      }

      if (typeof emulator.start === 'function') emulator.start();
      if (typeof emulator.run === 'function') emulator.run();
      if (typeof emulator.reset === 'function') emulator.reset();

      pauseButton.disabled = false;
      resetButton.disabled = false;
      setStatus('Ready. Load a .gb or .gbc ROM.');
      return true;
    } catch (error) {
      setStatus('Emulator failed to start: ' + error.message);
      return false;
    }
  }

  function loadRomData(data) {
    if (!emulator) return;

    try {
      lastRom = data;

      if (typeof emulator.loadRom === 'function') {
        emulator.loadRom(data);
      } else if (typeof emulator.loadROM === 'function') {
        emulator.loadROM(data);
      } else if (typeof emulator.load === 'function') {
        emulator.load(data);
      } else if (typeof emulator.setRom === 'function') {
        emulator.setRom(data);
      } else {
        throw new Error('This emulator build does not expose a ROM loader in the standard form.');
      }

      if (typeof emulator.start === 'function') emulator.start();
      if (typeof emulator.run === 'function') emulator.run();
      if (typeof emulator.reset === 'function') emulator.reset();

      const title = Array.from(new Uint8Array(data.slice(0x134, 0x144)))
        .map((byte) => byte >= 32 && byte < 127 ? String.fromCharCode(byte) : '')
        .join('')
        .trim();

      setStatus(title ? 'Loaded ' + title + ' — use the keyboard to play.' : 'ROM loaded.');
      paused = false;
      pauseButton.textContent = 'Pause';
    } catch (error) {
      setStatus('Failed to load ROM: ' + error.message);
    }
  }

  function waitForLibrary() {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const poll = () => {
        if (window.gbajs || window.GameBoy || window.GB || window.jsGB || window.EMU) {
          resolve();
          return;
        }
        if (Date.now() - start > 15000) {
          reject(new Error('The Game Boy library did not finish loading. Please refresh the page.'));
          return;
        }
        setTimeout(poll, 200);
      };
      poll();
    });
  }

  async function init() {
    try {
      await waitForLibrary();
      if (!initializeEmulator()) return;
      attachKeyboardShortcuts();
    } catch (error) {
      setStatus(error.message);
    }
  }

  fileInput.addEventListener('change', async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    try {
      const bytes = await file.arrayBuffer();
      if (bytes.byteLength < 0x150) {
        throw new Error('That file is too small to be a valid ROM.');
      }
      loadRomData(bytes);
    } catch (error) {
      setStatus(error.message);
    }
  });

  pauseButton.addEventListener('click', () => {
    if (!emulator) return;
    paused = !paused;
    pauseButton.textContent = paused ? 'Resume' : 'Pause';

    if (typeof emulator.pause === 'function') {
      if (paused) emulator.pause();
      else emulator.run();
    }

    setStatus(paused ? 'Paused.' : 'Running.');
  });

  resetButton.addEventListener('click', () => {
    if (!emulator) return;
    if (typeof emulator.reset === 'function') emulator.reset();
    if (lastRom) loadRomData(lastRom);
    setStatus('Game reset.');
  });

  init();
})();
