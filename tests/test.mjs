// Node.js test script for debugging the emulator
import { readFileSync } from 'fs';
import { MMU } from '../src/mmu.js';
import { CPU } from '../src/cpu.js';
import { Timer } from '../src/timer.js';
import { PPU } from '../src/ppu.js';

// Create mock canvas context
const mockCtx = {
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    putImageData: () => {}
};

// Load ROM
const romData = readFileSync('../roms/tetris.gb');
const rom = new Uint8Array(romData);

console.log('ROM size:', rom.length, 'bytes');
console.log('ROM title:', getROMTitle(rom));

function getROMTitle(data) {
    let title = '';
    for (let i = 0x134; i < 0x144; i++) {
        const char = data[i];
        if (char === 0) break;
        title += String.fromCharCode(char);
    }
    return title || 'Unknown';
}

// Create components
const mmu = new MMU();
const cpu = new CPU(mmu);
const timer = new Timer(mmu);
const ppu = new PPU(mmu, mockCtx);

// Wire up
mmu.timer = timer;
mmu.ppu = ppu;

// Load ROM
mmu.loadROM(rom);

console.log('\n--- Initial state ---');
console.log('PC:', cpu.pc.toString(16).padStart(4, '0'));
console.log('LCDC:', ppu.lcdc.toString(16).padStart(2, '0'));
console.log('LY:', ppu.ly);

// Run for multiple frames worth of cycles
const CYCLES_PER_FRAME = 70224;
const FRAMES_TO_RUN = 60; // Run 60 frames (1 second)

console.log(`\n--- Running ${FRAMES_TO_RUN} frames ---`);

let totalCycles = 0;
let frameCount = 0;

for (let frame = 0; frame < FRAMES_TO_RUN; frame++) {
    let frameCycles = 0;
    while (frameCycles < CYCLES_PER_FRAME) {
        const cycles = cpu.step();
        frameCycles += cycles;
        totalCycles += cycles;

        timer.step(cycles);
        const frameComplete = ppu.step(cycles);

        if (frameComplete) {
            frameCount++;
        }
    }

    // Log progress every 10 frames
    if ((frame + 1) % 10 === 0) {
        console.log(`Frame ${frame + 1}: PC=${cpu.pc.toString(16).padStart(4, '0')} LY=${ppu.ly} LCDC=${ppu.lcdc.toString(16)} halted=${cpu.halted}`);
    }
}

console.log(`\nTotal cycles: ${totalCycles}`);
console.log(`Frames completed: ${frameCount}`);

console.log('\n--- PPU State ---');
console.log('LCDC:', ppu.lcdc.toString(16).padStart(2, '0'), '(LCD:', (ppu.lcdc & 0x80) ? 'ON' : 'OFF', ')');
console.log('STAT:', ppu.stat.toString(16).padStart(2, '0'));
console.log('LY:', ppu.ly);
console.log('SCY:', ppu.scy, 'SCX:', ppu.scx);
console.log('WY:', ppu.wy, 'WX:', ppu.wx);
console.log('BGP:', ppu.bgp.toString(16).padStart(2, '0'));
console.log('OBP0:', ppu.obp0.toString(16).padStart(2, '0'));
console.log('OBP1:', ppu.obp1.toString(16).padStart(2, '0'));
console.log('Mode:', ppu.mode);

console.log('\n--- CPU State ---');
console.log('PC:', cpu.pc.toString(16).padStart(4, '0'));
console.log('SP:', cpu.sp.toString(16).padStart(4, '0'));
console.log('A:', cpu.a.toString(16).padStart(2, '0'));
console.log('BC:', cpu.bc.toString(16).padStart(4, '0'));
console.log('DE:', cpu.de.toString(16).padStart(4, '0'));
console.log('HL:', cpu.hl.toString(16).padStart(4, '0'));
console.log('Flags:', 'Z:', cpu.flagZ ? 1 : 0, 'N:', cpu.flagN ? 1 : 0, 'H:', cpu.flagH ? 1 : 0, 'C:', cpu.flagC ? 1 : 0);
console.log('IME:', cpu.ime);
console.log('Halted:', cpu.halted);
console.log('IE:', mmu.ie.toString(16).padStart(2, '0'));
console.log('IF:', mmu.io[0x0F].toString(16).padStart(2, '0'));

// Check VRAM for tile data
console.log('\n--- VRAM Analysis ---');
let nonZeroTiles = 0;
for (let tile = 0; tile < 384; tile++) {
    let hasData = false;
    for (let byte = 0; byte < 16; byte++) {
        if (mmu.vram[tile * 16 + byte] !== 0) {
            hasData = true;
            break;
        }
    }
    if (hasData) nonZeroTiles++;
}
console.log('Non-zero tiles in VRAM:', nonZeroTiles);

// Check tile map for non-zero entries
let nonZeroMap = 0;
for (let i = 0; i < 0x400; i++) {
    if (mmu.vram[0x1800 + i] !== 0) nonZeroMap++;
}
console.log('Non-zero entries in tile map 0 (0x9800):', nonZeroMap);

for (let i = 0; i < 0x400; i++) {
    if (mmu.vram[0x1C00 + i] !== 0) nonZeroMap++;
}
console.log('Non-zero entries in tile map 1 (0x9C00):', nonZeroMap);

// Sample of first few non-zero tiles
console.log('\n--- Sample tile data ---');
for (let tile = 0; tile < 10; tile++) {
    const addr = tile * 16;
    let data = [];
    for (let b = 0; b < 16; b++) {
        data.push(mmu.vram[addr + b].toString(16).padStart(2, '0'));
    }
    console.log(`Tile ${tile}: ${data.join(' ')}`);
}

// Check OAM for sprites
console.log('\n--- OAM (first 10 sprites) ---');
for (let i = 0; i < 10; i++) {
    const addr = i * 4;
    const y = mmu.oam[addr];
    const x = mmu.oam[addr + 1];
    const tile = mmu.oam[addr + 2];
    const flags = mmu.oam[addr + 3];
    if (y !== 0 || x !== 0) {
        console.log(`Sprite ${i}: Y=${y} X=${x} Tile=${tile} Flags=${flags.toString(16)}`);
    }
}

// Check frame buffer for non-default colors
const defaultColor = ppu.colors[0];
let nonDefaultPixels = 0;
for (let i = 0; i < ppu.frameBuffer.length; i++) {
    if (ppu.frameBuffer[i] !== defaultColor) {
        nonDefaultPixels++;
    }
}
console.log('\n--- Frame buffer ---');
console.log('Non-default color pixels:', nonDefaultPixels, '/', ppu.frameBuffer.length);
