import { assetUrl } from './asset-url.ts';
import type { SoundName } from './game-controller';
const SOUND_NAMES: SoundName[] = [
  'success',
  'my-turn',
  'fail',
  'dice',
  'click',
  'button',
  'game-over',
  'victory',
];
/** A resumed context whose clock advances less than this is not producing audio. */
const HEALTH_WINDOW_MS = 300;
/** Approved Tactile PCM bank. Cues keep the controller's exact trigger schedule.
 * Original SWF audio and its sample metadata remain preserved alongside this bank. */
export class GameAudio {
  private context: AudioContext | null = null;
  private unlocked = false;
  /** Set after backgrounding or an interruption, until the context proves healthy. */
  private suspect = false;
  private clock: { time: number; at: number } | null = null;
  private buffers = new Map<SoundName, AudioBuffer>();
  private active = new Set<AudioBufferSourceNode>();
  /** Settles when the first load finishes; decoding uses the loader's context. */
  private loading: Promise<void> | null = null;
  private replacements = 0;
  private readonly now: () => number;
  constructor(now: () => number = () => performance.now()) {
    this.now = now;
  }
  private createContext() {
    const context = new AudioContext();
    context.onstatechange = () => {
      if (this.context !== context) return;
      // iOS reports "interrupted" for calls, Siri, lock and app switches.
      if (context.state === 'interrupted') this.markSuspect();
      // Measure health from the moment playback claims to run again.
      else if (context.state === 'running' && this.suspect) this.sampleClock();
    };
    this.context = context;
    return context;
  }
  async load(progress: (value: number) => void) {
    let settle = () => {};
    this.loading = new Promise((resolve) => (settle = resolve));
    try {
      await this.decodeAll(progress);
    } finally {
      settle();
      this.loading = null;
    }
  }
  private async decodeAll(progress: (value: number) => void) {
    const context = this.context ?? this.createContext();
    if (this.unlocked) this.resume();
    let loaded = 0;
    // Dice paths are already resident in the client module before this loader runs.
    const ready = () => progress((++loaded / SOUND_NAMES.length) * 100);
    await Promise.all(
      SOUND_NAMES.map(async (name) => {
        const response = await fetch(
          assetUrl(`game-assets/audio/tactile/${name}.wav`),
        );
        if (!response.ok) throw new Error('Sound did not load.');
        // Decoded buffers are context-independent, so a replacement context reuses them.
        const buffer = await context.decodeAudioData(
          await response.arrayBuffer(),
        );
        // Match the approved audition's gain once at load; no playback timers,
        // pitch changes, compressor latency, or changes to relative cue levels.
        for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
          const samples = buffer.getChannelData(channel);
          for (let i = 0; i < samples.length; i++) samples[i] *= 0.65;
        }
        this.buffers.set(name, buffer);
        ready();
      }),
    );
  }
  private markSuspect() {
    this.suspect = true;
    this.clock = null;
  }
  private sampleClock() {
    if (this.context)
      this.clock = { time: this.context.currentTime, at: this.now() };
  }
  private resume() {
    const context = this.context;
    // Safari also reports "interrupted" after an app/tab switch or screen lock.
    if (context && context.state !== 'running' && context.state !== 'closed')
      void context.resume().catch(() => {
        // A touch-start may not grant playback. Retry on touch-end/click.
      });
  }
  /**
   * After returning from the background, WebKit can leave a context suspended,
   * interrupted, or "running" with a frozen clock; resume() alone never recovers
   * it. Only a user gesture may start a replacement, so decide here.
   */
  private needsReplacement() {
    const context = this.context;
    if (!context || context.state === 'closed') return true;
    if (!this.suspect) return false;
    if (context.state !== 'running') return true;
    const clock = this.clock;
    if (!clock) {
      this.sampleClock();
      return false;
    }
    const elapsed = this.now() - clock.at;
    if (elapsed < HEALTH_WINDOW_MS) return false;
    if (context.currentTime - clock.time < elapsed / 4000) return true;
    this.suspect = false; // The clock advances: the existing context is healthy.
    this.clock = null;
    return false;
  }
  private replaceContext() {
    const previous = this.context;
    this.silence();
    this.createContext();
    this.replacements++;
    this.suspect = false;
    this.clock = null;
    if (previous && previous.state !== 'closed') {
      const close = () => void previous.close().catch(() => undefined);
      // A tap during the first load must not close the context still decoding.
      if (this.loading) void this.loading.then(close);
      else close();
    }
  }
  /** True when this call moved the page onto the media ("playback") session. */
  private requestPlaybackSession() {
    try {
      // iOS 16.4+: route game audio as media, so the silent switch does not mute it.
      // Requested on interaction only, so opening the page never stops other audio.
      const session = (
        navigator as Navigator & {
          audioSession?: { type: string };
        }
      ).audioSession;
      if (!session || session.type === 'playback') return false;
      session.type = 'playback';
      return session.type === 'playback';
    } catch {
      // Browsers without AudioSession still use ordinary gesture-unlocked audio.
      return false;
    }
  }
  unlock = () => {
    this.unlocked = true;
    // WebKit applies the session category when a context starts. The loader's
    // context started under the default ambient session, which the silent switch
    // mutes, so a category change rebuilds the context inside this gesture.
    const sessionChanged = this.requestPlaybackSession();
    if (this.needsReplacement() || sessionChanged) this.replaceContext();
    this.resume();
  };
  /** Page shown again: try without a gesture, and judge health on the next gesture. */
  recover = () => {
    if (!this.unlocked) return;
    this.resume();
    this.sampleClock();
  };
  /** Page hidden: drop queued cues so recovery never replays them. */
  background = () => {
    this.silence();
    if (this.unlocked) this.markSuspect();
  };
  play = (name: SoundName) => {
    const buffer = this.buffers.get(name);
    if (!buffer || !this.context || !this.unlocked) return;
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.context.destination);
    this.active.add(source);
    source.onended = () => {
      this.active.delete(source);
      source.disconnect();
    };
    source.start();
  };
  silence = () => {
    for (const source of this.active) {
      try {
        source.stop();
      } catch {
        // A source on a closed or never-started context may reject stop().
      }
    }
    this.active.clear();
  };
  /** Diagnostics for Web Inspector on a device: `dicefrontAudio()`. */
  status = () => ({
    unlocked: this.unlocked,
    state: this.context?.state ?? 'none',
    currentTime: this.context?.currentTime ?? 0,
    session:
      (navigator as Navigator & { audioSession?: { type: string } })
        .audioSession?.type ?? 'unsupported',
    suspect: this.suspect,
    replacements: this.replacements,
    buffers: this.buffers.size,
  });
  close = () => {
    this.silence();
    void this.context?.close();
    this.context = null;
    this.unlocked = false;
  };
}
