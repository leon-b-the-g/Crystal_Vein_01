const f64 = new Float64Array(1), u32 = new Uint32Array(f64.buffer);
const HI = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1 ? 1 : 0, LO = 1 - HI;
const hiw = (x) => { f64[0] = x; return u32[HI] | 0; };
const low = (x) => { f64[0] = x; return u32[LO]; };
const withHi = (x, h) => { f64[0] = x; u32[HI] = h >>> 0; return f64[0]; };
const fromHi = (h) => { u32[HI] = h >>> 0; u32[LO] = 0; return f64[0]; };
const S1 = -1.66666666666666324348e-01, S2 = 8.33333333332248946124e-03, S3 = -1.98412698298579493134e-04, S4 = 2.75573137070700676789e-06, S5 = -2.50507602534068634195e-08, S6 = 1.58969099521155010221e-10;
function kSin(x, y, iy) {
    if ((hiw(x) & 0x7fffffff) < 0x3e400000 && (x | 0) === 0)
        return x;
    const z = x * x, v = z * x, r = S2 + z * (S3 + z * (S4 + z * (S5 + z * S6)));
    return iy === 0 ? x + v * (S1 + z * r) : x - ((z * (0.5 * y - v * r) - y) - v * S1);
}
const C1 = 4.16666666666666019037e-02, C2 = -1.38888888888741095749e-03, C3 = 2.48015872894767294178e-05, C4 = -2.75573143513906633035e-07, C5 = 2.08757232129817482790e-09, C6 = -1.13596475577881948265e-11;
function kCos(x, y) {
    const ix = hiw(x) & 0x7fffffff;
    if (ix < 0x3e400000 && (x | 0) === 0)
        return 1;
    const z = x * x, r = z * (C1 + z * (C2 + z * (C3 + z * (C4 + z * (C5 + z * C6)))));
    if (ix < 0x3fd33333)
        return 1 - (0.5 * z - (z * r - x * y));
    const qx = ix > 0x3fe90000 ? 0.28125 : fromHi(ix - 0x00200000), hz = 0.5 * z - qx, a = 1 - qx;
    return a - (hz - (z * r - x * y));
}
const invpio2 = 6.36619772367581382433e-01, pio2_1 = 1.57079632673412561417e+00, pio2_1t = 6.07710050650619224932e-11, pio2_2 = 6.07710050630396597660e-11, pio2_2t = 2.02226624879595063154e-21, pio2_3 = 2.02226624871116645580e-21, pio2_3t = 8.47842766036889956997e-32;
let y0 = 0, y1 = 0;
function remPio2(x) {
    const hx = hiw(x), ix = hx & 0x7fffffff;
    if (ix < 0x4002d97c) {
        let z;
        if (hx > 0) {
            z = x - pio2_1;
            if (ix !== 0x3ff921fb) {
                y0 = z - pio2_1t;
                y1 = (z - y0) - pio2_1t;
            }
            else {
                z -= pio2_2;
                y0 = z - pio2_2t;
                y1 = (z - y0) - pio2_2t;
            }
            return 1;
        }
        z = x + pio2_1;
        if (ix !== 0x3ff921fb) {
            y0 = z + pio2_1t;
            y1 = (z - y0) + pio2_1t;
        }
        else {
            z += pio2_2;
            y0 = z + pio2_2t;
            y1 = (z - y0) + pio2_2t;
        }
        return 3;
    }
    const t = ix > 0x413921fb ? Math.abs(x) % 6.283185307179586 : Math.abs(x), fn = Math.floor(t * invpio2 + 0.5), j = hiw(t) >> 20;
    let r = t - fn * pio2_1, w = fn * pio2_1t;
    y0 = r - w;
    let i = j - ((hiw(y0) >> 20) & 0x7ff);
    if (i > 16) {
        let u = r;
        w = fn * pio2_2;
        r = u - w;
        w = fn * pio2_2t - ((u - r) - w);
        y0 = r - w;
        i = j - ((hiw(y0) >> 20) & 0x7ff);
        if (i > 49) {
            u = r;
            w = fn * pio2_3;
            r = u - w;
            w = fn * pio2_3t - ((u - r) - w);
            y0 = r - w;
        }
    }
    y1 = (r - y0) - w;
    const n = fn - 4 * Math.floor(fn / 4);
    if (hx < 0) {
        y0 = -y0;
        y1 = -y1;
        return (4 - n) & 3;
    }
    return n;
}
export function sin(x) {
    const ix = hiw(x) & 0x7fffffff;
    if (ix <= 0x3fe921fb)
        return kSin(x, 0, 0);
    if (ix >= 0x7ff00000)
        return NaN;
    switch (remPio2(x)) {
        case 0: return kSin(y0, y1, 1);
        case 1: return kCos(y0, y1);
        case 2: return -kSin(y0, y1, 1);
        default: return -kCos(y0, y1);
    }
}
export function cos(x) {
    const ix = hiw(x) & 0x7fffffff;
    if (ix <= 0x3fe921fb)
        return kCos(x, 0);
    if (ix >= 0x7ff00000)
        return NaN;
    switch (remPio2(x)) {
        case 0: return kCos(y0, y1);
        case 1: return -kSin(y0, y1, 1);
        case 2: return -kCos(y0, y1);
        default: return kSin(y0, y1, 1);
    }
}
const atanhi = [4.63647609000806093515e-01, 7.85398163397448278999e-01, 9.82793723247329054082e-01, 1.57079632679489655800e+00];
const atanlo = [2.26987774529616870924e-17, 3.06161699786838301793e-17, 1.39033110312309984516e-17, 6.12323399573676603587e-17];
const aT = [3.33333333333329318027e-01, -1.99999999998764832476e-01, 1.42857142725034663711e-01, -1.11111104054623557880e-01, 9.09088713343650656196e-02, -7.69187620504482999495e-02,
    6.66107313738753120669e-02, -5.83357013379057348645e-02, 4.97687799461593236017e-02, -3.65315727442169155270e-02, 1.62858201153657823623e-02];
export function atan(x) {
    const hx = hiw(x), ix = hx & 0x7fffffff;
    let id;
    if (ix >= 0x44100000) {
        if (x !== x)
            return x;
        return hx > 0 ? atanhi[3] + atanlo[3] : -atanhi[3] - atanlo[3];
    }
    if (ix < 0x3fdc0000) {
        if (ix < 0x3e200000)
            return x;
        id = -1;
    }
    else {
        x = Math.abs(x);
        if (ix < 0x3ff30000) {
            if (ix < 0x3fe60000) {
                id = 0;
                x = (2 * x - 1) / (2 + x);
            }
            else {
                id = 1;
                x = (x - 1) / (x + 1);
            }
        }
        else if (ix < 0x40038000) {
            id = 2;
            x = (x - 1.5) / (1 + 1.5 * x);
        }
        else {
            id = 3;
            x = -1 / x;
        }
    }
    const z = x * x, w = z * z;
    const s1 = z * (aT[0] + w * (aT[2] + w * (aT[4] + w * (aT[6] + w * (aT[8] + w * aT[10]))))), s2 = w * (aT[1] + w * (aT[3] + w * (aT[5] + w * (aT[7] + w * aT[9]))));
    if (id < 0)
        return x - x * (s1 + s2);
    const r = atanhi[id] - ((x * (s1 + s2) - atanlo[id]) - x);
    return hx < 0 ? -r : r;
}
const PI = 3.1415926535897931160e+00, PI_LO = 1.2246467991473531772e-16, PI_2 = 1.5707963267948965580e+00, PI_4 = 7.8539816339744827900e-01;
export function atan2(y, x) {
    if (x !== x || y !== y)
        return NaN;
    const hx = hiw(x), ix = hx & 0x7fffffff, lx = low(x), hy = hiw(y), iy = hy & 0x7fffffff, ly = low(y);
    if (((hx - 0x3ff00000) | lx) === 0)
        return atan(y);
    const m = ((hy >> 31) & 1) | ((hx >> 30) & 2);
    if ((iy | ly) === 0)
        return m < 2 ? y : m === 2 ? PI : -PI;
    if ((ix | lx) === 0)
        return hy < 0 ? -PI_2 : PI_2;
    if (ix === 0x7ff00000) {
        if (iy === 0x7ff00000)
            return [PI_4, -PI_4, 3 * PI_4, -3 * PI_4][m];
        return [0, -0, PI, -PI][m];
    }
    if (iy === 0x7ff00000)
        return hy < 0 ? -PI_2 : PI_2;
    const k = (iy - ix) >> 20;
    const z = k > 60 ? PI_2 + 0.5 * PI_LO : hx < 0 && k < -60 ? 0 : atan(Math.abs(y / x));
    switch (m) {
        case 0: return z;
        case 1: return -z;
        case 2: return PI - (z - PI_LO);
        default: return (z - PI_LO) - PI;
    }
}
export const hypot = (x, y) => Math.sqrt(x * x + y * y);
export function ipow(b, n) { let r = 1; for (let i = 0; i < n; i++)
    r *= b; return r; }
