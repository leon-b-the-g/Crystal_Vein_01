export function next32(state) {
    const s = (state + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return [((t ^ (t >>> 14)) >>> 0) / 4294967296, s];
}
export function mulberry32(seed) {
    let s = seed >>> 0;
    const next = () => { const [v, ns] = next32(s); s = ns; return v; };
    return { next, int: n => Math.floor(next() * n), range: (a, b) => a + next() * (b - a), pick: a => a[Math.floor(next() * a.length)] };
}
export function hash(str, seed = 0) {
    let h = (0x811c9dc5 ^ seed) >>> 0;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h;
}
export const stream = (seed, name) => mulberry32(hash(name, seed));
