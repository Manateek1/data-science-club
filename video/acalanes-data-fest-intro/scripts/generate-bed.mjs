import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const sampleRate = 44_100;
const duration = 14.4;
const frameCount = Math.round(sampleRate * duration);
const left = new Float32Array(frameCount);
const right = new Float32Array(frameCount);
const beatLength = 0.6;
const barLength = beatLength * 4;

// Original, soft electronic backing: warm sustained chords, bright plucks,
// and a low pulse that follows the event-card transitions.
const chords = [
  [130.81, 164.81, 196.0, 246.94],
  [146.83, 196.0, 246.94, 293.66],
  [110.0, 130.81, 164.81, 196.0],
  [87.31, 130.81, 174.61, 220.0],
  [130.81, 164.81, 196.0, 246.94],
  [98.0, 146.83, 196.0, 246.94],
];
const pluckNotes = [
  523.25, 659.25, 783.99, 659.25,
  587.33, 783.99, 659.25, 493.88,
  523.25, 659.25, 783.99, 880.0,
];
const voicePans = [-0.48, -0.18, 0.18, 0.48];
const panGains = (pan) => [Math.sqrt((1 - pan) / 2), Math.sqrt((1 + pan) / 2)];

for (let frame = 0; frame < frameCount; frame += 1) {
  const time = frame / sampleRate;
  const chordIndex = Math.min(chords.length - 1, Math.floor(time / barLength));
  const localBarTime = time - chordIndex * barLength;
  const chordAttack = Math.min(1, localBarTime / 0.34);
  const chordRelease = Math.min(1, (barLength - localBarTime) / 0.42);
  const padEnvelope = Math.min(chordAttack, chordRelease);
  const sway = 0.94 + 0.06 * Math.sin(2 * Math.PI * 0.18 * time);
  let sampleLeft = 0;
  let sampleRight = 0;

  for (let voice = 0; voice < chords[chordIndex].length; voice += 1) {
    const frequency = chords[chordIndex][voice];
    const phase = 2 * Math.PI * frequency * time;
    const tone = Math.sin(phase) + 0.18 * Math.sin(phase * 2 + 0.23);
    const volume = 0.045 * padEnvelope * sway;
    const [panLeft, panRight] = panGains(voicePans[voice]);
    sampleLeft += tone * volume * panLeft;
    sampleRight += tone * volume * panRight;
  }

  const beatIndex = Math.min(23, Math.floor(time / beatLength));
  const beatAge = time - beatIndex * beatLength;
  const pluckAge = beatAge - 0.08;
  if (pluckAge >= 0 && pluckAge < 0.38) {
    const frequency = pluckNotes[beatIndex % pluckNotes.length];
    const phase = 2 * Math.PI * frequency * pluckAge;
    const attack = 1 - Math.exp(-pluckAge / 0.006);
    const decay = Math.exp(-pluckAge / 0.23);
    const tone = Math.sin(phase) + 0.2 * Math.sin(phase * 2.01);
    const [panLeft, panRight] = panGains(beatIndex % 2 === 0 ? -0.28 : 0.28);
    const volume = 0.12 * attack * decay;
    sampleLeft += tone * volume * panLeft;
    sampleRight += tone * volume * panRight;
  }

  if (beatIndex % 4 === 0 && beatAge < 0.18) {
    const kickFrequency = 78 - 34 * (beatAge / 0.18);
    const kick = Math.sin(2 * Math.PI * kickFrequency * beatAge) * Math.exp(-beatAge / 0.055) * 0.13;
    sampleLeft += kick;
    sampleRight += kick;
  }

  const fadeIn = Math.min(1, time / 0.38);
  const fadeOut = Math.min(1, (duration - time) / 0.5);
  const fade = Math.min(fadeIn, fadeOut);
  left[frame] = sampleLeft * fade;
  right[frame] = sampleRight * fade;
}

let peak = 0;
for (let frame = 0; frame < frameCount; frame += 1) {
  peak = Math.max(peak, Math.abs(left[frame]), Math.abs(right[frame]));
}
const gain = 0.88 / peak;
const pcm = Buffer.alloc(frameCount * 4);
for (let frame = 0; frame < frameCount; frame += 1) {
  const l = Math.max(-1, Math.min(1, left[frame] * gain));
  const r = Math.max(-1, Math.min(1, right[frame] * gain));
  pcm.writeInt16LE(Math.round(l * 32767), frame * 4);
  pcm.writeInt16LE(Math.round(r * 32767), frame * 4 + 2);
}

const wav = Buffer.alloc(44 + pcm.length);
wav.write("RIFF", 0);
wav.writeUInt32LE(36 + pcm.length, 4);
wav.write("WAVE", 8);
wav.write("fmt ", 12);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(2, 22);
wav.writeUInt32LE(sampleRate, 24);
wav.writeUInt32LE(sampleRate * 4, 28);
wav.writeUInt16LE(4, 32);
wav.writeUInt16LE(16, 34);
wav.write("data", 36);
wav.writeUInt32LE(pcm.length, 40);
pcm.copy(wav, 44);

const output = fileURLToPath(new URL("../assets/data-fest-bed.wav", import.meta.url));
await writeFile(output, wav);
console.log(`Wrote original ${duration}s stereo music bed: ${output}`);
