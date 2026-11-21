// Reference synthesis for the steel tongue drum experiment.
// Mode ratios, envelopes, the strike burst, and the delay stay as specified.

const NOTES = [
  { name: "C4", frequency: 261.63 },
  { name: "D4", frequency: 293.66 },
  { name: "E4", frequency: 329.63 },
  { name: "G4", frequency: 392.0 },
  { name: "A4", frequency: 440.0 },
  { name: "C5", frequency: 523.25 },
  { name: "D5", frequency: 587.33 },
  { name: "E5", frequency: 659.25 },
];

const modes = [
  [1.0, 0.72],
  [2.01, 0.16],
  [2.93, 0.1],
  [4.18, 0.065],
  [5.43, 0.04],
];

const chord = [0, 2, 3, 5];

const melody = [0, 2, 4, 3, 2, 0, 1, 2, 3, 5, 4, 3, 2, 0];

const settings = {
  decay: 3.5,
  metal: 0.34,
  softness: 0.65,
};

const flashTimers = new Map();
const pendingFlashes = [];

let audio = null;
let master = null;
let lowpass = null;
let delay = null;
let feedback = null;
let wet = null;
let voices = [];
let flashLoop = 0;

const decayInput = document.querySelector("#decay");
const metalInput = document.querySelector("#metal");
const softnessInput = document.querySelector("#softness");
const decayReadout = document.querySelector("#decay-readout");
const metalReadout = document.querySelector("#metal-readout");
const softnessReadout = document.querySelector("#softness-readout");
const enableButton = document.querySelector("#enable");
const status = document.querySelector("#status");

function formatNumber(value) {
  return Number(value).toFixed(2);
}

function setStatus(message) {
  status.textContent = message;
}

function createContext() {
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  return new Ctor();
}

function mountDelay() {
  delay = audio.createDelay(1);
  delay.delayTime.value = 0.19;

  feedback = audio.createGain();
  feedback.gain.value = 0.18;

  wet = audio.createGain();
  wet.gain.value = 0.13;

  master.connect(delay);
  delay.connect(feedback);
  feedback.connect(delay);
  delay.connect(wet);
  wet.connect(audio.destination);
}

function buildGraph() {
  master = audio.createGain();
  master.gain.value = 0.58;

  lowpass = audio.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = 8500;
  lowpass.connect(master);

  master.connect(audio.destination);
  mountDelay();
}

function clearDelay() {
  master.disconnect(delay);
  delay.disconnect();
  feedback.disconnect();
  wet.disconnect();
  mountDelay();
}

function ensureAudio() {
  if (!audio) {
    audio = createContext();
    if (!audio) {
      setStatus("This browser cannot start Web Audio.");
      return null;
    }
    buildGraph();
    enableButton.setAttribute("aria-pressed", "true");
    setStatus("Sound is on.");
  }

  if (audio.state === "suspended") {
    audio.resume();
  }

  return audio;
}

function makeNoiseBuffer() {
  const length = Math.floor(audio.sampleRate * 0.06);
  const buffer = audio.createBuffer(1, length, audio.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < data.length; i += 1) {
    data[i] = (Math.random() * 2 - 1) * Math.exp((-i / data.length) * 9);
  }

  return buffer;
}

function strike(frequency, startTime) {
  const decay = settings.decay;
  const metal = settings.metal;
  const softness = settings.softness;
  const partials = [];

  modes.forEach(([ratio, amp], i) => {
    const vol =
      amp *
      (i === 0 ? 1 : metal * 2.1) *
      (i > 2 ? 1 - softness * 0.55 : 1);

    const oscillator = audio.createOscillator();
    const gain = audio.createGain();

    oscillator.type = "sine";

    oscillator.frequency.setValueAtTime(frequency * ratio, startTime);

    oscillator.frequency.exponentialRampToValueAtTime(
      frequency * ratio * (i === 0 ? 0.998 : 0.999),
      startTime + 0.16,
    );

    gain.gain.setValueAtTime(0.0001, startTime);

    gain.gain.exponentialRampToValueAtTime(
      Math.max(0.0002, vol),
      startTime + 0.008 + softness * 0.015,
    );

    const modeDecay = decay * (i === 0 ? 1 : i === 1 ? 0.62 : 0.36);

    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + modeDecay);

    oscillator.connect(gain);
    gain.connect(lowpass);

    oscillator.start(startTime);
    oscillator.stop(startTime + modeDecay + 0.05);

    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
      if (i === 0) {
        voices = voices.filter((voice) => voice.partials[0].osc !== oscillator);
      }
    };

    partials.push({ osc: oscillator, gain, startTime });
  });

  const noise = audio.createBufferSource();
  noise.buffer = makeNoiseBuffer();

  const filter = audio.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 1300 + frequency;
  filter.Q.value = 0.8;

  const noiseGain = audio.createGain();
  const strikeLevel = 0.09 * (1 - softness);

  if (strikeLevel > 0) {
    noiseGain.gain.setValueAtTime(strikeLevel, startTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.045);
  } else {
    noiseGain.gain.setValueAtTime(0, startTime);
  }

  noise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(master);

  noise.start(startTime);
  noise.stop(startTime + 0.06);

  noise.onended = () => {
    noise.disconnect();
    filter.disconnect();
    noiseGain.disconnect();
  };

  voices.push({
    partials,
    noise,
    noiseGain,
    startTime,
  });
}

function silenceSource(source, gain, startTime, now) {
  const releaseAt = Math.max(now + 0.03, startTime);

  try {
    const hold = Math.max(now, startTime);
    gain.gain.cancelScheduledValues(hold);
    gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), hold);
    gain.gain.exponentialRampToValueAtTime(0.0001, releaseAt);
  } catch (error) {
    // The envelope can already be finished.
  }

  // stop() can be scheduled only once, so a note that already has its
  // natural ending queued must be pulled off the graph instead.
  try {
    source.stop(releaseAt);
  } catch (error) {
    try {
      source.disconnect();
    } catch (disconnectError) {
      // Already disconnected.
    }
    try {
      gain.disconnect();
    } catch (disconnectError) {
      // Already disconnected.
    }
  }
}

function stopVoices() {
  if (!audio) {
    voices = [];
    return;
  }

  const now = audio.currentTime;
  const active = voices;
  voices = [];
  active.forEach((voice) => {
    voice.partials.forEach((partial) => {
      silenceSource(partial.osc, partial.gain, partial.startTime, now);
    });
    silenceSource(voice.noise, voice.noiseGain, voice.startTime, now);
  });
  clearDelay();
}

function flashTongue(index) {
  const tongue = document.querySelector(`.tongue[data-index="${index}"]`);
  if (!tongue) return;

  tongue.classList.add("is-struck");
  const existing = flashTimers.get(index);
  if (existing) clearTimeout(existing);

  flashTimers.set(
    index,
    window.setTimeout(() => {
      tongue.classList.remove("is-struck");
      flashTimers.delete(index);
    }, 160),
  );
}

function queueFlash(index, time) {
  pendingFlashes.push({ index, time });
  if (flashLoop) return;

  const tick = () => {
    if (!audio) {
      flashLoop = 0;
      return;
    }

    const t = audio.currentTime;
    for (let i = pendingFlashes.length - 1; i >= 0; i -= 1) {
      if (pendingFlashes[i].time <= t) {
        flashTongue(pendingFlashes[i].index);
        pendingFlashes.splice(i, 1);
      }
    }

    flashLoop = pendingFlashes.length ? requestAnimationFrame(tick) : 0;
  };

  flashLoop = requestAnimationFrame(tick);
}

function clearFlashes() {
  pendingFlashes.length = 0;
  if (flashLoop) cancelAnimationFrame(flashLoop);
  flashLoop = 0;
  flashTimers.forEach((timer) => clearTimeout(timer));
  flashTimers.clear();
  document.querySelectorAll(".tongue.is-struck").forEach((tongue) => {
    tongue.classList.remove("is-struck");
  });
}

function playIndex(index) {
  const ctx = ensureAudio();
  if (!ctx) return;
  const start = ctx.currentTime + 0.02;
  strike(NOTES[index].frequency, start);
  queueFlash(index, start);
}

function playSequence(indices, stepSeconds, message) {
  const ctx = ensureAudio();
  if (!ctx) return;
  const t0 = ctx.currentTime + 0.02;
  indices.forEach((index, step) => {
    const start = t0 + step * stepSeconds;
    strike(NOTES[index].frequency, start);
    queueFlash(index, start);
  });
  setStatus(message);
}

function stopPerformance() {
  clearFlashes();
  stopVoices();
  setStatus(audio ? "Stopped." : "Sound starts after you enable it or play.");
}

decayInput.addEventListener("input", () => {
  settings.decay = Number(decayInput.value);
  decayReadout.textContent = formatNumber(settings.decay);
});

metalInput.addEventListener("input", () => {
  settings.metal = Number(metalInput.value);
  metalReadout.textContent = formatNumber(settings.metal);
});

softnessInput.addEventListener("input", () => {
  settings.softness = Number(softnessInput.value);
  softnessReadout.textContent = formatNumber(settings.softness);
});

enableButton.addEventListener("click", () => {
  const ctx = ensureAudio();
  if (!ctx) return;
  setStatus("Sound is on.");
});

document.querySelector("#chord").addEventListener("click", () => {
  playSequence(chord, 0.11, "Playing C chord.");
});

document.querySelector("#melody").addEventListener("click", () => {
  playSequence(melody, 0.38, "Playing the gentle melody.");
});

document.querySelector("#stop").addEventListener("click", stopPerformance);

document.querySelectorAll(".tongue").forEach((tongue) => {
  const index = Number(tongue.dataset.index);

  tongue.addEventListener("click", () => {
    playIndex(index);
  });

  tongue.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    playIndex(index);
  });
});
