const AIM_Q = 4, AIM_MAX = 32767 / AIM_Q;
const clamp = (v, a) => v > a ? a : v < -a ? -a : v === v ? v : 0;
const BITS = ['sprint', 'crouch', 'fire', 'light', 'interact', 'vault', 'reload', 'swap', 'drop', 'bag'];
export const INPUT_BYTES = 8;
export function encodeInput(inp, out = new Uint8Array(INPUT_BYTES), off = 0) {
    const v = new DataView(out.buffer, out.byteOffset + off, INPUT_BYTES);
    v.setInt8(0, Math.round(clamp(inp.x, 1) * 127));
    v.setInt8(1, Math.round(clamp(inp.y, 1) * 127));
    v.setInt16(2, Math.round(clamp(inp.aimX, AIM_MAX) * AIM_Q), true);
    v.setInt16(4, Math.round(clamp(inp.aimY, AIM_MAX) * AIM_Q), true);
    let b = 0;
    BITS.forEach((k, i) => { if (inp[k])
        b |= 1 << i; });
    b |= (inp.quick >= 0 && inp.quick < 4 ? inp.quick + 1 : 0) << 10;
    v.setUint16(6, b, true);
    return out;
}
export function decodeInput(buf, off = 0) {
    const v = new DataView(buf.buffer, buf.byteOffset + off, INPUT_BYTES), b = v.getUint16(6, true);
    const inp = { x: v.getInt8(0) / 127, y: v.getInt8(1) / 127, aimX: v.getInt16(2, true) / AIM_Q, aimY: v.getInt16(4, true) / AIM_Q, quick: ((b >> 10) & 7) - 1 };
    BITS.forEach((k, i) => { inp[k] = (b & (1 << i)) !== 0; });
    return inp;
}
const BIND = { up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], sprint: ['ShiftLeft', 'ShiftRight'], crouch: ['ControlLeft', 'KeyC'], light: ['KeyF'], interact: ['KeyE'], vault: ['Space'], reload: ['KeyR'], swap: ['KeyQ'], drop: ['KeyX'], bag: ['Tab'], quick: ['Digit1', 'Digit2', 'Digit3', 'Digit4'] };
export function createInput(canvas, touch = null) {
    const down = new Set(), pressed = new Set();
    let mouseX = 0, mouseY = 0, fire = false, wheel = 0, clickAt = null, rclickAt = null;
    addEventListener('keydown', e => { if (e.target instanceof HTMLInputElement)
        return; const code = e.altKey ? 'Alt' + e.code : e.code; if (!down.has(code))
        pressed.add(code); down.add(code); if (e.code.startsWith('Arrow') || e.code === 'Space' || e.code === 'F1' || e.code === 'Tab' || e.altKey)
        e.preventDefault(); });
    addEventListener('keyup', e => { down.delete(e.code); down.delete('Alt' + e.code); });
    let mousePid = -1;
    const release = () => { down.clear(); fire = false; mousePid = -1; touch?.cancelAll(); };
    addEventListener('blur', release);
    document.addEventListener('visibilitychange', () => { if (document.hidden)
        release(); });
    canvas.addEventListener('pointermove', e => { if (e.pointerType === 'touch') {
        if (touch?.move(e))
            return;
        if (e.pointerId !== mousePid)
            return;
    } mouseX = e.clientX; mouseY = e.clientY; });
    canvas.addEventListener('pointerdown', e => {
        if (e.pointerType === 'touch') {
            e.preventDefault();
            if (touch?.down(e))
                return;
            if (mousePid >= 0)
                return;
            mousePid = e.pointerId;
            mouseX = e.clientX;
            mouseY = e.clientY;
        }
        if (e.button === 0) {
            fire = true;
            clickAt = [e.clientX, e.clientY];
        }
        if (e.button === 2)
            rclickAt = [e.clientX, e.clientY];
    });
    const lift = (e) => { if (e.pointerType === 'touch') {
        if (touch?.up(e))
            return;
        if (e.pointerId !== mousePid)
            return;
        mousePid = -1;
    } if (e.button === 0 || e.pointerType === 'touch')
        fire = false; };
    canvas.addEventListener('pointerup', lift);
    canvas.addEventListener('pointercancel', lift);
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('wheel', e => { wheel += Math.sign(e.deltaY); }, { passive: true });
    const any = (codes) => codes.some(c => down.has(c) || !!touch?.keyDown(c)), once = (codes) => codes.some(c => pressed.has(c) || !!touch?.keyPressed(c));
    return {
        justPressed: (code) => pressed.has(code) || !!touch?.keyPressed(code),
        shift: () => down.has('ShiftLeft') || down.has('ShiftRight'),
        clicked: () => clickAt, consumeClick: () => { clickAt = null; }, rclicked: () => { const r = rclickAt; rclickAt = null; return r; }, held: () => fire, mouse: () => [mouseX, mouseY], altDown: () => down.has('AltLeft') || down.has('AltRight'), keyDown: (c) => down.has(c) || down.has('Alt' + c),
        endFrame: () => { pressed.clear(); wheel = 0; touch?.endFrame(); },
        snapshot: () => {
            const t = touch?.moveVec();
            return {
                x: t?.x || (any(BIND.right) ? 1 : 0) - (any(BIND.left) ? 1 : 0), y: t?.y || (any(BIND.down) ? 1 : 0) - (any(BIND.up) ? 1 : 0),
                aimX: 0, aimY: 0, sprint: any(BIND.sprint) || !!t?.sprint, crouch: any(BIND.crouch), fire, light: once(BIND.light), interact: once(BIND.interact), vault: once(BIND.vault),
                reload: once(BIND.reload), swap: once(BIND.swap) || wheel !== 0, drop: once(BIND.drop), bag: once(BIND.bag), quick: BIND.quick.findIndex(c => pressed.has(c) || !!touch?.keyPressed(c)),
            };
        },
    };
}
