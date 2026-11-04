'use strict';

// Apply cartridge compatibility fixes to the existing emulator core before it starts.
// This keeps emulator.js as the CPU/video implementation and extends its cartridge bus.
(async () => {
  const status = document.getElementById('status');
  try {
    const response = await fetch(new URL('emulator.js', document.baseURI));
    if (!response.ok) throw new Error(`Could not load emulator core (${response.status}).`);
    let source = await response.text();
    const replaceOnce = (before, after, label) => {
      if (!source.includes(before)) throw new Error(`Emulator core changed; compatibility patch failed (${label}).`);
      source = source.replace(before, after);
    };

    // MBC3 RAM banking and RTC register selection, used by several Pokémon releases.
    replaceOnce(
      'this.romBank = 1; this.ramBank = 0; this.ramEnabled = false; this.bankMode = 0;',
      'this.romBank = 1; this.ramBank = 0; this.ramEnabled = false; this.bankMode = 0;\n      this.mbc3Select = 0; this.mbc3Latch = -1; this.rtc = new Uint8Array(5); this.rtcLatched = new Uint8Array(5); this.rtcLast = Date.now();',
      'MBC3 state'
    );
    replaceOnce(
      'else if (type === 5 || type === 6) {',
      `else if (type >= 0x0f && type <= 0x13) {
          if (addr < 0x2000) this.ramEnabled = (val & 15) === 10;
          else if (addr < 0x4000) { this.romBank = val & 0x7f; if (!this.romBank) this.romBank = 1; }
          else if (addr < 0x6000) { this.mbc3Select = val; if (val <= 3) this.ramBank = val; }
          else { if (this.mbc3Latch === 0 && val === 1) { this.updateRTC(); this.rtcLatched.set(this.rtc); } this.mbc3Latch = val; }
        } else if (type >= 0x19 && type <= 0x1e) {
          if (addr < 0x2000) this.ramEnabled = (val & 15) === 10;
          else if (addr < 0x3000) this.romBank = (this.romBank & 0x100) | val;
          else if (addr < 0x4000) this.romBank = (this.romBank & 0xff) | ((val & 1) << 8);
          else if (addr < 0x6000) this.ramBank = val & 15;
        } else if (type === 5 || type === 6) {`,
      'MBC3/MBC5 writes'
    );
    replaceOnce(
      'if (addr < 0xc000) return this.ramEnabled ? (this.ram[(this.ramBank*0x2000 + addr-0xa000) % this.ram.length] || 0xff) : 0xff;',
      `if (addr < 0xc000) {
        if (!this.ramEnabled) return 0xff;
        const type = this.rom[0x147] || 0;
        if (type >= 0x0f && type <= 0x13 && this.mbc3Select >= 8 && this.mbc3Select <= 12) return this.readRTC(this.mbc3Select - 8);
        return this.ram[(this.ramBank * 0x2000 + addr - 0xa000) % this.ram.length] || 0xff;
      }`,
      'MBC3 external reads'
    );
    replaceOnce(
      'if (addr < 0xc000) { if (this.ramEnabled) this.ram[(this.ramBank*0x2000+addr-0xa000)%this.ram.length]=val; return; }',
      `if (addr < 0xc000) {
        if (!this.ramEnabled) return;
        const type = this.rom[0x147] || 0;
        if (type >= 0x0f && type <= 0x13 && this.mbc3Select >= 8 && this.mbc3Select <= 12) this.writeRTC(this.mbc3Select - 8, val);
        else this.ram[(this.ramBank * 0x2000 + addr - 0xa000) % this.ram.length] = val;
        return;
      }`,
      'MBC3 external writes'
    );
    replaceOnce(
      '    joypad() {',
      `    updateRTC() {
      const now = Date.now();
      const elapsed = Math.floor((now - this.rtcLast) / 1000);
      this.rtcLast = now;
      if (elapsed <= 0 || (this.rtc[4] & 0x40)) return;
      let seconds = this.rtc[0] + elapsed;
      this.rtc[0] = seconds % 60;
      let minutes = this.rtc[1] + Math.floor(seconds / 60);
      this.rtc[1] = minutes % 60;
      let hours = this.rtc[2] + Math.floor(minutes / 60);
      this.rtc[2] = hours % 24;
      const days = (this.rtc[3] | ((this.rtc[4] & 1) << 8)) + Math.floor(hours / 24);
      if (days > 511) this.rtc[4] |= 0x80;
      const day = days & 511;
      this.rtc[3] = day & 0xff;
      this.rtc[4] = (this.rtc[4] & 0xc0) | (day >> 8);
    }
    readRTC(index) {
      this.updateRTC();
      const value = this.mbc3Latch === 1 ? this.rtcLatched[index] : this.rtc[index];
      return value || 0;
    }
    writeRTC(index, value) {
      this.updateRTC();
      if (index === 0) this.rtc[0] = value % 60;
      else if (index === 1) this.rtc[1] = value % 60;
      else if (index === 2) this.rtc[2] = value % 24;
      else if (index === 3) this.rtc[3] = value;
      else this.rtc[4] = value & 0xc1;
      this.rtcLast = Date.now();
    }
    joypad() {`,
      'RTC helpers'
    );

    const script = document.createElement('script');
    script.textContent = source;
    document.body.appendChild(script);
  } catch (error) {
    status.textContent = `${error.message} Please run this page from a web server, not directly as a file.`;
    console.error(error);
  }
})();
