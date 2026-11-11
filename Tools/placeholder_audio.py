"""Writes the placeholder sounds the web build's library has no recording for, into Audio/placeholder.

    python Tools/placeholder_audio.py        (from the project folder; plain Python 3, no packages)

They are the sounds apps/x-stranded/src/audio.ts synthesises in the browser, rendered to files, plus the noisemaker's beep.
src/cues.ts names them (EXTRA). Replace a file here with a recording of the same name and it is used as it is: mono, 16 bit.
The same seed gives the same files, so running this again changes nothing.
"""
import math, os, random, struct, wave

SR = 44100
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'Audio', 'placeholder')


def write(name, samples, peak=0.8):
    top = max(1e-9, max(abs(v) for v in samples))
    data = b''.join(struct.pack('<h', int(max(-1.0, min(1.0, v * peak / top)) * 32767)) for v in samples)
    with wave.open(os.path.join(OUT, name), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(data)
    print(f'{name}: {len(samples) / SR:.2f} s')


def sweep(f0, f1, dur):
    """a tone gliding from f0 to f1 that dies away: audio.ts's tone()"""
    n, phase, out = int(dur * SR), 0.0, []
    for i in range(n):
        t = i / n
        phase += 2 * math.pi * f0 * (f1 / f0) ** t / SR
        out.append(math.sin(phase) * 0.001 ** t)
    return out


def lowpass(x, cutoff):
    a, y, out = 1 - math.exp(-2 * math.pi * cutoff / SR), 0.0, []
    for v in x:
        y += a * (v - y)
        out.append(y)
    return out


def highpass(x, cutoff):
    return [v - low for v, low in zip(x, lowpass(x, cutoff))]


def burst(rnd, dur, shape):
    """noise through `shape` that dies away: audio.ts's noise()"""
    n = int(dur * SR)
    return [v * 0.001 ** (i / n) for i, v in enumerate(shape([rnd.uniform(-1, 1) for _ in range(n)]))]


def mix(into, part, at, gain=1.0):
    start = int(at * SR)
    for i, v in enumerate(part):
        if start + i < len(into):
            into[start + i] += v * gain


def heartbeat(rnd):
    out = [0.0] * int(0.5 * SR)
    mix(out, sweep(62, 40, 0.16), 0.0)                      # lub
    mix(out, sweep(55, 38, 0.14), 0.22, 0.7)                # dub
    mix(out, burst(rnd, 0.08, lambda x: lowpass(x, 180)), 0.0, 0.5)   # a little body, for speakers that cannot play 50 Hz
    mix(out, burst(rnd, 0.07, lambda x: lowpass(x, 180)), 0.22, 0.35)
    return out


def hurt(rnd):
    out = [0.0] * int(0.3 * SR)
    mix(out, sweep(70, 35, 0.25), 0.0)
    mix(out, burst(rnd, 0.18, lambda x: lowpass(x, 700)), 0.0, 0.7)
    return out


def fire_loop(rnd):
    dur, fade = 4.0, 0.3
    n = int((dur + fade) * SR)
    bed = highpass(lowpass(lowpass([rnd.uniform(-1, 1) for _ in range(n)], 1600), 1600), 250)   # a roar, not a hiss
    # the bed breathes: a slow random level between a half and full
    level, target = 0.75, 0.75
    for i in range(n):
        if i % 4410 == 0:
            target = rnd.uniform(0.5, 1.0)
        level += (target - level) * 0.0004
        bed[i] *= level
    for _ in range(70):                                      # pops and cracks on top
        mix(bed, burst(rnd, rnd.uniform(0.008, 0.03), lambda x: highpass(x, rnd.uniform(1500, 5000))), rnd.uniform(0, dur), rnd.uniform(0.25, 0.9))
    # the tail is folded over the head, so the end runs into the start without a click
    tail = int(fade * SR)
    for i in range(tail):
        k = i / tail
        bed[i] = bed[i] * math.sqrt(k) + bed[n - tail + i] * math.sqrt(1 - k)
    return bed[:n - tail]


def noisemaker_loop():
    out = [0.0] * int(1.2 * SR)
    for at in (0.0, 0.16):                                   # pip-pip, then quiet: nothing else on the deck sounds like it
        n = int(0.08 * SR)
        edge = int(0.004 * SR)
        beep = [(math.sin(2 * math.pi * 2400 * i / SR) + 0.5 * math.sin(2 * math.pi * 3600 * i / SR)) * min(1.0, i / edge, (n - i) / edge) for i in range(n)]
        mix(out, beep, at)
    return out


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    rnd = random.Random(20261111)
    write('heartbeat.wav', heartbeat(rnd))
    write('hurt.wav', hurt(rnd))
    write('fire-loop.wav', fire_loop(rnd), 0.6)
    write('noisemaker-loop.wav', noisemaker_loop(), 0.7)
