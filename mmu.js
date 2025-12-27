// Memory Management Unit with MBC1 support
export class MMU {
    constructor() {
        this.reset();
    }

    reset() {
        // ROM banks (loaded from cartridge)
        this.rom = null;
        this.romBanks = 0;

        // RAM
        this.vram = new Uint8Array(0x2000);      // 8KB Video RAM
        this.eram = new Uint8Array(0x8000);      // 32KB External RAM (max for MBC1)
        this.wram = new Uint8Array(0x2000);      // 8KB Work RAM
        this.oam = new Uint8Array(0xA0);         // 160 bytes OAM
        this.hram = new Uint8Array(0x7F);        // 127 bytes High RAM
        this.io = new Uint8Array(0x80);          // I/O Registers

        // Interrupt registers
        this.ie = 0;  // Interrupt Enable (0xFFFF)

        // MBC1 state
        this.mbcType = 0;        // 0 = ROM only, 1 = MBC1
        this.romBank = 1;        // Current ROM bank (1-127)
        this.ramBank = 0;        // Current RAM bank (0-3)
        this.ramEnabled = false; // RAM enable flag
        this.mbcMode = 0;        // 0 = ROM mode, 1 = RAM mode

        // References to other components (set by emulator)
        this.ppu = null;
        this.timer = null;
        this.input = null;
        this.apu = null;

        // Initialize I/O registers to boot values
        this.initIO();
    }

    initIO() {
        // Set initial I/O register values (after boot ROM)
        this.io[0x00] = 0xCF; // P1 - Joypad
        this.io[0x01] = 0x00; // SB - Serial transfer data
        this.io[0x02] = 0x7E; // SC - Serial transfer control
        this.io[0x04] = 0xAB; // DIV - Divider register
        this.io[0x05] = 0x00; // TIMA - Timer counter
        this.io[0x06] = 0x00; // TMA - Timer modulo
        this.io[0x07] = 0xF8; // TAC - Timer control
        this.io[0x0F] = 0xE1; // IF - Interrupt flag
        this.io[0x10] = 0x80; // NR10
        this.io[0x11] = 0xBF; // NR11
        this.io[0x12] = 0xF3; // NR12
        this.io[0x13] = 0xFF; // NR13
        this.io[0x14] = 0xBF; // NR14
        this.io[0x16] = 0x3F; // NR21
        this.io[0x17] = 0x00; // NR22
        this.io[0x18] = 0xFF; // NR23
        this.io[0x19] = 0xBF; // NR24
        this.io[0x1A] = 0x7F; // NR30
        this.io[0x1B] = 0xFF; // NR31
        this.io[0x1C] = 0x9F; // NR32
        this.io[0x1D] = 0xFF; // NR33
        this.io[0x1E] = 0xBF; // NR34
        this.io[0x20] = 0xFF; // NR41
        this.io[0x21] = 0x00; // NR42
        this.io[0x22] = 0x00; // NR43
        this.io[0x23] = 0xBF; // NR44
        this.io[0x24] = 0x77; // NR50
        this.io[0x25] = 0xF3; // NR51
        this.io[0x26] = 0xF1; // NR52
        this.io[0x40] = 0x91; // LCDC
        this.io[0x41] = 0x85; // STAT
        this.io[0x42] = 0x00; // SCY
        this.io[0x43] = 0x00; // SCX
        this.io[0x44] = 0x00; // LY
        this.io[0x45] = 0x00; // LYC
        this.io[0x46] = 0xFF; // DMA
        this.io[0x47] = 0xFC; // BGP
        this.io[0x48] = 0xFF; // OBP0
        this.io[0x49] = 0xFF; // OBP1
        this.io[0x4A] = 0x00; // WY
        this.io[0x4B] = 0x00; // WX
    }

    loadROM(data) {
        this.rom = data;

        // Detect cartridge type
        const cartType = data[0x147];
        if (cartType >= 0x01 && cartType <= 0x03) {
            this.mbcType = 1; // MBC1
        } else {
            this.mbcType = 0; // ROM only
        }

        // Calculate ROM banks
        const romSize = data[0x148];
        this.romBanks = 2 << romSize;

        console.log(`Loaded ROM: ${data.length} bytes, ${this.romBanks} banks, MBC type: ${this.mbcType}`);
    }

    read(addr) {
        addr &= 0xFFFF;

        // ROM Bank 0 (0x0000-0x3FFF)
        if (addr < 0x4000) {
            if (!this.rom) return 0xFF;
            if (this.mbcType === 1 && this.mbcMode === 1) {
                // In RAM mode, bank 0 can be 0x00, 0x20, 0x40, or 0x60
                const bank = (this.ramBank << 5) % this.romBanks;
                const romAddr = bank * 0x4000 + addr;
                return romAddr < this.rom.length ? this.rom[romAddr] : 0xFF;
            }
            return addr < this.rom.length ? this.rom[addr] : 0xFF;
        }

        // Switchable ROM Bank (0x4000-0x7FFF)
        if (addr < 0x8000) {
            if (!this.rom) return 0xFF;
            let bank = this.romBank;
            if (this.mbcType === 1) {
                bank = ((this.ramBank << 5) | this.romBank) % this.romBanks;
            }
            const romAddr = bank * 0x4000 + (addr - 0x4000);
            return romAddr < this.rom.length ? this.rom[romAddr] : 0xFF;
        }

        // Video RAM (0x8000-0x9FFF)
        if (addr < 0xA000) {
            return this.vram[addr - 0x8000];
        }

        // External RAM (0xA000-0xBFFF)
        if (addr < 0xC000) {
            if (!this.ramEnabled) return 0xFF;
            const ramAddr = this.mbcMode === 1
                ? this.ramBank * 0x2000 + (addr - 0xA000)
                : addr - 0xA000;
            return this.eram[ramAddr];
        }

        // Work RAM (0xC000-0xDFFF)
        if (addr < 0xE000) {
            return this.wram[addr - 0xC000];
        }

        // Echo RAM (0xE000-0xFDFF) - mirror of C000-DDFF
        if (addr < 0xFE00) {
            return this.wram[addr - 0xE000];
        }

        // OAM (0xFE00-0xFE9F)
        if (addr < 0xFEA0) {
            return this.oam[addr - 0xFE00];
        }

        // Unusable (0xFEA0-0xFEFF)
        if (addr < 0xFF00) {
            return 0xFF;
        }

        // I/O Registers (0xFF00-0xFF7F)
        if (addr < 0xFF80) {
            return this.readIO(addr);
        }

        // High RAM (0xFF80-0xFFFE)
        if (addr < 0xFFFF) {
            return this.hram[addr - 0xFF80];
        }

        // Interrupt Enable (0xFFFF)
        return this.ie;
    }

    write(addr, value) {
        addr &= 0xFFFF;
        value &= 0xFF;

        // MBC1 control registers (0x0000-0x7FFF)
        if (addr < 0x2000) {
            // RAM Enable
            this.ramEnabled = (value & 0x0F) === 0x0A;
            return;
        }

        if (addr < 0x4000) {
            // ROM Bank Number (lower 5 bits)
            let bank = value & 0x1F;
            if (bank === 0) bank = 1;
            this.romBank = bank;
            return;
        }

        if (addr < 0x6000) {
            // RAM Bank Number / Upper ROM Bank bits
            this.ramBank = value & 0x03;
            return;
        }

        if (addr < 0x8000) {
            // Banking Mode Select
            this.mbcMode = value & 0x01;
            return;
        }

        // Video RAM (0x8000-0x9FFF)
        if (addr < 0xA000) {
            this.vram[addr - 0x8000] = value;
            return;
        }

        // External RAM (0xA000-0xBFFF)
        if (addr < 0xC000) {
            if (!this.ramEnabled) return;
            const ramAddr = this.mbcMode === 1
                ? this.ramBank * 0x2000 + (addr - 0xA000)
                : addr - 0xA000;
            this.eram[ramAddr] = value;
            return;
        }

        // Work RAM (0xC000-0xDFFF)
        if (addr < 0xE000) {
            this.wram[addr - 0xC000] = value;
            return;
        }

        // Echo RAM (0xE000-0xFDFF)
        if (addr < 0xFE00) {
            this.wram[addr - 0xE000] = value;
            return;
        }

        // OAM (0xFE00-0xFE9F)
        if (addr < 0xFEA0) {
            this.oam[addr - 0xFE00] = value;
            return;
        }

        // Unusable (0xFEA0-0xFEFF)
        if (addr < 0xFF00) {
            return;
        }

        // I/O Registers (0xFF00-0xFF7F)
        if (addr < 0xFF80) {
            this.writeIO(addr, value);
            return;
        }

        // High RAM (0xFF80-0xFFFE)
        if (addr < 0xFFFF) {
            this.hram[addr - 0xFF80] = value;
            return;
        }

        // Interrupt Enable (0xFFFF)
        this.ie = value;
    }

    readIO(addr) {
        const reg = addr & 0x7F;

        switch (addr) {
            case 0xFF00: // P1 - Joypad
                return this.input ? this.input.read() : 0xFF;

            case 0xFF04: // DIV
                return this.timer ? this.timer.div : this.io[reg];

            case 0xFF05: // TIMA
                return this.timer ? this.timer.tima : this.io[reg];

            case 0xFF06: // TMA
                return this.timer ? this.timer.tma : this.io[reg];

            case 0xFF07: // TAC
                return this.timer ? (this.timer.tac | 0xF8) : this.io[reg];

            case 0xFF0F: // IF - Interrupt Flag
                return this.io[reg] | 0xE0;

            case 0xFF40: // LCDC
            case 0xFF41: // STAT
            case 0xFF42: // SCY
            case 0xFF43: // SCX
            case 0xFF44: // LY
            case 0xFF45: // LYC
            case 0xFF47: // BGP
            case 0xFF48: // OBP0
            case 0xFF49: // OBP1
            case 0xFF4A: // WY
            case 0xFF4B: // WX
                return this.ppu ? this.ppu.readRegister(addr) : this.io[reg];

            default:
                // Audio registers (0xFF10-0xFF3F)
                if (addr >= 0xFF10 && addr <= 0xFF3F) {
                    return this.apu ? this.apu.readRegister(addr) : this.io[reg];
                }
                return this.io[reg];
        }
    }

    writeIO(addr, value) {
        const reg = addr & 0x7F;

        switch (addr) {
            case 0xFF00: // P1 - Joypad
                if (this.input) this.input.write(value);
                this.io[reg] = value;
                break;

            case 0xFF04: // DIV - Writing resets to 0
                if (this.timer) this.timer.div = 0;
                this.io[reg] = 0;
                break;

            case 0xFF05: // TIMA
                if (this.timer) this.timer.tima = value;
                this.io[reg] = value;
                break;

            case 0xFF06: // TMA
                if (this.timer) this.timer.tma = value;
                this.io[reg] = value;
                break;

            case 0xFF07: // TAC
                if (this.timer) this.timer.tac = value & 0x07;
                this.io[reg] = value;
                break;

            case 0xFF0F: // IF - Interrupt Flag
                this.io[reg] = value & 0x1F;
                break;

            case 0xFF40: // LCDC
            case 0xFF41: // STAT
            case 0xFF42: // SCY
            case 0xFF43: // SCX
            case 0xFF45: // LYC
            case 0xFF46: // DMA Transfer
                if (addr === 0xFF46) {
                    this.dmaTransfer(value);
                }
                if (this.ppu) this.ppu.writeRegister(addr, value);
                this.io[reg] = value;
                break;

            case 0xFF47: // BGP
            case 0xFF48: // OBP0
            case 0xFF49: // OBP1
            case 0xFF4A: // WY
            case 0xFF4B: // WX
                if (this.ppu) this.ppu.writeRegister(addr, value);
                this.io[reg] = value;
                break;

            default:
                // Audio registers (0xFF10-0xFF3F)
                if (addr >= 0xFF10 && addr <= 0xFF3F) {
                    if (this.apu) this.apu.writeRegister(addr, value);
                }
                this.io[reg] = value;
        }
    }

    dmaTransfer(value) {
        // DMA transfers 160 bytes from XX00-XX9F to OAM
        const source = value << 8;
        for (let i = 0; i < 0xA0; i++) {
            this.oam[i] = this.read(source + i);
        }
    }

    // Read 16-bit value (little endian)
    read16(addr) {
        return this.read(addr) | (this.read(addr + 1) << 8);
    }

    // Write 16-bit value (little endian)
    write16(addr, value) {
        this.write(addr, value & 0xFF);
        this.write(addr + 1, (value >> 8) & 0xFF);
    }
}
