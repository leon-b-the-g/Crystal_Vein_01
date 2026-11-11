import { T } from "./tuning.js";
import { THEMES } from "./themes.js";
const melee = (id, name, tier, dmg, swing, arc, reach, stamina, extra = {}) => ({ id, name, tier, cat: 'melee', sprite: 'item/melee', melee: { dmg, swing, arc, reach, stamina, ...extra } });
const gun = (id, name, tier, caliber, dmg, pellets, rate, mag, reload, spread, range, misfire, kind, sprite = 'item/gun') => ({ id, name, tier, cat: 'gun', sprite, gun: { dmg, pellets, rate, mag, reload, spread, range, misfire, caliber, wear: tier === 1 ? 1 : tier === 2 ? 0.5 : tier === 3 ? 0.25 : tier === 4 ? 0.15 : 0, loud: tier === 1 ? 'gun1' : tier === 2 ? 'gun2' : 'gun3', kind } });
export const ITEMS = {};
for (const d of [
    melee('pipe', 'pipe', 1, 12, 0.5, 90, 20, 8), melee('wrench', 'wrench', 1, 12, 0.5, 90, 20, 8), melee('knife', 'kitchen knife', 1, 8, 0.3, 60, 16, 5),
    melee('fire-axe', 'fire axe', 2, 35, 0.9, 100, 24, 14, { two: true }), melee('sledge', 'sledge', 2, 50, 1.2, 120, 24, 18, { knock: 48, two: true }), melee('machete', 'machete', 2, 25, 0.6, 90, 22, 10),
    melee('sword', 'sword', 3, 40, 0.45, 140, 26, 10), melee('piston-hammer', 'piston hammer', 3, 80, 1.0, 90, 24, 16, { knock: 64, stagger: 1, two: true }), melee('energy-whip', 'energy whip', 3, 30, 0.6, 180, 48, 12, { targets: 3 }),
    gun('zip-gun', 'zip gun', 1, 'shell', 20, 1, 0.5, 1, 2.5, 12, 96, 0.15), gun('rusted-revolver', 'rusted revolver', 1, 'pistol', 18, 1, 1, 6, 3, 8, 128, 0.10), gun('nail-pistol', 'nail pistol', 1, 'pistol', 8, 1, 3, 10, 2, 10, 80, 0.08),
    gun('service-pistol', 'service pistol', 2, 'pistol', 22, 1, 2, 9, 1.6, 4, 192, 0.02), gun('carbine', 'bolt carbine', 2, 'rifle', 45, 1, 0.6, 5, 2.4, 2, 320, 0.02), gun('pump-shotgun', 'pump shotgun', 2, 'shell', 8, 6, 0.8, 4, 3, 14, 112, 0.02),
    gun('semi-rifle', 'semi-auto rifle', 3, 'rifle', 35, 1, 3, 20, 1.8, 2, 320, 0), gun('combat-shotgun', 'combat shotgun', 3, 'shell', 10, 8, 1.2, 6, 2.4, 12, 128, 0), gun('heavy-revolver', 'heavy revolver', 3, 'pistol', 60, 1, 1, 6, 2.2, 3, 224, 0),
    gun('energy-pistol', 'energy pistol', 4, 'cell', 40, 1, 3, 12, 1.4, 2, 256, 0, 'energy', 'item/egun'), gun('energy-shotgun', 'energy shotgun', 4, 'cell', 14, 7, 1.2, 6, 2, 10, 144, 0, 'energy', 'item/egun'), gun('energy-rifle', 'energy rifle', 4, 'cell', 55, 1, 4, 24, 1.8, 1.5, 352, 0, 'energy', 'item/egun'),
    gun('railgun', 'railgun', 4, 'cell', 150, 1, 0.6, 4, 2.6, 0, 480, 0, 'rail', 'item/egun'), gun('flamethrower', 'flamethrower', 4, 'fuel', 6, 1, 10, 60, 3, 0, 72, 0, 'flame', 'item/flamer'),
    melee('energy-sword', 'energy sword', 5, 70, 0.4, 160, 30, 6, { targets: 99, kind: 'esword' }), melee('katana', 'katana', 5, 55, 0.35, 120, 28, 8, { targets: 3, kind: 'katana', two: true }), melee('power-fist', 'power fist', 5, 120, 0.9, 70, 20, 14, { knock: 120, stagger: 2, kind: 'fist' }),
    gun('heavy-mg', 'heavy machine gun', 5, 'none', 30, 1, 10, 200, 0, 5, 288, 0, 'hmg', 'item/heavy'), gun('minigun', 'minigun', 5, 'none', 22, 1, 22, 400, 0, 7, 256, 0, 'minigun', 'item/heavy'),
    gun('grenade-launcher', 'grenade launcher', 5, 'none', 0, 1, 1.2, 12, 0, 0, 224, 0, 'launcher', 'item/heavy'), gun('flame-shotgun', 'flame shotgun', 5, 'none', 16, 8, 1.2, 30, 0, 12, 144, 0, 'flameShot'),
    gun('laser-cannon', 'heavy laser cannon', 5, 'none', 120, 1, 0.8, 15, 0, 0, 480, 0, 'laser', 'item/heavy'),
    { id: 'pistol-ammo', name: 'pistol rounds', tier: 2, cat: 'ammo', sprite: 'item/ammo', ammo: { caliber: 'pistol', n: 12 } },
    { id: 'rifle-ammo', name: 'rifle rounds', tier: 2, cat: 'ammo', sprite: 'item/ammo', ammo: { caliber: 'rifle', n: 8 } },
    { id: 'shells', name: 'shotgun shells', tier: 2, cat: 'ammo', sprite: 'item/ammo', ammo: { caliber: 'shell', n: 6 } },
    { id: 'energy-cell', name: 'energy cells', tier: 4, cat: 'ammo', sprite: 'item/ammo', ammo: { caliber: 'cell', n: 10 } },
    { id: 'fuel-tank', name: 'fuel tank', tier: 4, cat: 'ammo', sprite: 'item/ammo', ammo: { caliber: 'fuel', n: 30 } },
    { id: 'frag-grenade', name: 'frag grenade', tier: 4, cat: 'use', sprite: 'item/grenade', stack: 3, use: { throw: 'frag' } },
    { id: 'incendiary', name: 'incendiary grenade', tier: 4, cat: 'use', sprite: 'item/grenade', stack: 3, use: { throw: 'incendiary' } },
    { id: 'spore-killer', name: 'spore-killer grenade', tier: 4, cat: 'use', sprite: 'item/grenade', stack: 3, use: { throw: 'sporekill' } },
    { id: 'shield-cell', name: 'shield cell', tier: 4, cat: 'use', sprite: 'item/belt', stack: 3, use: { shield: 40 } },
    { id: 'adrenaline', name: 'adrenaline shot', tier: 4, cat: 'use', sprite: 'item/syringe', stack: 2, use: { adren: 12 } },
    { id: 'antifungal', name: 'antifungal shot', tier: 4, cat: 'use', sprite: 'item/syringe', stack: 2, use: { antifungal: 30 } },
    { id: 'vest-ii', name: 'vest II', tier: 4, cat: 'armor', sprite: 'item/armor', armor: { slot: 'vest', reduce: 7 } },
    { id: 'helmet-ii', name: 'helmet II', tier: 4, cat: 'armor', sprite: 'item/armor', armor: { slot: 'helmet', reduce: 4 } },
    { id: 'shield-belt', name: 'shield belt', tier: 4, cat: 'misc', sprite: 'item/belt', belt: true },
    { id: 'mines', name: 'proximity mine', tier: 5, cat: 'use', sprite: 'item/mine', stack: 5, use: { mine: true } },
    { id: 'heavy-armor', name: 'heavy assault armour', tier: 5, cat: 'armor', sprite: 'item/armor', armor: { slot: 'vest', reduce: 14, slow: 0.3 } },
    { id: 'bandage', name: 'bandage', tier: 2, cat: 'use', sprite: 'item/med', stack: 5, use: { heal: 15, time: 2 } },
    { id: 'medkit', name: 'medkit', tier: 3, cat: 'use', sprite: 'item/med', stack: 2, use: { heal: 40, time: 1.5 } },
    { id: 'ration', name: 'ration', tier: 2, cat: 'use', sprite: 'item/food', stack: 5, use: { heal: 10, buff: 60 } },
    { id: 'hical-ration', name: 'high-cal ration', tier: 3, cat: 'use', sprite: 'item/food', stack: 3, use: { heal: 15, buff: 120 } },
    { id: 'extinguisher', name: 'fire extinguisher', tier: 2, cat: 'use', sprite: 'item/ext', use: { spray: true, charges: 8 } },
    { id: 'flare', name: 'flare', tier: 3, cat: 'use', sprite: 'item/flare', stack: 4, use: { throw: 'flare' } },
    { id: 'noisemaker', name: 'noisemaker', tier: 3, cat: 'use', sprite: 'item/tool', stack: 3, use: { throw: 'noise' } },
    { id: 'nav-tool', name: 'nav tool', tier: 3, cat: 'use', sprite: 'item/tool', stack: 1, use: { nav: true, charges: 3 } },
    { id: 'vest', name: 'vest', tier: 3, cat: 'armor', sprite: 'item/armor', armor: { slot: 'vest', reduce: 4 } },
    { id: 'helmet', name: 'helmet', tier: 3, cat: 'armor', sprite: 'item/armor', armor: { slot: 'helmet', reduce: 2 } },
    { id: 'scrap', name: 'scrap', tier: 1, cat: 'misc', sprite: 'item/scrap', stack: 99 },
    { id: 'battery', name: 'battery', tier: 1, cat: 'part', sprite: 'item/part', stack: 9 },
    { id: 'wire', name: 'wire', tier: 1, cat: 'part', sprite: 'item/part', stack: 9 },
    { id: 'circuit', name: 'circuit', tier: 1, cat: 'part', sprite: 'item/part', stack: 9 },
    { id: 'spring', name: 'spring', tier: 1, cat: 'part', sprite: 'item/part', stack: 9 },
    { id: 'gun-barrel', name: 'gun barrel', tier: 1, cat: 'part', sprite: 'item/part', stack: 9 },
    { id: 'cell-casing', name: 'cell casing', tier: 1, cat: 'part', sprite: 'item/part', stack: 9 },
    { id: 'cloth', name: 'cloth', tier: 1, cat: 'part', sprite: 'item/part', stack: 9 },
    { id: 'fuel', name: 'fuel can', tier: 1, cat: 'part', sprite: 'item/part', stack: 9 },
    { id: 'antiseptic', name: 'antiseptic', tier: 2, cat: 'part', sprite: 'item/part', stack: 9 },
    { id: 'breach-charge', name: 'breach charge', tier: 3, cat: 'use', sprite: 'item/flare', stack: 3, use: { throw: 'breach' } },
    { id: 'flashlight-head', name: 'flashlight head', tier: 3, cat: 'misc', sprite: 'item/tool', use2: { flashHead: true } },
    { id: 'vault-key', name: 'vault key', tier: 3, cat: 'misc', sprite: 'item/key', key: 'vault' },
    { id: 'keycard', name: 'deck keycard', tier: 3, cat: 'misc', sprite: 'item/key', key: 'keycard' },
    { id: 'manifest-key', name: 'manifest key', tier: 3, cat: 'misc', sprite: 'item/key', key: 'manifest' },
    { id: 'mask', name: 'filter mask', tier: 3, cat: 'armor', sprite: 'item/mask', armor: { slot: 'mask', reduce: 0, spores: 0.4 } },
    { id: 'backpack', name: 'backpack', tier: 3, cat: 'misc', sprite: 'item/pack', pack: 'backpack' },
    { id: 'storage-crate', name: 'storage crate', tier: 3, cat: 'misc', sprite: 'item/pack', crate: true },
    { id: 'military-backpack', name: 'military backpack', tier: 4, cat: 'misc', sprite: 'item/pack', pack: 'military' },
])
    ITEMS[d.id] = d;
export function make(id, n = 1, r) {
    const d = ITEMS[id], it = { id, n };
    if (d.gun) {
        it.cond = d.tier === 1 ? 40 + (r ? r.int(30) : 15) : d.tier === 2 ? 70 + (r ? r.int(25) : 10) : d.tier >= 4 ? 100 : 90 + (r ? r.int(11) : 5);
        it.mag = r && d.tier < 5 ? r.int(d.gun.mag + 1) : d.gun.mag;
    }
    if (d.melee && d.tier < 5)
        it.cond = d.tier === 1 ? 60 + (r ? r.int(41) : 20) : 85 + (r ? r.int(16) : 8);
    if (d.use?.charges)
        it.charges = d.use.charges;
    if (d.ammo)
        it.n = d.ammo.n;
    return it;
}
export const tierColor = { 1: '#9AA3B2', 2: '#5CB85C', 3: '#3A8DDE', 4: '#B04CB5', 5: '#E0B13A' };
export const createInventory = () => ({ weapons: [null, null], active: 0, quick: [make('bandage'), null, null, null], bag: Array(12).fill(null), bagSize: 12, ammo: { pistol: 0, rifle: 0, shell: 0, cell: 0, fuel: 0, none: 0 }, scrap: 0, vest: null, helmet: null, mask: null, packs: { backpack: false, military: false }, keys: [], shield: 0, shieldMax: 0 });
export const bagCount = (inv) => inv.bag.filter(Boolean).length;
export const bagFree = (inv) => { for (let i = 0; i < inv.bagSize; i++)
    if (!inv.bag[i])
        return i; return -1; };
export const getSlot = (inv, s) => s.where === 'bin' ? null : s.where === 'stash' ? inv.stash?.[s.i] ?? null : s.where === 'bag' ? inv.bag[s.i] ?? null : s.where === 'weapon' ? inv.weapons[s.i] : s.where === 'quick' ? inv.quick[s.i] : inv[s.where];
export function setSlot(inv, s, it) { if (s.where === 'bin')
    return; if (s.where === 'stash') {
    if (inv.stash)
        inv.stash[s.i] = it;
    return;
} if (s.where === 'bag')
    inv.bag[s.i] = it;
else if (s.where === 'weapon')
    inv.weapons[s.i] = it;
else if (s.where === 'quick')
    inv.quick[s.i] = it;
else
    inv[s.where] = it; }
export function fits(s, it) {
    if (!it)
        return true;
    const d = ITEMS[it.id];
    if (s.where === 'bag' || s.where === 'bin' || s.where === 'stash')
        return true;
    if (s.where === 'weapon')
        return d.cat === 'melee' || d.cat === 'gun';
    if (s.where === 'quick')
        return d.cat === 'use';
    return d.armor?.slot === s.where;
}
export function moveItem(inv, from, to) {
    if (from.where === to.where && from.i === to.i)
        return false;
    const a = getSlot(inv, from), b = getSlot(inv, to);
    if (!a)
        return false;
    const st = ITEMS[a.id].stack;
    if (b && st && b.id === a.id && b.n < st) {
        const k = Math.min(a.n, st - b.n);
        b.n += k;
        a.n -= k;
        if (a.n <= 0)
            setSlot(inv, from, null);
        return true;
    }
    if (!fits(to, a) || !fits(from, b))
        return false;
    setSlot(inv, to, a);
    setSlot(inv, from, b);
    return true;
}
export function give(inv, it) {
    const d = ITEMS[it.id];
    if (d.cat === 'ammo') {
        inv.ammo[d.ammo.caliber] += it.n;
        return null;
    }
    if (it.id === 'scrap') {
        inv.scrap += it.n;
        return null;
    }
    if (d.key) {
        if (!inv.keys.includes(d.key))
            inv.keys.push(d.key);
        return null;
    }
    if (d.belt) {
        inv.shieldMax = T.combat.shield.max;
        inv.shield = inv.shieldMax;
        return null;
    }
    if (d.crate) {
        inv.stash ??= [];
        const add = Math.min(16, inv.stash.length + (inv.stash.length ? 4 : 12)) - inv.stash.length;
        for (let k = 0; k < add; k++)
            inv.stash.push(null);
        return null;
    }
    if (d.pack) {
        inv.packs[d.pack] = true;
        inv.bagSize += 6;
        while (inv.bag.length < inv.bagSize)
            inv.bag.push(null);
        return null;
    }
    if (d.cat === 'melee' || d.cat === 'gun') {
        const i = inv.weapons.indexOf(null);
        if (i >= 0) {
            inv.weapons[i] = it;
            if (inv.weapons[inv.active] === null)
                inv.active = i;
            return null;
        }
    }
    if (d.cat === 'armor') {
        const slot = d.armor.slot;
        if (!inv[slot]) {
            inv[slot] = it;
            return null;
        }
    }
    if (d.stack) {
        for (const q of [...inv.quick, ...inv.bag])
            if (q && q.id === it.id && q.n < d.stack) {
                const k = Math.min(it.n, d.stack - q.n);
                q.n += k;
                it.n -= k;
                if (it.n <= 0)
                    return null;
            }
        if (d.cat === 'use') {
            const i = inv.quick.indexOf(null);
            if (i >= 0) {
                inv.quick[i] = it;
                return null;
            }
        }
    }
    const f = bagFree(inv);
    if (f >= 0) {
        inv.bag[f] = it;
        return null;
    }
    return it;
}
export function equipFromBag(inv, i) {
    const it = inv.bag[i];
    if (!it)
        return;
    const d = ITEMS[it.id];
    if (d.cat === 'melee' || d.cat === 'gun') {
        const k = inv.weapons[inv.active] && inv.weapons.indexOf(null) >= 0 ? inv.weapons.indexOf(null) : inv.active;
        if (moveItem(inv, { where: 'bag', i }, { where: 'weapon', i: k }))
            inv.active = k;
    }
    else if (d.cat === 'use')
        moveItem(inv, { where: 'bag', i }, { where: 'quick', i: inv.quick.indexOf(null) >= 0 ? inv.quick.indexOf(null) : 0 });
    else if (d.armor)
        moveItem(inv, { where: 'bag', i }, { where: d.armor.slot, i: 0 });
}
export function unequip(inv, where, i = 0) { const f = bagFree(inv); return f >= 0 && moveItem(inv, { where, i }, { where: 'bag', i: f }); }
const TIER_W = { low: [60, 30, 9, 0.2, 0], mid: [35, 35, 22, 5, 0], deep: [20, 30, 30, 12, 0] };
const CAT_W = (theme) => { const w = { ...(THEMES[theme] ?? THEMES.crew).loot }; for (const [k, m] of Object.entries(T.loot.cat))
    w[k] *= m; return w; };
const byTierCat = (tier, cat) => Object.values(ITEMS).filter(d => d.tier === tier && d.cat === cat && !d.pack && !d.crate && !d.key && !d.belt && d.id !== 'flashlight-head' && d.id !== 'breach-charge');
const pickW = (r, w) => { const ks = Object.keys(w); let v = r.next() * ks.reduce((a, k) => a + w[k], 0); for (const k of ks) {
    v -= w[k];
    if (v <= 0)
        return k;
} return ks[ks.length - 1]; };
export const lootPrefs = { calibers: new Set() };
export const setLootPrefs = (inv) => { lootPrefs.calibers = new Set(inv.weapons.flatMap(w => w && ITEMS[w.id].gun ? [ITEMS[w.id].gun.caliber] : [])); };
const itemW = (d) => (T.loot.item[d.id] ?? 1) * (d.ammo && lootPrefs.calibers.has(d.ammo.caliber) ? T.loot.equippedAmmo : 1);
export function pickItem(r, pool) { let v = r.next() * pool.reduce((a, d) => a + itemW(d), 0); for (const d of pool) {
    v -= itemW(d);
    if (v <= 0)
        return d;
} return pool[pool.length - 1]; }
export function rollItem(r, floor, theme, bias = 0, forceTier) {
    const tw = forceTier ? [1, 2, 3, 4, 5].map(t => t === forceTier ? 1 : 0) : TIER_W[floor <= 3 ? 'low' : floor <= 7 ? 'mid' : 'deep'].map((w, i) => w * (1 + bias * i));
    for (let tries = 0; tries < 20; tries++) {
        let v = r.next() * tw.reduce((a, b) => a + b, 0), tier = 1;
        for (let i = 0; i < 5; i++) {
            v -= tw[i];
            if (v <= 0) {
                tier = (i + 1);
                break;
            }
        }
        let cat = pickW(r, CAT_W(theme));
        if (cat === 'melee' && tier === 1 && r.next() >= T.loot.lowMelee)
            cat = 'part';
        const pool = byTierCat(tier, cat).filter(d => !(d.tier === 5 && d.cat === 'ammo'));
        if (pool.length) {
            const d = pickItem(r, pool);
            return make(d.id, d.id === 'scrap' ? 3 + r.int(6) : d.cat === 'part' ? 1 + r.int(2) : 1, r);
        }
    }
    return make('scrap', 3, r);
}
export const TIER_NAME = ['', 'common', 'uncommon', 'rare', 'unique', 'mythical'];
