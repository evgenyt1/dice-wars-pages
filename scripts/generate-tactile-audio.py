"""Rebuild the approved Tactile sounds for the Midnight presentation.

All sounds are newly synthesized; no original sample is used.
Playback is nonblocking. Original game event scheduling remains authoritative.
"""
import array
import hashlib
import json
import math
from pathlib import Path
import random
import wave

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/game-assets/audio/tactile'
RATE = 24000
TAU = math.tau


def blank(seconds):
    return [0.0] * round(RATE * seconds)


def add(dst, signal, when=0, level=1):
    offset = round(when * RATE)
    for i, value in enumerate(signal[:max(0, len(dst) - offset)]):
        dst[offset + i] += level * value


def impact(seconds, pitch=520, material='tactile', seed=1):
    """Damped, inharmonic resonators and a very short band-limited transient."""
    rng = random.Random(seed)
    y = blank(seconds)
    smooth = 0.0
    prior = 0.0
    modes = [(1, 1, .016), (1.61, .37, .010), (2.79, .17, .007), (4.2, .05, .004)]
    if material == 'glass':
        modes = [(1, 1, .031), (2.756, .21, .018), (4.11, .07, .009)]
    for i in range(len(y)):
        t = i / RATE
        noise = rng.uniform(-1, 1)
        smooth += .24 * (noise - smooth)
        transient = (smooth - prior * .5) * math.exp(-t / .0018)
        prior = smooth
        body = sum(a * math.sin(TAU * pitch * f * t) * math.exp(-t / decay) for f, a, decay in modes)
        attack = min(1, t / .0006)
        release = min(1, (seconds - t) / .009)
        y[i] = (body * .56 + transient * .38) * attack * release
    return y


def pluck(seconds, freq, variant='tactile'):
    """Warm, restrained pitched cues, with no buzz/square-wave component."""
    y = blank(seconds)
    for i in range(len(y)):
        t = i / RATE
        attack = 1 - math.exp(-t / .003)
        tail = min(1, (seconds - t) / .035)
        decay = math.exp(-t / (seconds * .21))
        if variant == 'glass':
            fm = 1.5 * math.sin(TAU * freq * 2.001 * t) * math.exp(-t / .017)
            body = math.sin(TAU * freq * t + fm) + .14 * math.sin(TAU * freq * 3 * t) * math.exp(-t / .040)
        else:
            body = math.sin(TAU * freq * t) + .24 * math.sin(TAU * freq * 2 * t) * math.exp(-t / .025)
        y[i] = .65 * body * attack * decay * tail
    return y


def pad(seconds, frequencies, variant):
    y = blank(seconds)
    for i in range(len(y)):
        t = i / RATE
        env = (1 - math.exp(-t / .035)) * math.exp(-t / (seconds * .25)) * min(1, (seconds - t) / .1)
        body = sum(math.sin(TAU * f * t) + .10 * math.sin(TAU * f * 2 * t) for f in frequencies) / len(frequencies)
        y[i] = body * env * (.22 if variant == 'tactile' else .17)
    return y


def sequence(seconds, notes, variant):
    out = blank(seconds)
    for when, freq, length, amp in notes:
        add(out, pluck(length, freq, variant), when, amp)
    return out


def bank(variant):
    glass = variant == 'glass'
    sounds = {}
    sounds['button'] = blank(.140)
    add(sounds['button'], impact(.110, 830 if glass else 410, variant, 30), 0, .62)
    add(sounds['button'], impact(.055, 1190 if glass else 665, variant, 31), .017, .18)
    sounds['click'] = impact(.060, 1250 if glass else 735, variant, 11)
    sounds['dice'] = blank(.034)
    for when, f, amp, seed in [(0, 840, .54, 41), (.009, 1370, .27, 42), (.019, 610, .17, 43)]:
        add(sounds['dice'], impact(.014, f * (1.32 if glass else 1), variant, seed), when, amp)
    turn_notes = [(0, 783.99 if glass else 523.25, .125, .8), (.051, 1174.66 if glass else 783.99, .119, .66)]
    sounds['my-turn'] = sequence(.170, turn_notes, variant)
    sounds['success'] = sequence(.224, [(0, 587.33 if glass else 440, .17, .6), (.043, 880 if glass else 659.25, .181, .8)], variant)
    sounds['fail'] = sequence(.300, [(0, 392 if glass else 293.66, .22, .68), (.059, 293.66 if glass else 220, .241, .6)], variant)
    sounds['game-over'] = sequence(.950, [(0, 523.25 if glass else 392, .52, .62), (.15, 440 if glass else 329.63, .50, .54), (.31, 349.23 if glass else 261.63, .64, .57)], variant)
    add(sounds['game-over'], pad(.9, [130.81, 196], variant), .05)
    sounds['victory'] = sequence(1.450, [(0, 523.25, .55, .60), (.135, 659.25, .60, .60), (.27, 783.99, .68, .54), (.42, 1046.5, 1.03, .65)], variant)
    add(sounds['victory'], pad(1.2, [261.63, 329.63, 392], variant), .25)
    return sounds


def write(path, signal, peak=.56):
    path.parent.mkdir(parents=True, exist_ok=True)
    maximum = max(abs(v) for v in signal)
    values = [v * peak / maximum for v in signal]
    # All assets end at zero to prevent clicks, including the shortest impact.
    values[0] = values[-1] = 0.0
    pcm = array.array('h', (round(max(-1, min(1, v)) * 32767) for v in values))
    import sys
    if sys.byteorder != 'little':
        pcm.byteswap()
    with wave.open(str(path), 'wb') as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(RATE)
        f.writeframes(pcm.tobytes())
    return {'duration': len(values) / RATE, 'peak': max(abs(v) for v in values), 'rms': math.sqrt(sum(v*v for v in values)/len(values)), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}


sounds = bank('tactile')
manifest = {
    'sample_rate': RATE,
    'provenance': 'Original deterministic modal/pluck synthesis; no source audio used.',
    'timing': 'Retain every existing controller trigger and 24 fps scheduling. Clip lengths are presentation-only, no waits added.',
    'sounds': {},
    'playback_gain': .65,
}
for name, signal in sounds.items():
    peak = {'dice': .35, 'click': .43, 'button': .47, 'my-turn': .49, 'success': .48, 'fail': .42, 'game-over': .48, 'victory': .54}[name]
    manifest['sounds'][name] = write(OUT / (name+'.wav'), signal, peak)
(OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2)+'\n')
print('Rebuilt the eight approved Tactile WAV files.')
