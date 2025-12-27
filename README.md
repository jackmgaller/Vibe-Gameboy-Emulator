# GameBoy Emulator

A GameBoy (DMG) emulator written in JavaScript that runs in the browser.

## Features

- Full CPU emulation (Sharp LR35902)
- PPU with background, window, and sprite rendering
- Audio with all 4 channels (square, wave, noise)
- Multiple memory bank controllers
- Keyboard input

## Supported Mappers

| Mapper | Cart Types | Max ROM | Max RAM | Example Games |
|--------|-----------|---------|---------|---------------|
| ROM only | 0x00 | 32KB | - | Tetris |
| MBC1 | 0x01-0x03 | 2MB | 32KB | Zelda, Pokemon Red/Blue |
| MBC3 | 0x0F-0x13 | 2MB | 32KB | Pokemon Gold/Silver (with RTC) |
| MBC5 | 0x19-0x1E | 8MB | 128KB | Pokemon Yellow, Wario Land 3 |

## Controls

| Key | Button |
|-----|--------|
| Arrow Keys | D-Pad |
| Z | A |
| X | B |
| Enter | Start |
| Shift | Select |
| Tab | Next palette |
| Shift+Tab | Previous palette |

## Color Palettes

The emulator includes 28 custom color palettes organized into themed categories:

| Category | Palettes |
|----------|----------|
| Default | Classic Green |
| Nature | Oceanic, Volcano, Desert |
| Seasons | Autumn, Winter, Spring, Summer |
| Zodiac | Libra, Gemini, Aries, Pisces, Aquarius |
| Elements | Carbon, Uranium, Oxygen, Titanium, Gold, Platinum |
| Fantasy Metals | Cobalt Blue, Mythril Green, Adamantium Red |
| Japanese Cities | Tokyo, Kyoto, Osaka, Sapporo |
| Films | In The Mood For Love, Back to the Future, Blade Runner |

Use the dropdown menu or press Tab to cycle through palettes in real-time.

## Running

1. Open `index.html` in a modern browser
2. Click "Select ROM File" and choose a `.gb` file
3. The emulator will start automatically

## Project Structure

```
├── index.html          # Main HTML file
├── src/
│   ├── emulator.js     # Main emulator coordinator
│   ├── cpu.js          # CPU emulation
│   ├── mmu.js          # Memory and bank controllers
│   ├── ppu.js          # Graphics rendering
│   ├── apu.js          # Audio emulation
│   ├── timer.js        # Timer registers
│   ├── input.js        # Joypad input
│   ├── opcodes.js      # CPU instruction definitions
│   └── palettes.js     # Color palette definitions
├── tests/              # Test scripts (Node.js)
└── roms/               # ROM files (not included)
```

## Technical Details

- Native resolution: 160x144
- CPU clock: 4.194304 MHz
- Frame rate: ~59.7 FPS
- Audio sample rate: 44.1 kHz

## Browser Requirements

- Modern browser with ES6 module support
- Web Audio API support
