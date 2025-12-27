// Color Palettes for GameBoy Emulator
// Colors are in ABGR format (0xAABBGGRR) for Uint32Array on little-endian systems
// Each palette has 4 colors: [lightest, light, dark, darkest]

export const palettes = {
    // Default classic GameBoy palette
    default: {
        name: "Classic Green",
        colors: [0xFF0FBC9B, 0xFF0FAC8B, 0xFF306230, 0xFF0F380F]
    },

    // === NATURE ===
    nature: {
        oceanic: {
            name: "Oceanic",
            colors: [0xFFE8D4A0, 0xFFD4A870, 0xFF7D5830, 0xFF3D2810] // Sandy beach to deep ocean
        },
        volcano: {
            name: "Volcano",
            colors: [0xFF5090FF, 0xFF2060E0, 0xFF1040A0, 0xFF0A1030] // Lava orange-red to volcanic black
        },
        desert: {
            name: "Desert",
            colors: [0xFFA0D8F0, 0xFF70B8D0, 0xFF4080A0, 0xFF203850] // Sand to shadow
        }
    },

    // === SEASONS ===
    seasons: {
        autumn: {
            name: "Autumn",
            colors: [0xFF80C8F8, 0xFF4090D0, 0xFF2050A0, 0xFF102040] // Autumn leaves
        },
        winter: {
            name: "Winter",
            colors: [0xFFF8F0F0, 0xFFD0C8D0, 0xFF908890, 0xFF403840] // Snow and ice
        },
        spring: {
            name: "Spring",
            colors: [0xFFC8F0C8, 0xFFA0D8B0, 0xFF60A070, 0xFF285028] // Fresh greens and blossoms
        },
        summer: {
            name: "Summer",
            colors: [0xFF88F8F8, 0xFF48D8C8, 0xFF28A088, 0xFF085830] // Bright tropical
        }
    },

    // === ZODIAC ===
    zodiac: {
        libra: {
            name: "Libra",
            colors: [0xFFD2E1FF, 0xFFAAB4F0, 0xFF8C8246, 0xFF3C321E] // Peachy pink to cool teal
        },
        gemini: {
            name: "Gemini",
            colors: [0xFFB4F5FF, 0xFF78C8F0, 0xFFA05082, 0xFF461E32] // Golden yellow to deep purple
        },
        aries: {
            name: "Aries",
            colors: [0xFFAAF0FF, 0xFF64BEFA, 0xFF3C46C8, 0xFF1E195A] // Bright gold to fiery red
        },
        pisces: {
            name: "Pisces",
            colors: [0xFFFFDCF0, 0xFFDCAABE, 0xFF8C643C, 0xFF462819] // Soft lavender to deep ocean
        },
        aquarius: {
            name: "Aquarius",
            colors: [0xFFFAFFB4, 0xFFE6DC64, 0xFFB4508C, 0xFF501E37] // Electric cyan to deep violet
        }
    },

    // === ELEMENTS ===
    elements: {
        carbon: {
            name: "Carbon",
            colors: [0xFFA0A0A0, 0xFF707070, 0xFF404040, 0xFF181818] // Graphite shades
        },
        uranium: {
            name: "Uranium",
            colors: [0xFF40F880, 0xFF20C850, 0xFF108830, 0xFF084018] // Radioactive green glow
        },
        oxygen: {
            name: "Oxygen",
            colors: [0xFFF8F0F0, 0xFFF8D0B0, 0xFFD89868, 0xFF804020] // Ethereal light blue
        },
        titanium: {
            name: "Titanium",
            colors: [0xFFE8E0E0, 0xFFB8B0B0, 0xFF787070, 0xFF383030] // Metallic silver
        },
        gold: {
            name: "Gold",
            colors: [0xFF70F8F8, 0xFF30D8D0, 0xFF1898A0, 0xFF085050] // Rich gold tones
        },
        platinum: {
            name: "Platinum",
            colors: [0xFFF8F0F8, 0xFFD8D0E0, 0xFF9890A8, 0xFF484058] // White platinum
        }
    },

    // === FANTASY METALS ===
    fantasy: {
        cobaltBlue: {
            name: "Cobalt Blue",
            colors: [0xFFF8C880, 0xFFE89830, 0xFFA85010, 0xFF502008] // Deep cobalt
        },
        mythrilGreen: {
            name: "Mythril Green",
            colors: [0xFFD8F8D8, 0xFFA8E0B0, 0xFF60A870, 0xFF285028] // Magical silver-green
        },
        adamantiumRed: {
            name: "Adamantium Red",
            colors: [0xFFA0A8C8, 0xFF6068A8, 0xFF303880, 0xFF101840] // Dark metallic red
        }
    },

    // === JAPANESE CITIES ===
    japan: {
        tokyo: {
            name: "Tokyo",
            colors: [0xFFF8F070, 0xFFF868A8, 0xFFB82860, 0xFF400828] // Neon nightlife
        },
        kyoto: {
            name: "Kyoto",
            colors: [0xFFE1DAFF, 0xFFAAA0DC, 0xFF5A8250, 0xFF28371E] // Cherry blossom pink to forest green
        },
        osaka: {
            name: "Osaka",
            colors: [0xFF58D8F8, 0xFF28A8E8, 0xFF1868B8, 0xFF082860] // Vibrant, energetic
        },
        sapporo: {
            name: "Sapporo",
            colors: [0xFFD2EBFF, 0xFFA0B4F0, 0xFFA07864, 0xFF462D23] // Warm peach to cool slate blue
        }
    },

    // === FILMS ===
    films: {
        intheMoodForLove: {
            name: "In The Mood For Love",
            colors: [0xFFAAE1FF, 0xFF64A0EB, 0xFF5046AA, 0xFF231941] // Golden warmth to deep crimson
        },
        backToTheFuture: {
            name: "Back to the Future",
            colors: [0xFFFFF0AA, 0xFFC8C85A, 0xFF3282E6, 0xFF192D82] // Electric cyan to fiery orange
        },
        bladeRunner: {
            name: "Blade Runner",
            colors: [0xFFEBFAAA, 0xFFBEC85A, 0xFF9650AA, 0xFF41193C] // Neon cyan to deep magenta
        }
    }
};

// Get flat list of all palettes for cycling
export function getAllPalettes() {
    const all = [{ key: 'default', category: 'Default', ...palettes.default }];

    const categoryNames = {
        nature: 'Nature',
        seasons: 'Seasons',
        zodiac: 'Zodiac',
        elements: 'Elements',
        fantasy: 'Fantasy Metals',
        japan: 'Japanese Cities',
        films: 'Films'
    };

    for (const [categoryKey, category] of Object.entries(palettes)) {
        if (categoryKey === 'default') continue;
        for (const [paletteKey, palette] of Object.entries(category)) {
            all.push({
                key: `${categoryKey}.${paletteKey}`,
                category: categoryNames[categoryKey] || categoryKey,
                ...palette
            });
        }
    }

    return all;
}

// Get palettes organized by category for UI
export function getPalettesByCategory() {
    const categories = {
        'Default': [{ key: 'default', ...palettes.default }]
    };

    const categoryNames = {
        nature: 'Nature',
        seasons: 'Seasons',
        zodiac: 'Zodiac',
        elements: 'Elements',
        fantasy: 'Fantasy Metals',
        japan: 'Japanese Cities',
        films: 'Films'
    };

    for (const [categoryKey, category] of Object.entries(palettes)) {
        if (categoryKey === 'default') continue;
        const categoryName = categoryNames[categoryKey] || categoryKey;
        categories[categoryName] = [];

        for (const [paletteKey, palette] of Object.entries(category)) {
            categories[categoryName].push({
                key: `${categoryKey}.${paletteKey}`,
                ...palette
            });
        }
    }

    return categories;
}
