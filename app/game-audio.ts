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
/** PCM has SWF seek applied exactly once offline and the declared sample count.
 * This avoids browser-dependent MP3 gapless trimming. Adobe decoder comparison is open. */
export class GameAudio {
  private context: AudioContext | null = null;
  private unlocked = false;
  private buffers = new Map<SoundName, AudioBuffer>();
  private active = new Set<AudioBufferSourceNode>();
  async load(progress: (value: number) => void) {
    this.context ??= new AudioContext();
    let loaded = 0;
    const ready = () => progress((++loaded / (SOUND_NAMES.length + 1)) * 100);
    await Promise.all([
      fetch('./game-assets/vector/symbols.svg')
        .then((response) => {
          if (!response.ok) throw new Error('Artwork did not load.');
          return response.text();
        })
        .then(ready),
      ...SOUND_NAMES.map(async (name) => {
        const response = await fetch(`./game-assets/audio/${name}.wav`);
        if (!response.ok) throw new Error('Sound did not load.');
        const buffer = await this.context!.decodeAudioData(
          await response.arrayBuffer(),
        );
        this.buffers.set(name, buffer);
        ready();
      }),
    ]);
  }
  unlock = () => {
    this.unlocked = true;
    if (this.context?.state === 'suspended') void this.context.resume();
  };
  play = (name: SoundName) => {
    const buffer = this.buffers.get(name);
    if (!buffer || !this.context || !this.unlocked) return;
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.context.destination); // Original relative gain = 100%, no per-effect attenuation.
    this.active.add(source);
    source.onended = () => {
      this.active.delete(source);
      source.disconnect();
    };
    source.start();
  };
  silence = () => {
    for (const source of this.active) source.stop();
    this.active.clear();
  };
  close = () => {
    this.silence();
    void this.context?.close();
    this.context = null;
  };
}
