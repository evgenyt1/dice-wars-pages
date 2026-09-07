#!/usr/bin/env python3
"""Preserve original MP3s and trim the already seek-adjusted FFDec PCM to SoundSampleCount.
Decoder equivalence is provisional until an Adobe reference capture is available.
"""
import hashlib,json,sys,wave,shutil
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
source=Path(sys.argv[1] if len(sys.argv)>1 else '/tmp/dice-audio-wav')
manifest=json.loads((ROOT/'docs/flash-reference/manifest.json').read_text())
names={1:'success',2:'my-turn',3:'fail',4:'dice',5:'click',15:'button',151:'game-over',160:'victory'}
shutil.copyfile(ROOT/'docs/flash-reference/button-sound.mp3',ROOT/'public/game-assets/audio/button.mp3')
records=[]
for sound in manifest['sounds']:
    id=sound['id'];name=names[id]
    path=next(source.glob(f'{id}[_.]*wav')) if id<6 else source/f'{id}.wav'
    with wave.open(str(path)) as w:
        assert w.getframerate()==11025 and w.getnchannels()==1 and w.getsampwidth()==2
        total=w.getnframes();pcm=w.readframes(sound['soundSampleCount'])
    target=ROOT/f'public/game-assets/audio/{name}.wav'
    with wave.open(str(target),'wb') as w:
        w.setparams((1,2,11025,0,'NONE','not compressed'));w.writeframes(pcm)
    assert len(pcm)==sound['soundSampleCount']*2
    mp3=ROOT/f'public/game-assets/audio/{name}.mp3'
    assert hashlib.sha256(mp3.read_bytes()).hexdigest()==sound['mp3Sha256']
    records.append({**sound,'name':name,'ffdecWavSamplesAfterSeek':total,'wavSha256':hashlib.sha256(target.read_bytes()).hexdigest()})
(ROOT/'docs/flash-reference/native-audio-manifest.json').write_text(json.dumps({'sourceSha256':manifest['source']['sha256'],'decoder':'FFDec 26.2.1 WAV export, SeekSamples already applied; cropped once to SoundSampleCount','runtimeComparison':'Pending Adobe Flash recording; do not claim decoder/onset equivalence.','sounds':records},indent=2)+'\n')
print('Exported eight original PCM sounds with declared sample counts; preserved all MP3 payloads.')
