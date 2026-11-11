import { ITEMS, make, give, bagFree, getSlot, setSlot } from "./items.js";
import { ipow } from "./dmath.js";
export function count(inv, id) { if (id === 'scrap')
    return inv.scrap; let n = 0; for (const it of [...inv.bag, ...inv.quick])
    if (it && it.id === id)
        n += it.n; return n; }
export function take(inv, id, n) {
    if (count(inv, id) < n)
        return false;
    if (id === 'scrap') {
        inv.scrap -= n;
        return true;
    }
    for (const arr of [inv.bag, inv.quick])
        for (let i = 0; i < arr.length && n > 0; i++) {
            const it = arr[i];
            if (!it || it.id !== id)
                continue;
            const k = Math.min(n, it.n);
            it.n -= k;
            n -= k;
            if (it.n <= 0)
                arr[i] = null;
        }
    return true;
}
const tier = (it) => ITEMS[it.id].tier;
const isWeapon = (it) => !!(ITEMS[it.id].gun || ITEMS[it.id].melee);
export const repairCost = (it) => 10 * tier(it);
export const upgradeCost = (it) => ({ scrap: 25 * tier(it), part: ITEMS[it.id].gun ? 'gun-barrel' : 'spring' });
export const canRepair = (it) => it.cond !== undefined && it.cond < 100 && tier(it) < 5;
export const canUpgrade = (it) => isWeapon(it) && (it.lvl ?? 0) < 3 && tier(it) < 5;
export function repair(inv, it) {
    if (!canRepair(it))
        return 'nothing to repair';
    const c = repairCost(it);
    if (inv.scrap < c)
        return `needs ${c} scrap`;
    inv.scrap -= c;
    it.cond = 100;
    return null;
}
export function upgrade(inv, it) {
    if (!canUpgrade(it))
        return 'max level';
    const c = upgradeCost(it);
    if (inv.scrap < c.scrap)
        return `needs ${c.scrap} scrap`;
    if (count(inv, c.part) < 1)
        return `needs a ${ITEMS[c.part].name}`;
    inv.scrap -= c.scrap;
    take(inv, c.part, 1);
    it.lvl = (it.lvl ?? 0) + 1;
    return null;
}
export function combine(inv, a, b) {
    const x = getSlot(inv, a), y = getSlot(inv, b);
    if (!x || !y || x === y || x.id !== y.id || !isWeapon(x))
        return 'needs two of the same weapon';
    if (tier(x) >= 5)
        return 'tier 5 cannot be combined';
    x.lvl = Math.min(3, Math.max(x.lvl ?? 0, y.lvl ?? 0) + 1);
    if (x.cond !== undefined)
        x.cond = 100;
    clear(inv, b);
    return null;
}
const YIELD = {
    pipe: [], knife: [], wrench: [['spring', 1]], 'fire-axe': [['spring', 1]], sledge: [['spring', 1]], machete: [['spring', 1]],
    sword: [['spring', 1], ['wire', 1]], 'piston-hammer': [['spring', 2], ['fuel', 1]], 'energy-whip': [['battery', 1], ['wire', 2]],
    'zip-gun': [['gun-barrel', 1]], 'nail-pistol': [['spring', 1], ['battery', 1]], flamethrower: [['fuel', 1], ['wire', 1], ['spring', 1]],
    vest: [['cloth', 2]], helmet: [['cloth', 1], ['cell-casing', 1]], 'vest-ii': [['cloth', 2], ['spring', 1]], 'helmet-ii': [['cloth', 1], ['circuit', 1]], mask: [['cloth', 1], ['cell-casing', 1]],
    'frag-grenade': [['fuel', 1], ['spring', 1]], incendiary: [['fuel', 2]], 'spore-killer': [['antiseptic', 1], ['cell-casing', 1]],
    'shield-cell': [['battery', 1]], adrenaline: [['antiseptic', 1]], antifungal: [['antiseptic', 1]], 'shield-belt': [['circuit', 1], ['battery', 1], ['wire', 1]],
    ration: [], 'hical-ration': [], extinguisher: [['cell-casing', 1], ['spring', 1]], 'nav-tool': [['circuit', 1], ['battery', 1], ['wire', 1]],
};
export function yieldOf(it) {
    const d = ITEMS[it.id];
    if (d.cat === 'part')
        return { scrap: SHRED[d.tier] * it.n, parts: [] };
    if (d.tier >= 5 || d.key || d.pack || d.crate || d.cat === 'ammo' || it.id === 'scrap')
        return null;
    const r = YIELD[it.id] ? undefined : RECIPES.find(r => r.makes[0] === it.id);
    if (r) {
        const per = d.stack ? it.n / r.makes[1] : 1, parts = r.needs.filter(([id]) => id !== 'scrap').map(([id, n]) => [id, Math.floor(n * per)]).filter(([, n]) => n > 0);
        return { scrap: parts.length ? 0 : 1, parts };
    }
    const base = YIELD[it.id] ?? (d.gun?.caliber === 'cell' ? [['circuit', 1], ['cell-casing', 1], ['wire', 1]] : d.gun ? [['gun-barrel', 1], ['spring', 1], ...(d.tier >= 3 ? [['wire', 1]] : [])] : [['wire', 1]]);
    return { scrap: Math.max(1, Math.round(repairCost(it) * 0.3)) * (d.stack ? it.n : 1), parts: base.map(([id, n]) => [id, n * (d.stack ? it.n : 1)]) };
}
export const yieldText = (y) => [...y.parts.map(([id, n]) => `${n > 1 ? n + '× ' : ''}${ITEMS[id].name}`), `${y.scrap} scrap`].join(', ');
export function dismantle(inv, s) {
    const it = getSlot(inv, s);
    if (!it)
        return 'nothing there';
    const y = yieldOf(it);
    if (!y)
        return "can't take that apart";
    const test = structuredClone(inv);
    clear(test, s);
    if (y.parts.some(([id, n]) => give(test, make(id, n))))
        return 'no room for the parts';
    clear(inv, s);
    inv.scrap += y.scrap;
    for (const [id, n] of y.parts)
        give(inv, make(id, n));
    return null;
}
export function dismantleMany(inv, slots) {
    const items = slots.map(s => getSlot(inv, s)).filter(Boolean);
    let n = 0, err = null;
    for (const it of items) {
        const s = slotOf(inv, it);
        if (!s)
            continue;
        const r = dismantle(inv, s);
        if (r)
            err = r;
        else
            n++;
    }
    return { n, err };
}
export function yieldSum(inv, slots) {
    const parts = new Map();
    let scrap = 0;
    for (const s of slots) {
        const it = getSlot(inv, s), y = it && yieldOf(it);
        if (!y)
            continue;
        scrap += y.scrap;
        for (const [id, n] of y.parts)
            parts.set(id, (parts.get(id) ?? 0) + n);
    }
    return { scrap, parts: [...parts] };
}
function slotOf(inv, it) {
    for (const where of ['weapon', 'bag', 'quick']) {
        const arr = where === 'weapon' ? inv.weapons : inv[where], i = arr.indexOf(it);
        if (i >= 0)
            return { where, i };
    }
    for (const where of ['vest', 'helmet', 'mask'])
        if (inv[where] === it)
            return { where, i: 0 };
    return null;
}
function clear(inv, s) { setSlot(inv, s, null); }
export const RECIPES = [
    { id: 'cells', name: 'energy cells ×10', needs: [['cell-casing', 2], ['wire', 1]], makes: ['energy-cell', 10] },
    { id: 'bandages', name: 'bandage ×2', needs: [['cloth', 1]], makes: ['bandage', 2] },
    { id: 'noisemaker', name: 'noisemaker', needs: [['circuit', 1], ['spring', 1]], makes: ['noisemaker', 1] },
    { id: 'flares', name: 'flare ×2', needs: [['fuel', 1], ['cell-casing', 1]], makes: ['flare', 2] },
    { id: 'breach', name: 'breach charge', needs: [['fuel', 2], ['circuit', 1]], makes: ['breach-charge', 1] },
    { id: 'flashhead', name: 'flashlight head', needs: [['battery', 1], ['wire', 1]], makes: ['flashlight-head', 1] },
    { id: 'filter', name: 'filter mask', needs: [['cloth', 1], ['cell-casing', 1]], makes: ['mask', 1] },
    { id: 'medkit', name: 'medkit', needs: [['bandage', 2], ['antiseptic', 1]], makes: ['medkit', 1] },
    { id: 'pistol-ammo', name: 'pistol rounds ×12', needs: [['cell-casing', 1], ['scrap', 4]], makes: ['pistol-ammo', 1] },
    { id: 'shells', name: 'shotgun shells ×6', needs: [['cell-casing', 1], ['cloth', 1], ['scrap', 4]], makes: ['shells', 1] },
    { id: 'rifle-ammo', name: 'rifle rounds ×8', needs: [['cell-casing', 1], ['fuel', 1], ['scrap', 6]], makes: ['rifle-ammo', 1] },
    { id: 'fuel-tank', name: 'fuel tank (30)', needs: [['fuel', 2]], makes: ['fuel-tank', 1] },
    { id: 'frag', name: 'frag grenade', needs: [['fuel', 1], ['circuit', 1], ['cell-casing', 1], ['spring', 1]], makes: ['frag-grenade', 1] },
    { id: 'incendiary', name: 'incendiary grenade', needs: [['fuel', 2], ['cloth', 1], ['cell-casing', 1]], makes: ['incendiary', 1] },
    { id: 'sporekill', name: 'spore-killer grenade', needs: [['antiseptic', 1], ['cell-casing', 1], ['circuit', 1]], makes: ['spore-killer', 1] },
    { id: 'mine', name: 'proximity mine', needs: [['circuit', 2], ['spring', 1], ['fuel', 1]], makes: ['mines', 1] },
    { id: 'shieldcell', name: 'shield cell', needs: [['battery', 2], ['circuit', 1], ['wire', 1]], makes: ['shield-cell', 1] },
    { id: 'adrenaline', name: 'adrenaline shot', needs: [['antiseptic', 1], ['battery', 1]], makes: ['adrenaline', 1] },
    { id: 'antifungal', name: 'antifungal shot', needs: [['antiseptic', 2], ['cloth', 1]], makes: ['antifungal', 1] },
    { id: 'navtool', name: 'nav tool', needs: [['circuit', 2], ['battery', 1], ['wire', 1]], makes: ['nav-tool', 1] },
    { id: 'vest', name: 'patched vest', needs: [['cloth', 3], ['spring', 2], ['scrap', 10]], makes: ['vest', 1] },
    { id: 'helmet', name: 'scrap helmet', needs: [['cell-casing', 2], ['cloth', 1], ['scrap', 8]], makes: ['helmet', 1] },
    { id: 'backpack', name: 'backpack', needs: [['cloth', 4], ['spring', 1]], makes: ['backpack', 1] },
    { id: 'crate', name: 'storage crate (elevator)', needs: [['spring', 2], ['wire', 1], ['scrap', 20]], makes: ['storage-crate', 1] },
];
export const SHRED = [0, 3, 5, 6, 8, 10];
export const canCraft = (inv, r) => r.needs.every(([id, n]) => count(inv, id) >= n);
export function craft(inv, r) {
    if (!canCraft(inv, r))
        return 'missing parts';
    if (r.id === 'crate' && (inv.stash?.length ?? 0) >= 16)
        return 'the elevator has no room for another crate';
    for (const [id, n] of r.needs)
        take(inv, id, n);
    const out = make(r.makes[0], r.makes[1]);
    if (ITEMS[out.id].stack)
        out.n = r.makes[1];
    if (give(inv, out)) {
        for (const [id, n] of r.needs)
            give(inv, make(id, n));
        return 'no room in the bag';
    }
    return null;
}
export const STATS = [
    { id: 'health', name: 'max health', per: '+10 max HP' }, { id: 'stamina', name: 'max stamina', per: '+15 stamina' },
    { id: 'regen', name: 'stamina regen', per: '+15 % regen' }, { id: 'looting', name: 'looting speed', per: '−15 % search time' },
    { id: 'flashlight', name: 'flashlight', per: '+10 % range, +6° cone' }, { id: 'spores', name: 'spore resistance', per: '−20 % spore uptake' },
    { id: 'melee', name: 'melee damage', per: '+15 % melee damage' }, { id: 'reload', name: 'reload speed', per: '−12 % reload time' },
    { id: 'vault', name: 'vault speed', per: '−15 % vault time' }, { id: 'limp', name: 'limp threshold', per: 'limp 5 HP later' },
];
export const noUpgrades = () => Object.fromEntries(STATS.map(s => [s.id, 0]));
export const baseMods = () => ({ maxHealth: 0, stamina: 0, regen: 1, loot: 1, lightRange: 1, lightAngle: 0, spores: 1, melee: 1, reload: 1, vault: 1, limp: 0 });
export function modsFor(u, flashHeads = 0) {
    const f = u.flashlight + flashHeads;
    return { maxHealth: 10 * u.health, stamina: 15 * u.stamina, regen: 1 + 0.15 * u.regen, loot: ipow(0.85, u.looting), lightRange: 1 + 0.1 * f, lightAngle: 6 * f,
        spores: ipow(0.8, u.spores), melee: 1 + 0.15 * u.melee, reload: ipow(0.88, u.reload), vault: ipow(0.85, u.vault), limp: -5 * u.limp };
}
export const weaponLevelMul = (it) => 1 + 0.1 * (it.lvl ?? 0);
export { bagFree };
