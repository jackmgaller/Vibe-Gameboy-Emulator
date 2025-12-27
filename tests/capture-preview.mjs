// Capture a frame from Super Mario Land for palette preview
import { readFileSync, writeFileSync } from 'fs';
import { MMU } from '../src/mmu.js';
import { CPU } from '../src/cpu.js';
import { Timer } from '../src/timer.js';
import { PPU } from '../src/ppu.js';
import { Input } from '../src/input.js';

// Create mock canvas context
const mockCtx = {
    createImageData: (w, h) => ({
        data: new Uint8ClampedArray(w * h * 4),
        width: w,
        height: h
    }),
    putImageData: () => {}
};

// Load Super Mario Land ROM
const romData = readFileSync('../roms/Super Mario Land.gb');
const rom = new Uint8Array(romData);
console.log('Loaded ROM:', rom.length, 'bytes');

// Create components
const mmu = new MMU();
const cpu = new CPU(mmu);
const timer = new Timer(mmu);
const ppu = new PPU(mmu, mockCtx);
const input = new Input(mmu);

// Wire up
mmu.timer = timer;
mmu.ppu = ppu;
mmu.input = input;

// Load ROM
mmu.loadROM(rom);

// Classic GB palette colors (ABGR format)
const classicColors = [
    0xFF0FBC9B, // Lightest (index 0)
    0xFF0FAC8B, // Light (index 1)
    0xFF306230, // Dark (index 2)
    0xFF0F380F  // Darkest (index 3)
];

// Run for ~5 seconds (300 frames at 60fps)
const CYCLES_PER_FRAME = 70224;
const FRAMES_TO_RUN = 300;

console.log(`Running ${FRAMES_TO_RUN} frames...`);

for (let frame = 0; frame < FRAMES_TO_RUN; frame++) {
    let frameCycles = 0;
    while (frameCycles < CYCLES_PER_FRAME) {
        const cycles = cpu.step();
        frameCycles += cycles;
        timer.step(cycles);
        ppu.step(cycles);
    }

    if (frame % 60 === 0) {
        console.log(`Frame ${frame}...`);
    }
}

console.log('Capture complete!');

// Convert frame buffer (ABGR colors) back to color indices
const frameBuffer = ppu.frameBuffer;
const indices = new Uint8Array(160 * 144);

for (let i = 0; i < frameBuffer.length; i++) {
    const color = frameBuffer[i];
    // Find matching color index
    let index = 0;
    for (let c = 0; c < 4; c++) {
        if (classicColors[c] === color) {
            index = c;
            break;
        }
    }
    indices[i] = index;
}

// Count color usage
const counts = [0, 0, 0, 0];
for (let i = 0; i < indices.length; i++) {
    counts[indices[i]]++;
}
console.log('Color usage:', counts);

// Output as JavaScript array (compressed using RLE)
function compressRLE(data) {
    const result = [];
    let i = 0;
    while (i < data.length) {
        const value = data[i];
        let count = 1;
        while (i + count < data.length && data[i + count] === value && count < 255) {
            count++;
        }
        if (count > 2) {
            // RLE: [255, count, value]
            result.push(255, count, value);
        } else {
            // Raw values (but escape 255)
            for (let j = 0; j < count; j++) {
                if (value === 255) {
                    result.push(255, 1, 255);
                } else {
                    result.push(value);
                }
            }
        }
        i += count;
    }
    return result;
}

const compressed = compressRLE(indices);
console.log(`Compressed: ${indices.length} -> ${compressed.length} bytes`);

// Output as base64 for easy embedding
const base64 = Buffer.from(compressed).toString('base64');
console.log('\n// Paste this into index.html:');
console.log(`const previewDataCompressed = "${base64}";`);

// Also output raw for verification
writeFileSync('preview-data.json', JSON.stringify({
    width: 160,
    height: 144,
    compressed: Array.from(compressed),
    base64: base64
}, null, 2));

console.log('\nSaved to preview-data.json');
