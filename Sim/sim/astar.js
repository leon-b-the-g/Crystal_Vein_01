export function astar(w, h, cost, sx, sy, gx, gy, maxNodes = 200000) {
    const idx = (x, y) => y * w + x, g = new Float32Array(w * h).fill(Infinity), from = new Int32Array(w * h).fill(-1), closed = new Uint8Array(w * h);
    const heapI = [], heapF = [];
    const push = (i, f) => { heapI.push(i); heapF.push(f); let k = heapI.length - 1; while (k > 0) {
        const p = (k - 1) >> 1;
        if (heapF[p] <= heapF[k])
            break;
        [heapI[p], heapI[k]] = [heapI[k], heapI[p]];
        [heapF[p], heapF[k]] = [heapF[k], heapF[p]];
        k = p;
    } };
    const pop = () => { const i = heapI[0], last = heapI.pop(), lf = heapF.pop(); if (heapI.length) {
        heapI[0] = last;
        heapF[0] = lf;
        let k = 0;
        for (;;) {
            const l = 2 * k + 1, r = l + 1;
            let m = k;
            if (l < heapI.length && heapF[l] < heapF[m])
                m = l;
            if (r < heapI.length && heapF[r] < heapF[m])
                m = r;
            if (m === k)
                break;
            [heapI[m], heapI[k]] = [heapI[k], heapI[m]];
            [heapF[m], heapF[k]] = [heapF[k], heapF[m]];
            k = m;
        }
    } return i; };
    const hfn = (i) => Math.abs((i % w) - gx) + Math.abs(((i / w) | 0) - gy);
    const s = idx(sx, sy), goal = idx(gx, gy);
    g[s] = 0;
    push(s, hfn(s));
    let n = 0;
    while (heapI.length && n++ < maxNodes) {
        const i = pop();
        if (closed[i])
            continue;
        closed[i] = 1;
        if (i === goal) {
            const path = [];
            for (let c = i; c !== -1; c = from[c])
                path.push(c);
            path.reverse();
            return path.flatMap(c => [c % w, (c / w) | 0]);
        }
        const x = i % w, y = (i / w) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h)
                continue;
            const j = idx(nx, ny);
            if (closed[j])
                continue;
            const c = cost(nx, ny);
            if (c === Infinity)
                continue;
            const ng = g[i] + c;
            if (ng < g[j]) {
                g[j] = ng;
                from[j] = i;
                push(j, ng + hfn(j));
            }
        }
    }
    return null;
}
