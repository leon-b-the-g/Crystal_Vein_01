import { enumTile as E } from "./tilemap.js";
const L = (melee, gun, ammo, use, armor, misc, part) => ({ melee, gun, ammo, use, armor, misc, part });
export const THEMES = {
    crew: { name: 'crew quarters', props: [[E.table, 3], [E.locker, 4], [E.crate, 1], [E.barrel, 1]], density: 0.22, lamps: 0.5, creep: 2, loot: L(2, 1, 2, 5, 0.5, 3, 1), aliens: { crawler: 1.3, mite: 1.3 }, count: 1, event: 'lightsOut', pool: ['easy', 'mid'] },
    cafeteria: { name: 'cafeteria', props: [[E.table, 5], [E.crate, 2], [E.barrel, 1], [E.locker, 1]], density: 0.26, lamps: 0.55, creep: 2, loot: L(4, 1, 1, 5, 0.3, 2, 1), aliens: { crawler: 1.6 }, count: 1, event: 'frenzy', pool: ['easy', 'mid'] },
    medbay: { name: 'med bay', props: [[E.table, 3], [E.locker, 3], [E.console, 2], [E.crate, 1]], density: 0.22, lamps: 0.6, creep: 2, loot: L(1, 1, 1, 8, 1.5, 1, 1.5), aliens: { crawler: 1 }, count: 0.9, event: 'quarantine', pool: ['easy', 'mid'] },
    armoury: { name: 'armoury', props: [[E.locker, 4], [E.crate, 3], [E.console, 1], [E.table, 2]], density: 0.26, lamps: 0.45, creep: 1, loot: L(2, 4, 6, 1, 3, 1, 1), aliens: { brute: 2.5 }, count: 1.1, event: 'lockdown', pool: ['mid', 'hard'] },
    engine: { name: 'engine room', props: [[E.barrel, 4], [E.console, 2], [E.crate, 3], [E.table, 3]], density: 0.28, lamps: 0.35, creep: 3, loot: L(2, 1, 1, 1, 0.5, 6, 4), aliens: { spitter: 2.5 }, count: 1.1, event: 'venting', pool: ['mid', 'hard'] },
    engineering: { name: 'engineering centre', props: [[E.console, 3], [E.barrel, 3], [E.crate, 3], [E.locker, 1], [E.table, 3]], density: 0.28, lamps: 0.35, creep: 3, loot: L(3, 1.5, 2, 2, 1, 3, 5), aliens: {}, count: 1, event: 'reroute', pool: ['easy', 'mid'] },
    shield: { name: 'shield generator', props: [[E.console, 4], [E.barrel, 2], [E.crate, 2], [E.table, 2]], density: 0.24, lamps: 0.3, creep: 2, loot: L(1, 2, 2, 2, 2, 2, 3), aliens: { crawler: 1.2, stalker: 2.5 }, count: 1.1, event: 'emp', pool: ['mid', 'hard'] },
    research: { name: 'research laboratory', props: [[E.console, 4], [E.table, 3], [E.locker, 2]], density: 0.24, lamps: 0.45, creep: 3, loot: L(1, 2, 1, 3, 1, 2, 2), aliens: { spitter: 1.5 }, count: 1, event: 'specimen', pool: ['mid', 'hard'] },
    botanical: { name: 'botanical laboratory', props: [[E.table, 3], [E.barrel, 2], [E.crate, 2]], density: 0.24, lamps: 0.5, creep: 7, loot: L(1, 1, 1, 6, 0.5, 2, 1), aliens: { mite: 2.5 }, count: 1, event: 'bloom', pool: ['easy', 'mid'] },
    loading: { name: 'loading dock', props: [[E.crate, 7], [E.barrel, 2], [E.table, 3]], density: 0.3, lamps: 0.4, creep: 2, loot: L(2, 2, 2, 2, 2, 3, 2), aliens: { brute: 2 }, count: 1.1, event: 'manifest', pool: ['mid', 'hard'] },
    merchant: { name: 'merchant bay', props: [[E.crate, 3], [E.table, 3], [E.console, 1], [E.locker, 2]], density: 0.24, lamps: 0.7, creep: 0, loot: L(1, 1, 1, 2, 1, 2, 1), aliens: {}, count: 0.25, event: null, pool: [] },
    command: { name: 'command centre', props: [[E.console, 5], [E.table, 2], [E.locker, 2]], density: 0.24, lamps: 0.5, creep: 2, loot: L(1, 2, 2, 3, 1, 2, 2), aliens: { crawler: 1.2, stalker: 1.8 }, count: 1.05, event: 'beacon', pool: ['hard'] },
    landing: { name: 'landing dock', props: [[E.crate, 6], [E.barrel, 3], [E.table, 2]], density: 0.25, lamps: 0.3, creep: 4, loot: L(1, 1, 1, 1, 1, 1, 1), aliens: { brute: 2, spitter: 1.5 }, count: 1.3, event: null, pool: [] },
};
export const themeList = Object.keys(THEMES);
export const MOOD = {
    crew: { lamp: [0.95, 0.66, 0.36], amb: [1.0, 0.9, 0.8] },
    cafeteria: { lamp: [1.0, 0.8, 0.45], amb: [1.0, 0.92, 0.75] },
    medbay: { lamp: [0.72, 0.95, 1.0], amb: [0.82, 0.96, 1.08] },
    armoury: { lamp: [0.92, 0.94, 1.0], amb: [0.9, 0.92, 1.0] },
    engine: { lamp: [1.0, 0.5, 0.22], amb: [1.12, 0.8, 0.62] },
    engineering: { lamp: [0.45, 0.95, 0.85], amb: [0.8, 1.0, 0.95] },
    shield: { lamp: [0.45, 0.65, 1.0], amb: [0.78, 0.88, 1.12] },
    research: { lamp: [0.82, 0.72, 1.0], amb: [0.92, 0.86, 1.06] },
    botanical: { lamp: [0.62, 1.0, 0.45], amb: [0.85, 1.06, 0.78] },
    loading: { lamp: [1.0, 0.62, 0.2], amb: [1.06, 0.88, 0.68] },
    merchant: { lamp: [1.0, 0.78, 0.5], amb: [1.0, 0.92, 0.8] },
    command: { lamp: [0.6, 0.85, 1.0], amb: [0.85, 0.92, 1.06] },
    landing: { lamp: [1.0, 0.42, 0.3], amb: [1.08, 0.78, 0.72] },
};
export const FLOOR = {
    crew: 'quarters', cafeteria: 'quarters', medbay: 'clinical', research: 'clinical', botanical: 'botanical',
    engine: 'industrial', engineering: 'industrial', shield: 'industrial', armoury: 'cargo', loading: 'cargo', merchant: 'cargo', landing: 'cargo', command: 'command',
};
export const PROPS = {
    quarters: [['bunk', 1, 2, 'block'], ['footlocker', 1, 1, 'block'], ['mess-table', 2, 1, 'block'], ['vending', 1, 1, 'block'], ['desk', 1, 1, 'block'],
        ['sleeping-bag', 1, 2, 'floor'], ['chair-down', 1, 1, 'floor'], ['laundry', 1, 1, 'floor'], ['food-litter', 1, 1, 'floor']],
    clinical: [['med-bed', 1, 2, 'block'], ['monitor-cart', 1, 1, 'block'], ['specimen-tank', 1, 1, 'block'], ['lab-bench', 2, 1, 'block'], ['analyser', 1, 1, 'block'], ['body-bag', 1, 2, 'floor'], ['iv-fallen', 1, 1, 'floor'], ['med-waste', 1, 1, 'floor'], ['broken-glass', 1, 1, 'floor']],
    botanical: [['plant-bed', 2, 1, 'block'], ['hydro-rack', 1, 2, 'block'], ['big-plant', 1, 1, 'block'], ['water-tank', 1, 1, 'block'], ['potting-bench', 1, 1, 'block'], ['vines', 1, 1, 'floor'], ['spilled-soil', 1, 1, 'floor'], ['seed-tray', 1, 1, 'floor'], ['hose', 1, 1, 'floor']],
    industrial: [['generator', 2, 1, 'block'], ['pipe-valve', 1, 1, 'block'], ['workbench', 2, 1, 'block'], ['tool-chest', 1, 1, 'block'], ['transformer', 1, 1, 'block'], ['cables', 1, 1, 'floor'], ['oil-spill', 1, 1, 'floor'], ['bolts', 1, 1, 'floor'], ['pipe-pile', 1, 1, 'floor']],
    cargo: [['container', 2, 1, 'block'], ['loader', 1, 2, 'block'], ['gun-rack', 2, 1, 'block'], ['crate-stack', 1, 1, 'block'], ['trolley', 1, 1, 'block'], ['pallet', 1, 1, 'floor'], ['cargo-net', 1, 1, 'floor'], ['packing', 1, 1, 'floor'], ['casings', 1, 1, 'floor']],
    command: [['console-bank', 2, 1, 'block'], ['holo-table', 2, 2, 'block'], ['server-rack', 1, 1, 'block'], ['officer-desk', 1, 1, 'block'], ['comms', 1, 1, 'block'], ['chair-tipped', 1, 1, 'floor'], ['tablets', 1, 1, 'floor'], ['headset', 1, 1, 'floor'], ['screen-shards', 1, 1, 'floor']],
};
