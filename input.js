// GameBoy Input Handler
export class Input {
    constructor(mmu) {
        this.mmu = mmu;

        // Button states (active low)
        this.buttons = 0x0F;    // A, B, Select, Start
        this.directions = 0x0F; // Right, Left, Up, Down

        // P1 register state
        this.p1 = 0xFF;

        // Set up keyboard listeners
        this.setupKeyboard();
    }

    setupKeyboard() {
        // Only set up keyboard if we're in a browser
        if (typeof document !== 'undefined') {
            document.addEventListener('keydown', (e) => this.onKey(e, true));
            document.addEventListener('keyup', (e) => this.onKey(e, false));
        }
    }

    onKey(event, pressed) {
        const bit = pressed ? 0 : 1;

        switch (event.code) {
            // D-Pad
            case 'ArrowRight':
                this.directions = pressed ? (this.directions & ~0x01) : (this.directions | 0x01);
                break;
            case 'ArrowLeft':
                this.directions = pressed ? (this.directions & ~0x02) : (this.directions | 0x02);
                break;
            case 'ArrowUp':
                this.directions = pressed ? (this.directions & ~0x04) : (this.directions | 0x04);
                break;
            case 'ArrowDown':
                this.directions = pressed ? (this.directions & ~0x08) : (this.directions | 0x08);
                break;

            // Buttons
            case 'KeyZ':  // A
                this.buttons = pressed ? (this.buttons & ~0x01) : (this.buttons | 0x01);
                break;
            case 'KeyX':  // B
                this.buttons = pressed ? (this.buttons & ~0x02) : (this.buttons | 0x02);
                break;
            case 'ShiftRight':
            case 'ShiftLeft':  // Select
                this.buttons = pressed ? (this.buttons & ~0x04) : (this.buttons | 0x04);
                break;
            case 'Enter':  // Start
                this.buttons = pressed ? (this.buttons & ~0x08) : (this.buttons | 0x08);
                break;

            default:
                return; // Don't prevent default for other keys
        }

        event.preventDefault();

        // Request joypad interrupt on button press
        if (pressed) {
            this.mmu.io[0x0F] |= 0x10;
        }
    }

    // Read P1 register (0xFF00)
    read() {
        let result = this.p1 | 0x0F;

        // Check which lines are selected (active low)
        if ((this.p1 & 0x20) === 0) {
            // P15 selected - buttons
            result = (result & 0xF0) | this.buttons;
        }
        if ((this.p1 & 0x10) === 0) {
            // P14 selected - directions
            result = (result & 0xF0) | this.directions;
        }

        return result | 0xC0; // Upper bits always 1
    }

    // Write P1 register (0xFF00)
    write(value) {
        // Only bits 4-5 are writable (select lines)
        this.p1 = (value & 0x30) | (this.p1 & 0xCF);
    }

    reset() {
        this.buttons = 0x0F;
        this.directions = 0x0F;
        this.p1 = 0xFF;
    }
}
