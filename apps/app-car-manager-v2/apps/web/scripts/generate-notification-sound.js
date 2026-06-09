#!/usr/bin/env node
/**
 * Generate a simple notification sound (two-tone chime) as a WAV file.
 *
 * Run: node scripts/generate-notification-sound.js
 * Output: public/sounds/notification.mp3 (actually WAV but browsers handle it)
 *
 * This creates a pleasant E5-G5 chime, similar to many mobile notification sounds.
 */

const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 44100;
const DURATION = 0.35; // seconds

function generateTone(frequency, duration, sampleRate, startTime = 0, fadeIn = 0.02, fadeOut = 0.05) {
  const samples = Math.floor(duration * sampleRate);
  const startSample = Math.floor(startTime * sampleRate);
  const buffer = new Float32Array(samples);

  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    // Sine wave
    let sample = Math.sin(2 * Math.PI * frequency * t);

    // Apply envelope
    const fadeInSamples = Math.floor(fadeIn * sampleRate);
    const fadeOutSamples = Math.floor(fadeOut * sampleRate);

    if (i < fadeInSamples) {
      sample *= i / fadeInSamples;
    } else if (i > samples - fadeOutSamples) {
      sample *= (samples - i) / fadeOutSamples;
    }

    buffer[i] = sample * 0.3; // Volume
  }

  return { buffer, startSample };
}

function createWavFile(samples, sampleRate) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * bitsPerSample / 8;
  const blockAlign = numChannels * bitsPerSample / 8;
  const dataSize = samples.length * blockAlign;
  const fileSize = 36 + dataSize;

  const buffer = Buffer.alloc(44 + dataSize);
  let offset = 0;

  // RIFF header
  buffer.write('RIFF', offset); offset += 4;
  buffer.writeUInt32LE(fileSize, offset); offset += 4;
  buffer.write('WAVE', offset); offset += 4;

  // fmt chunk
  buffer.write('fmt ', offset); offset += 4;
  buffer.writeUInt32LE(16, offset); offset += 4; // chunk size
  buffer.writeUInt16LE(1, offset); offset += 2; // PCM
  buffer.writeUInt16LE(numChannels, offset); offset += 2;
  buffer.writeUInt32LE(sampleRate, offset); offset += 4;
  buffer.writeUInt32LE(byteRate, offset); offset += 4;
  buffer.writeUInt16LE(blockAlign, offset); offset += 2;
  buffer.writeUInt16LE(bitsPerSample, offset); offset += 2;

  // data chunk
  buffer.write('data', offset); offset += 4;
  buffer.writeUInt32LE(dataSize, offset); offset += 4;

  // Write samples
  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    const intSample = Math.floor(sample * 32767);
    buffer.writeInt16LE(intSample, offset);
    offset += 2;
  }

  return buffer;
}

function main() {
  // Generate two-tone chime: E5 (659Hz) then G5 (784Hz)
  const tone1 = generateTone(659, 0.15, SAMPLE_RATE, 0);
  const tone2 = generateTone(784, 0.2, SAMPLE_RATE, 0.15);

  const totalSamples = Math.floor(DURATION * SAMPLE_RATE);
  const mixed = new Float32Array(totalSamples);

  // Mix tone 1
  for (let i = 0; i < tone1.buffer.length && i < totalSamples; i++) {
    mixed[i] += tone1.buffer[i];
  }

  // Mix tone 2
  const tone2Start = Math.floor(0.15 * SAMPLE_RATE);
  for (let i = 0; i < tone2.buffer.length && (i + tone2Start) < totalSamples; i++) {
    mixed[i + tone2Start] += tone2.buffer[i];
  }

  const wavBuffer = createWavFile(mixed, SAMPLE_RATE);

  const outputDir = path.join(__dirname, '..', 'public', 'sounds');
  const outputFile = path.join(outputDir, 'notification.wav');

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputFile, wavBuffer);
  console.log(`Generated notification sound: ${outputFile}`);
  console.log(`File size: ${wavBuffer.length} bytes`);
}

main();
