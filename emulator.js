'use strict';

// Browser Boy: compact Nintendo Game Boy DMG emulator. No ROM data is uploaded.
(() => {
  const W = 160, H = 144, FRAME_CYCLES = 70224;
  const canvas = document.getElementById('screen');
  const ctx = canvas.getContext('2d', { alpha: false });
  const image = ctx.createImageData(W, H);
  const status = document.getElementById('status');
  const fileInput = document.getElementById('rom-file');
  const pauseButton = document.getElementById('pause');
  const resetButton = document.getElementById('reset');
  const shades = [[224,248,208],[136,192,112],[52,104,86],[8,24,32]];

  class GameBoy {
    constructor(rom) {
      this.rom = new Uint8Array(rom);
      this.ram = new Uint8Array(0x2000);
      this.vram = new Uint8Array(0x2000);
      this.wram = new Uint8Array(0x2000);
      this.oam = new Uint8Array(0xa0);
      this.io = new Uint8Array(0x80);
      this.hram = new Uint8Array(0x7f);
      this.ie = 0;
      this.romBank = 1; this.ramBank = 0; this.ramEnabled = false; this.bankMode = 0;
      this.keys = new Set(); this.joySelect = 0x30;
      this.cycles = 0; this.lcdCycles = 0; this.divCycles = 0; this.timerCycles = 0;
      this.frameCycles = 0; this.running = true; this.frameReady = true;
      this.resetCPU();
      this.io[0x00] = 0xcf; this.io[0x04] = 0; this.io[0x05] = 0;
      this.io[0x06] = 0; this.io[0x07] = 0; this.io[0x0f] = 0xe1;
      this.io[0x40] = 0x91; this.io[0x41] = 0x85; this.io[0x42] = 0;
      this.io[0x43] = 0; this.io[0x44] = 0; this.io[0x45] = 0;
      this.io[0x47] = 0xfc; this.io[0x48] = 0xff; this.io[0x49] = 0xff;
      this.io[0x4a] = 0; this.io[0x4b] = 0;
    }
    resetCPU() {
      this.a=0x01; this.f=0xb0; this.b=0; this.c=0x13; this.d=0; this.e=0xd8;
      this.h=0x01; this.l=0x4d; this.sp=0xfffe; this.pc=0x100; this.ime=false; this.eiDelay=0; this.halted=false;
    }
    read(addr) {
      addr &= 0xffff;
      if (addr < 0x4000) return this.rom[addr] || 0;
      if (addr < 0x8000) {
        const bank = this.romBank % Math.max(1, Math.ceil(this.rom.length / 0x4000));
        return this.rom[bank * 0x4000 + (addr - 0x4000)] || 0xff;
      }
      if (addr < 0xa000) return this.vram[addr-0x8000];
      if (addr < 0xc000) return this.ramEnabled ? (this.ram[(this.ramBank*0x2000 + addr-0xa000) % this.ram.length] || 0xff) : 0xff;
      if (addr < 0xe000) return this.wram[addr-0xc000];
      if (addr < 0xfe00) return this.wram[addr-0xe000];
      if (addr < 0xfea0) return this.oam[addr-0xfe00];
      if (addr < 0xff00) return 0xff;
      if (addr < 0xff80) {
        if (addr === 0xff00) return this.joypad();
        if (addr === 0xff04) return (this.divCycles >> 8) & 255;
        if (addr === 0xff0f) return this.io[0x0f] | 0xe0;
        if (addr === 0xff44) return this.io[0x44];
        if (addr === 0xff41) return (this.io[0x41] & 0xfc) | (this.io[0x44] >= 144 ? 1 : (this.lcdCycles < 80 ? 2 : this.lcdCycles < 252 ? 3 : 0));
        return this.io[addr-0xff00];
      }
      if (addr < 0xffff) return this.hram[addr-0xff80];
      return this.ie;
    }
    write(addr, val) {
      addr &= 0xffff; val &= 255;
      if (addr < 0x8000) {
        const type = this.rom[0x147] || 0;
        if (type === 1 || type === 2 || type === 3) {
          if (addr < 0x2000) this.ramEnabled = (val & 15) === 10;
          else if (addr < 0x4000) { this.romBank = (this.romBank & 0x60) | (val & 0x1f); if (!(this.romBank & 0x1f)) this.romBank++; }
          else if (addr < 0x6000) { if (this.bankMode) this.ramBank=val&3; else this.romBank=(this.romBank&0x1f)|((val&3)<<5); }
          else this.bankMode=val&1;
        } else if (type === 5 || type === 6) {
          if (addr < 0x2000) this.ramEnabled=(val&15)===10;
          else if (addr < 0x3000) this.romBank=(this.romBank&0x100)|val;
          else if (addr < 0x4000) this.romBank=(this.romBank&255)|((val&1)<<8);
        }
        return;
      }
      if (addr < 0xa000) { this.vram[addr-0x8000]=val; return; }
      if (addr < 0xc000) { if (this.ramEnabled) this.ram[(this.ramBank*0x2000+addr-0xa000)%this.ram.length]=val; return; }
      if (addr < 0xe000) { this.wram[addr-0xc000]=val; return; }
      if (addr < 0xfe00) { this.wram[addr-0xe000]=val; return; }
      if (addr < 0xfea0) { this.oam[addr-0xfe00]=val; return; }
      if (addr < 0xff00) return;
      if (addr < 0xff80) {
        const i=addr-0xff00;
        if (addr===0xff00) { this.joySelect=val&0x30; return; }
        if (addr===0xff04) { this.divCycles=0; this.io[4]=0; return; }
        if (addr===0xff05) { this.io[5]=val; return; }
        if (addr===0xff07) { this.io[7]=val&7; return; }
        if (addr===0xff0f) { this.io[15]=val&31; return; }
        if (addr===0xff44) { this.io[0x44]=0; return; }
        if (addr===0xff46) { for(let n=0;n<160;n++) this.oam[n]=this.read((val<<8)+n); return; }
        this.io[i]=val;
        if (addr===0xff40 && !(val&0x80)) { this.io[0x44]=0; this.lcdCycles=0; }
        return;
      }
      if (addr < 0xffff) this.hram[addr-0xff80]=val; else this.ie=val;
    }
    joypad() {
      let low=15;
      if (!(this.joySelect&0x10)) { if(this.keys.has('ArrowRight'))low&=1; if(this.keys.has('ArrowLeft'))low&=2; if(this.keys.has('ArrowUp'))low&=4; if(this.keys.has('ArrowDown'))low&=8; }
      if (!(this.joySelect&0x20)) { if(this.keys.has('KeyZ'))low&=1; if(this.keys.has('KeyX'))low&=2; if(this.keys.has('ShiftLeft')||this.keys.has('ShiftRight'))low&=4; if(this.keys.has('Enter'))low&=8; }
      return 0xc0|this.joySelect|low;
    }
    get bc(){return (this.b<<8)|this.c} set bc(v){this.b=(v>>8)&255;this.c=v&255;}
    get de(){return (this.d<<8)|this.e} set de(v){this.d=(v>>8)&255;this.e=v&255;}
    get hl(){return (this.h<<8)|this.l} set hl(v){this.h=(v>>8)&255;this.l=v&255;}
    rb(){const v=this.read(this.pc);this.pc=(this.pc+1)&65535;return v;}
    rw(){const lo=this.rb();return lo|(this.rb()<<8);}
    push(v){this.sp=(this.sp-1)&65535;this.write(this.sp,(v>>8)&255);this.sp=(this.sp-1)&65535;this.write(this.sp,v&255);}
    pop(){const lo=this.read(this.sp);this.sp=(this.sp+1)&65535;const hi=this.read(this.sp);this.sp=(this.sp+1)&65535;return (hi<<8)|lo;}
    getR(i){return [this.b,this.c,this.d,this.e,this.h,this.l,this.read(this.hl),this.a][i];}
    setR(i,v){v&=255;switch(i){case 0:this.b=v;break;case 1:this.c=v;break;case 2:this.d=v;break;case 3:this.e=v;break;case 4:this.h=v;break;case 5:this.l=v;break;case 6:this.write(this.hl,v);break;case 7:this.a=v;}}
    getRP(p, stack=false){return p===0?this.bc:p===1?this.de:p===2?this.hl:(stack?this.sp:this.a<<8|this.f);}
    setRP(p,v,stack=false){v&=65535;if(p===0)this.bc=v;else if(p===1)this.de=v;else if(p===2)this.hl=v;else if(stack)this.sp=v;else{this.a=v>>8;this.f=v&0xf0;}}
    flag(mask){return (this.f&mask)!==0;}
    cond(y){return [!this.flag(0x80),this.flag(0x80),!this.flag(0x10),this.flag(0x10)][y];}
    inc(v){const r=(v+1)&255;this.f=(this.f&0x10)|(r===0?0x80:0)|(r&15?0:0x20)|((v&15)===15?0x10:0);return r;}
    dec(v){const r=(v-1)&255;this.f=(this.f&0x10)|0x40|(r===0?0x80:0)|(r&15?0:0x20)|((v&15)===0?0x10:0);return r;}
    alu(y,v){v&=255;let r;
      switch(y){case 0:case 1:{const c=y===1&&this.flag(16)?1:0,s=this.a+v+c;r=s&255;this.f=(r===0?128:0)|(((this.a&15)+(v&15)+c>15)?16:0)|(s>255?16:0);this.a=r;break;}
      case 2:case 3:{const c=y===3&&this.flag(16)?1:0,s=this.a-v-c;r=s&255;this.f=64|(r===0?128:0)|((this.a&15)<((v&15)+c)?16:0)|(this.a<v+c?16:0);this.a=r;break;}
      case 4:this.a&=v;this.f=(this.a===0?128:0)|32;break;case 5:this.a^=v;this.f=this.a===0?128:0;break;case 6:this.a|=v;this.f=this.a===0?128:0;break;
      case 7:r=(this.a-v)&255;this.f=64|(r===0?128:0)|((this.a&15)<(v&15)?16:0)|(this.a<v?16:0);break;}
    }
    addHL(v){const old=this.hl,s=old+v;this.f=(this.f&0x80)|(((old&0xfff)+(v&0xfff)>0xfff)?0x20:0)|(s>0xffff?0x10:0);this.hl=s&0xffff;}
    signedSP(v,toHL){const s=(v<<24)>>24,old=this.sp,r=(old+s)&65535;this.f=((old&15)+(v&15)>15?0x20:0)|((old&255)+v>255?0x10:0);if(toHL)this.hl=r;else this.sp=r;}
    daa(){let a=this.a,adj=0,carry=this.flag(16);if(!this.flag(64)){if(this.flag(32)||(a&15)>9)adj|=6;if(carry||a>0x99){adj|=0x60;carry=true;}a=(a+adj)&255;}else{if(this.flag(32))adj|=6;if(carry)adj|=0x60;a=(a-adj)&255;}this.a=a;this.f=(this.f&0x40)|(a===0?0x80:0)|(carry?0x10:0);}
    cb(op){const x=op>>6,y=(op>>3)&7,z=op&7,v=this.getR(z);let r=v;
      if(x===0){switch(y){case 0:r=((v<<1)|(v>>7))&255;this.f=(r===0?128:0)|(v>>7?16:0);break;case 1:r=((v>>1)|(v<<7))&255;this.f=(r===0?128:0)|(v&1?16:0);break;case 2:{const c=this.flag(16)?1:0;r=((v<<1)|c)&255;this.f=(r===0?128:0)|(v>>7?16:0);break;}case 3:{const c=this.flag(16)?128:0;r=(v>>1)|c;this.f=(r===0?128:0)|(v&1?16:0);break;}case 4:r=(v<<1)&255;this.f=(r===0?128:0)|(v>>7?16:0);break;case 5:r=(v>>1)|(v&128);this.f=(r===0?128:0)|(v&1?16:0);break;case 6:r=((v<<4)|(v>>4))&255;this.f=r===0?128:0;break;case 7:r=v>>1;this.f=(r===0?128:0)|(v&1?16:0);break;}this.setR(z,r);}
      else if(x===1)this.f=(this.f&16)|32|(!(v&(1<<y))?128:0);
      else if(x===2)this.setR(z,v&~(1<<y));else this.setR(z,v|(1<<y));
      return z===6?(x===1?12:16):8;
    }
    step(){
      const pending=this.ie&this.io[15]&31;
      if(pending){this.halted=false;if(this.ime){this.ime=false;let bit=0;while(!(pending&(1<<bit)))bit++;this.io[15]&=~(1<<bit);this.push(this.pc);this.pc=[0x40,0x48,0x50,0x58,0x60][bit];return 20;}}
      if(this.halted)return 4;
      const op=this.rb(),x=op>>6,y=(op>>3)&7,z=op&7,p=y>>1,q=y&1;let t=0;
      if(x===0){
        if(z===0){if(y===0)return 4;if(y===1){const a=this.rw(),v=this.sp;this.write(a,v&255);this.write(a+1,v>>8);return 20;}if(y===2){this.rb();this.halted=true;return 4;}if(y===3){this.pc=(this.pc+((this.rb()<<24)>>24))&65535;return 12;}const e=(this.rb()<<24)>>24;if(this.cond(y-4)){this.pc=(this.pc+e)&65535;return 12;}return 8;}
        if(z===1){if(!q){this.setRP(p,this.rw());return 12;}this.addHL(this.getRP(p));return 8;}
        if(z===2){const a=[this.bc,this.de,this.hl,this.hl][p];if(!q)this.write(a,this.a);else this.a=this.read(a);if(p===2)this.hl=(this.hl+1)&65535;if(p===3)this.hl=(this.hl-1)&65535;return 8;}
        if(z===3){this.setRP(p,this.getRP(p)+(q?-1:1));return 8;}
        if(z===4){this.setR(y,this.inc(this.getR(y)));return y===6?12:4;}
        if(z===5){this.setR(y,this.dec(this.getR(y)));return y===6?12:4;}
        if(z===6){this.setR(y,this.rb());return y===6?12:8;}
        switch(y){case 0:{const c=this.a>>7;this.a=((this.a<<1)|c)&255;this.f=c?16:0;break;}case 1:{const c=this.a&1;this.a=(this.a>>1)|(c<<7);this.f=c?16:0;break;}case 2:{const c=this.a>>7;this.a=((this.a<<1)|(this.flag(16)?1:0))&255;this.f=c?16:0;break;}case 3:{const c=this.a&1;this.a=(this.a>>1)|(this.flag(16)?128:0);this.f=c?16:0;break;}case 4:this.daa();break;case 5:this.a^=255;this.f|=0x60;break;case 6:this.f=(this.f&0x80)|0x10;break;case 7:this.f=(this.f&0x80)|(this.flag(16)?0:16);break;}return 4;
      }
      if(x===1){if(y===6&&z===6){this.halted=true;return 4;}this.setR(y,this.getR(z));return y===6||z===6?8:4;}
      if(x===2){this.alu(y,this.getR(z));return z===6?8:4;}
      if(z===0){if(y<4){if(this.cond(y)){this.pc=this.pop();return 20;}return 8;}if(y===4){this.write(0xff00+this.rb(),this.a);return 12;}if(y===5){this.signedSP(this.rb(),false);return 16;}if(y===6){this.a=this.read(0xff00+this.rb());return 12;}this.signedSP(this.rb(),true);return 12;}
      if(z===1){if(!q){this.setRP(p,this.pop(),true);return 12;}switch(p){case 0:this.pc=this.pop();return 16;case 1:this.pc=this.pop();this.ime=true;return 16;case 2:this.pc=this.hl;return 4;case 3:this.sp=this.hl;return 8;}}
      if(z===2){if(y<4){const a=this.rw();if(this.cond(y)){this.pc=a;return 16;}return 12;}if(y===4){this.write(0xff00+this.c,this.a);return 8;}if(y===5){this.write(this.rw(),this.a);return 16;}if(y===6){this.a=this.read(0xff00+this.c);return 8;}this.a=this.read(this.rw());return 16;}
      if(z===3){if(y===0){this.pc=this.rw();return 16;}if(y===1)return this.cb(this.rb());if(y===6){this.ime=false;this.eiDelay=0;return 4;}if(y===7){this.eiDelay=2;return 4;}return 4;}
      if(z===4){if(y<4){const a=this.rw();if(this.cond(y)){this.push(this.pc);this.pc=a;return 24;}return 12;}return 4;}
      if(z===5){if(!q){this.push(this.getRP(p,true));return 16;}if(p===0){const a=this.rw();this.push(this.pc);this.pc=a;return 24;}return 4;}
      if(z===6){this.alu(y,this.rb());return 8;}
      this.push(this.pc);this.pc=y*8;return 16;
    }
    tick(c){
      this.cycles+=c;this.divCycles+=c;
      const tac=this.io[7]&7, enabled=tac&4, periods=[1024,16,64,256];
      if(enabled){this.timerCycles+=c;while(this.timerCycles>=periods[tac&3]){this.timerCycles-=periods[tac&3];if(this.io[5]===255){this.io[5]=this.io[6];this.io[15]|=4;}else this.io[5]=(this.io[5]+1)&255;}}
      if(this.io[0x40]&0x80){this.lcdCycles+=c;while(this.lcdCycles>=456){this.lcdCycles-=456;this.io[0x44]=(this.io[0x44]+1)%154;if(this.io[0x44]===144){this.io[15]|=1;this.frameReady=true;}if(this.io[0x44]===0)this.io[0x41]=(this.io[0x41]&0xfc)|2;}}
      this.frameCycles+=c;
    }
    render(){
      const lcdc=this.io[0x40], scy=this.io[0x42], scx=this.io[0x43], bgp=this.io[0x47];
      const color=(palette,n)=>((palette>>(n*2))&3);
      const bgMap=(lcdc&8)?0x1c00:0x1800, winMap=(lcdc&0x40)?0x1c00:0x1800;
      const bgColors=new Uint8Array(W*H);
      for(let y=0;y<H;y++)for(let x=0;x<W;x++){
        let n=0;
        if(lcdc&1){let px=(x+scx)&255,py=(y+scy)&255;
          if((lcdc&0x20)&&y>=this.io[0x4a]&&x>=this.io[0x4b]-7){px=x-(this.io[0x4b]-7);py=y-this.io[0x4a];const map=winMap+((py>>3)*32)+(px>>3);n=this.tilePixel(map,px&7,py&7,lcdc);}
          else {const map=bgMap+((py>>3)*32)+(px>>3);n=this.tilePixel(map,px&7,py&7,lcdc);}
        }
        bgColors[y*W+x]=n;const c=shades[color(bgp,n)];const i=(y*W+x)*4;image.data[i]=c[0];image.data[i+1]=c[1];image.data[i+2]=c[2];image.data[i+3]=255;
      }
      if(lcdc&2){let shown=0;for(let s=0;s<40&&shown<10;s++){const sy=this.oam[s*4]-16,sx=this.oam[s*4+1]-8,tile=this.oam[s*4+2],attr=this.oam[s*4+3],height=lcdc&4?16:8;if(sy+height<0||sy>=H)continue;shown++;
        for(let dy=0;dy<height;dy++){let py=dy;if(attr&0x40)py=height-1-dy;let ti=height===16?(tile&0xfe)+(py>>3):tile;const row=py&7,base=ti*16+row*2,lo=this.vram[base],hi=this.vram[base+1];
          for(let dx=0;dx<8;dx++){const px=sx+dx;if(px<0||px>=W)continue;const bit=attr&0x20?dx:7-dx,n=((hi>>bit)&1)*2+((lo>>bit)&1);if(!n)continue;if((attr&0x80)&&bgColors[(sy+dy)*W+px])continue;const pal=this.io[attr&0x10?0x49:0x48],col=shades[color(pal,n)],i=((sy+dy)*W+px)*4;image.data[i]=col[0];image.data[i+1]=col[1];image.data[i+2]=col[2];}
        }
      }}
      ctx.putImageData(image,0,0);
    }
    tilePixel(map,x,y,lcdc){const tile=this.vram[map&0x1fff];let base;if(lcdc&0x10)base=tile*16;else base=0x1000+((tile<<24)>>24)*16;const addr=base+y*2,bit=7-x;return ((this.vram[addr+1]>>bit)&1)*2+((this.vram[addr]>>bit)&1);}
    runFrame(){let c=0;while(c<FRAME_CYCLES){let n=this.step();this.tick(n);c+=n;if(this.eiDelay>0&&--this.eiDelay===0)this.ime=true;}this.render();}
  }

  let gb=null, raf=0, last=0, accumulator=0, paused=true;
  function loop(now){raf=requestAnimationFrame(loop);if(!gb||paused)return;if(!last)last=now;accumulator+=Math.min(now-last,100);last=now;const frameMs=1000/59.7;let count=0;while(accumulator>=frameMs&&count<3){gb.runFrame();accumulator-=frameMs;count++;}}
  raf=requestAnimationFrame(loop);
  fileInput.addEventListener('change',async e=>{
    const file=e.target.files&&e.target.files[0];if(!file)return;
    try{const data=await file.arrayBuffer();if(data.byteLength<0x150)throw new Error('That file is too small to be a Game Boy ROM.');
      gb=new GameBoy(data);paused=false;last=0;accumulator=0;pauseButton.disabled=false;resetButton.disabled=false;pauseButton.textContent='Pause';
      const title=Array.from(gb.rom.slice(0x134,0x144)).map(c=>c>=32&&c<127?String.fromCharCode(c):'').join('').trim();
      status.textContent=`Loaded ${file.name}${title?` (${title})`:''} · Use the keyboard to play.`;gb.render();
    }catch(err){status.textContent=err.message;}
  });
  pauseButton.addEventListener('click',()=>{if(!gb)return;paused=!paused;last=0;pauseButton.textContent=paused?'Resume':'Pause';status.textContent=paused?'Paused.':'Running.';});
  resetButton.addEventListener('click',()=>{if(!gb)return;const rom=gb.rom;gb=new GameBoy(rom);paused=false;last=0;status.textContent='Game reset.';});
  const keyMap={ArrowUp:1,ArrowDown:1,ArrowLeft:1,ArrowRight:1,KeyZ:1,KeyX:1,Enter:1,ShiftLeft:1,ShiftRight:1};
  addEventListener('keydown',e=>{if(keyMap[e.code]&&gb){e.preventDefault();gb.keys.add(e.code);gb.io[15]|=0x10;}});
  addEventListener('keyup',e=>{if(keyMap[e.code]&&gb){e.preventDefault();gb.keys.delete(e.code);}});
})();
