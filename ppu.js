// Picture Processing Unit (PPU)
export class PPU {
    constructor(mmu, ctx) {
        this.mmu = mmu;
        this.ctx = ctx;

        // Create ImageData for the screen (160x144)
        this.imageData = ctx.createImageData(160, 144);
        // Use Uint32Array view on imageData for fast pixel writes
        this.imageData32 = new Uint32Array(this.imageData.data.buffer);
        this.frameBuffer = new Uint32Array(160 * 144);

        // Color palette (classic green) - ABGR format for Uint32Array on little-endian
        this.colors = [
            0xFF0FBC9B, // Lightest (off)
            0xFF0FAC8B, // Light
            0xFF306230, // Dark
            0xFF0F380F  // Darkest (on)
        ];

        this.reset();
    }

    reset() {
        // LCD Control register (0xFF40)
        this.lcdc = 0x91;

        // LCD Status register (0xFF41)
        this.stat = 0x85;

        // Position registers
        this.scy = 0;  // Scroll Y
        this.scx = 0;  // Scroll X
        this.ly = 0;   // Current scanline
        this.lyc = 0;  // LY Compare
        this.wy = 0;   // Window Y
        this.wx = 0;   // Window X

        // Palette registers
        this.bgp = 0xFC;   // Background palette
        this.obp0 = 0xFF;  // Object palette 0
        this.obp1 = 0xFF;  // Object palette 1

        // Internal state
        this.mode = 2;      // Current PPU mode
        this.modeCycles = 0; // Cycles in current mode
        this.windowLine = 0; // Internal window line counter

        // Frame buffer
        this.frameBuffer.fill(this.colors[0]);
    }

    // Read PPU register
    readRegister(addr) {
        switch (addr) {
            case 0xFF40: return this.lcdc;
            case 0xFF41: return (this.stat & 0xFC) | (this.ly === this.lyc ? 0x04 : 0) | this.mode;
            case 0xFF42: return this.scy;
            case 0xFF43: return this.scx;
            case 0xFF44: return this.ly;
            case 0xFF45: return this.lyc;
            case 0xFF47: return this.bgp;
            case 0xFF48: return this.obp0;
            case 0xFF49: return this.obp1;
            case 0xFF4A: return this.wy;
            case 0xFF4B: return this.wx;
            default: return 0xFF;
        }
    }

    // Write PPU register
    writeRegister(addr, value) {
        switch (addr) {
            case 0xFF40:
                const wasEnabled = (this.lcdc & 0x80) !== 0;
                this.lcdc = value;
                const isEnabled = (value & 0x80) !== 0;
                if (wasEnabled && !isEnabled) {
                    // LCD turned off
                    this.ly = 0;
                    this.mode = 0;
                    this.modeCycles = 0;
                }
                break;
            case 0xFF41:
                this.stat = (value & 0xF8) | (this.stat & 0x07);
                break;
            case 0xFF42: this.scy = value; break;
            case 0xFF43: this.scx = value; break;
            case 0xFF45: this.lyc = value; break;
            case 0xFF47: this.bgp = value; break;
            case 0xFF48: this.obp0 = value; break;
            case 0xFF49: this.obp1 = value; break;
            case 0xFF4A: this.wy = value; break;
            case 0xFF4B: this.wx = value; break;
        }
    }

    // Step PPU by given cycles
    step(cycles) {
        // LCD disabled
        if ((this.lcdc & 0x80) === 0) {
            return false;
        }

        this.modeCycles += cycles;
        let frameComplete = false;

        switch (this.mode) {
            case 2: // OAM Scan (80 cycles)
                if (this.modeCycles >= 80) {
                    this.modeCycles -= 80;
                    this.mode = 3;
                }
                break;

            case 3: // Pixel Transfer (172 cycles)
                if (this.modeCycles >= 172) {
                    this.modeCycles -= 172;
                    this.mode = 0;

                    // Render the scanline
                    this.renderScanline();

                    // H-Blank interrupt
                    if (this.stat & 0x08) {
                        this.mmu.io[0x0F] |= 0x02; // LCD STAT interrupt
                    }
                }
                break;

            case 0: // H-Blank (204 cycles)
                if (this.modeCycles >= 204) {
                    this.modeCycles -= 204;
                    this.ly++;

                    // Check LY=LYC
                    if (this.ly === this.lyc && (this.stat & 0x40)) {
                        this.mmu.io[0x0F] |= 0x02; // LCD STAT interrupt
                    }

                    if (this.ly === 144) {
                        // Enter V-Blank
                        this.mode = 1;
                        this.mmu.io[0x0F] |= 0x01; // V-Blank interrupt

                        // V-Blank STAT interrupt
                        if (this.stat & 0x10) {
                            this.mmu.io[0x0F] |= 0x02;
                        }

                        // Render frame
                        this.renderFrame();
                        frameComplete = true;
                    } else {
                        this.mode = 2;
                        // OAM STAT interrupt
                        if (this.stat & 0x20) {
                            this.mmu.io[0x0F] |= 0x02;
                        }
                    }
                }
                break;

            case 1: // V-Blank (4560 cycles total, 456 per line, 10 lines)
                if (this.modeCycles >= 456) {
                    this.modeCycles -= 456;
                    this.ly++;

                    // Check LY=LYC
                    if (this.ly === this.lyc && (this.stat & 0x40)) {
                        this.mmu.io[0x0F] |= 0x02;
                    }

                    if (this.ly > 153) {
                        // End of V-Blank
                        this.ly = 0;
                        this.windowLine = 0;
                        this.mode = 2;

                        // OAM STAT interrupt
                        if (this.stat & 0x20) {
                            this.mmu.io[0x0F] |= 0x02;
                        }

                        // Check LY=LYC for line 0
                        if (this.lyc === 0 && (this.stat & 0x40)) {
                            this.mmu.io[0x0F] |= 0x02;
                        }
                    }
                }
                break;
        }

        return frameComplete;
    }

    // Render a single scanline
    renderScanline() {
        const line = this.ly;
        if (line >= 144) return;

        const lineOffset = line * 160;

        // Clear scanline to background color
        const bgColor = this.colors[this.bgp & 0x03];
        for (let x = 0; x < 160; x++) {
            this.frameBuffer[lineOffset + x] = bgColor;
        }

        // Render background
        if (this.lcdc & 0x01) {
            this.renderBackground(line);
        }

        // Render window
        if ((this.lcdc & 0x20) && (this.lcdc & 0x01)) {
            this.renderWindow(line);
        }

        // Render sprites
        if (this.lcdc & 0x02) {
            this.renderSprites(line);
        }
    }

    // Render background for a scanline
    renderBackground(line) {
        const tileData = (this.lcdc & 0x10) ? 0x8000 : 0x8800;
        const tileMapBase = (this.lcdc & 0x08) ? 0x9C00 : 0x9800;
        const signed = tileData === 0x8800;
        const vram = this.mmu.vram;
        const bgp = this.bgp;
        const colors = this.colors;
        const frameBuffer = this.frameBuffer;

        const y = (line + this.scy) & 0xFF;
        const tileRow = (y >> 3) & 0x1F;
        const tileY = y & 7;
        const tileMapRow = tileMapBase + tileRow * 32 - 0x8000;

        const lineOffset = line * 160;
        let x = 0;

        // Handle first partial tile (if scrolled)
        const startTileX = this.scx & 7;
        if (startTileX !== 0) {
            const tileCol = (this.scx >> 3) & 0x1F;
            const tileNum = vram[tileMapRow + tileCol];
            const tileDataAddr = signed
                ? 0x9000 + ((tileNum << 24) >> 24) * 16
                : tileData + tileNum * 16;
            const addr = tileDataAddr + tileY * 2 - 0x8000;
            const lo = vram[addr];
            const hi = vram[addr + 1];

            for (let tileX = startTileX; tileX < 8 && x < 160; tileX++, x++) {
                const bit = 7 - tileX;
                const colorId = ((lo >> bit) & 1) | (((hi >> bit) & 1) << 1);
                frameBuffer[lineOffset + x] = colors[(bgp >> (colorId * 2)) & 0x03];
            }
        }

        // Render full tiles
        while (x <= 152) {
            const scrolledX = (x + this.scx) & 0xFF;
            const tileCol = (scrolledX >> 3) & 0x1F;
            const tileNum = vram[tileMapRow + tileCol];
            const tileDataAddr = signed
                ? 0x9000 + ((tileNum << 24) >> 24) * 16
                : tileData + tileNum * 16;
            const addr = tileDataAddr + tileY * 2 - 0x8000;
            const lo = vram[addr];
            const hi = vram[addr + 1];

            // Unrolled loop for 8 pixels
            frameBuffer[lineOffset + x] = colors[(bgp >> ((((lo >> 7) & 1) | (((hi >> 7) & 1) << 1)) * 2)) & 0x03]; x++;
            frameBuffer[lineOffset + x] = colors[(bgp >> ((((lo >> 6) & 1) | (((hi >> 6) & 1) << 1)) * 2)) & 0x03]; x++;
            frameBuffer[lineOffset + x] = colors[(bgp >> ((((lo >> 5) & 1) | (((hi >> 5) & 1) << 1)) * 2)) & 0x03]; x++;
            frameBuffer[lineOffset + x] = colors[(bgp >> ((((lo >> 4) & 1) | (((hi >> 4) & 1) << 1)) * 2)) & 0x03]; x++;
            frameBuffer[lineOffset + x] = colors[(bgp >> ((((lo >> 3) & 1) | (((hi >> 3) & 1) << 1)) * 2)) & 0x03]; x++;
            frameBuffer[lineOffset + x] = colors[(bgp >> ((((lo >> 2) & 1) | (((hi >> 2) & 1) << 1)) * 2)) & 0x03]; x++;
            frameBuffer[lineOffset + x] = colors[(bgp >> ((((lo >> 1) & 1) | (((hi >> 1) & 1) << 1)) * 2)) & 0x03]; x++;
            frameBuffer[lineOffset + x] = colors[(bgp >> (((lo & 1) | ((hi & 1) << 1)) * 2)) & 0x03]; x++;
        }

        // Handle last partial tile
        while (x < 160) {
            const scrolledX = (x + this.scx) & 0xFF;
            const tileCol = (scrolledX >> 3) & 0x1F;
            const tileX = scrolledX & 7;
            const tileNum = vram[tileMapRow + tileCol];
            const tileDataAddr = signed
                ? 0x9000 + ((tileNum << 24) >> 24) * 16
                : tileData + tileNum * 16;
            const addr = tileDataAddr + tileY * 2 - 0x8000;
            const lo = vram[addr];
            const hi = vram[addr + 1];
            const bit = 7 - tileX;
            const colorId = ((lo >> bit) & 1) | (((hi >> bit) & 1) << 1);
            frameBuffer[lineOffset + x] = colors[(bgp >> (colorId * 2)) & 0x03];
            x++;
        }
    }

    // Render window for a scanline
    renderWindow(line) {
        if (this.wy > line || this.wx > 166) return;

        const tileData = (this.lcdc & 0x10) ? 0x8000 : 0x8800;
        const tileMap = (this.lcdc & 0x40) ? 0x9C00 : 0x9800;
        const signed = tileData === 0x8800;

        const windowY = this.windowLine;
        const tileRow = (windowY >> 3) & 0x1F;
        const tileY = windowY & 7;

        const lineOffset = line * 160;
        const startX = Math.max(0, this.wx - 7);
        let rendered = false;

        for (let x = startX; x < 160; x++) {
            const windowX = x - (this.wx - 7);
            if (windowX < 0) continue;

            rendered = true;
            const tileCol = (windowX >> 3) & 0x1F;
            const tileX = windowX & 7;

            // Get tile number
            const tileAddr = tileMap + tileRow * 32 + tileCol;
            let tileNum = this.mmu.vram[tileAddr - 0x8000];

            // Calculate tile data address
            let tileDataAddr;
            if (signed) {
                tileDataAddr = 0x9000 + ((tileNum << 24) >> 24) * 16;
            } else {
                tileDataAddr = tileData + tileNum * 16;
            }

            // Get pixel color
            const colorId = this.getTilePixel(tileDataAddr, tileX, tileY);
            const color = (this.bgp >> (colorId * 2)) & 0x03;

            this.frameBuffer[lineOffset + x] = this.colors[color];
        }

        if (rendered) {
            this.windowLine++;
        }
    }

    // Render sprites for a scanline
    renderSprites(line) {
        const spriteHeight = (this.lcdc & 0x04) ? 16 : 8;
        const sprites = [];

        // Collect sprites on this line (max 10)
        for (let i = 0; i < 40 && sprites.length < 10; i++) {
            const addr = i * 4;
            const y = this.mmu.oam[addr] - 16;
            const x = this.mmu.oam[addr + 1] - 8;

            if (line >= y && line < y + spriteHeight) {
                sprites.push({
                    y: y,
                    x: x,
                    tile: this.mmu.oam[addr + 2],
                    flags: this.mmu.oam[addr + 3],
                    index: i
                });
            }
        }

        // Sort by X coordinate (lower X = higher priority)
        sprites.sort((a, b) => {
            if (a.x !== b.x) return a.x - b.x;
            return a.index - b.index;
        });

        // Render sprites in reverse order (lower priority first)
        const lineOffset = line * 160;
        for (let i = sprites.length - 1; i >= 0; i--) {
            const sprite = sprites[i];
            const palette = (sprite.flags & 0x10) ? this.obp1 : this.obp0;
            const flipX = (sprite.flags & 0x20) !== 0;
            const flipY = (sprite.flags & 0x40) !== 0;
            const priority = (sprite.flags & 0x80) !== 0;

            let tileNum = sprite.tile;
            if (spriteHeight === 16) {
                tileNum &= 0xFE; // Ignore bit 0 for 8x16 sprites
            }

            let tileY = line - sprite.y;
            if (flipY) {
                tileY = spriteHeight - 1 - tileY;
            }

            // Handle 8x16 sprites
            if (tileY >= 8) {
                tileNum++;
                tileY -= 8;
            }

            const tileAddr = 0x8000 + tileNum * 16;

            for (let tileX = 0; tileX < 8; tileX++) {
                const x = sprite.x + tileX;
                if (x < 0 || x >= 160) continue;

                const actualTileX = flipX ? (7 - tileX) : tileX;
                const colorId = this.getTilePixel(tileAddr, actualTileX, tileY);

                // Color 0 is transparent for sprites
                if (colorId === 0) continue;

                // Check background priority
                if (priority) {
                    const bgColorId = this.bgp & 0x03;
                    const currentColor = this.frameBuffer[lineOffset + x];
                    if (currentColor !== this.colors[bgColorId]) continue;
                }

                const color = (palette >> (colorId * 2)) & 0x03;
                this.frameBuffer[lineOffset + x] = this.colors[color];
            }
        }
    }

    // Get pixel color from tile data
    getTilePixel(tileAddr, x, y) {
        const addr = tileAddr + y * 2 - 0x8000;
        const lo = this.mmu.vram[addr];
        const hi = this.mmu.vram[addr + 1];
        const bit = 7 - x;
        return ((lo >> bit) & 1) | (((hi >> bit) & 1) << 1);
    }

    // Render the frame to canvas
    renderFrame() {
        // Direct copy using Uint32Array view - much faster than per-pixel
        this.imageData32.set(this.frameBuffer);
        this.ctx.putImageData(this.imageData, 0, 0);
    }
}
