# Steel tongue drum

A standalone sound-design experiment for Void to Sound. It is a reference recording of one metallic tongue, kept separate from the Wishing Lights app so later ornament sounds can be compared with this character.

Eight tongues sit on a circular steel shell. More than one can ring at the same time. Each tongue is five sine partials plus a short mallet click, sent through a feedback delay.

## Run

From this folder:

```bash
python3 -m http.server 5175
```

Open http://localhost:5175 and press **Enable Sound**. Browsers start audio only after a click or tap. Striking a tongue, Play C Chord, or Gentle Melody also starts the audio context.

## How a steel tongue drum sounds

A steel tongue drum is a hollow steel vessel with tongue-shaped slots cut into the playing surface. Each tongue stays attached along one end and is free along the other, so a strike bends it like a stiff bar.

The pitch is the tongue’s lowest flexing mode. The higher modes are inharmonic: they are not integer multiples of the fundamental, because a bar’s stiffness shifts them away from the harmonic series a string would make. Those partials are what read as metal. They also die faster than the fundamental. The mallet adds a short click, and the cavity radiates the tone with a brief bloom after the strike.

## How this model works

Each note is five sine oscillators. Their frequency ratios are slightly off the harmonic series, which is the inharmonic part of the model:

```javascript
const modes = [
  [1.00, 0.72],
  [2.01, 0.16],
  [2.93, 0.10],
  [4.18, 0.065],
  [5.43, 0.04]
];
```

The first number is the ratio against the played note. The second is that partial’s amplitude coefficient. A real tongue has many more modes; these five are enough for the fundamental, a near-octave metallic edge, and three higher glints.

Each partial has its own decay. The fundamental rings for the full resonance time. The second partial lasts 0.62 of that, and the upper three last 0.36. Higher bar modes lose energy faster, so the tone starts bright and settles into the fundamental.

The first 160 ms also bends the pitch down a little: the fundamental falls to 0.998 of its frequency, and the other partials fall to 0.999. That is the tongue displacing under the mallet and springing back.

The oscillators sum through one low-pass filter at 8500 Hz, then into the master. The filter takes off a little digital edge without turning the partials into a dull drum.

The strike itself is a separate 0.06 second noise burst. Each sample is white noise with an exponential fade:

```javascript
data[i] =
  (Math.random() * 2 - 1) *
  Math.exp((-i / data.length) * 9);
```

A band-pass filter centered at `1300 + frequency` Hz, with Q 0.8, makes the click follow the tongue. Higher notes tick higher. The noise goes to the master, not through the 8500 Hz low-pass, so the contact stays sharper than the ringing partials.

The body bloom is a feedback delay, not a convolution reverb. The master is both the dry output and the delay send. The delay feeds itself, and a quieter wet copy reaches the speakers.

```text
Oscillators + Strike Noise
           |
        Master
        /    \
    Dry       Delay
     |          |
Destination   Feedback
                |
               Wet
                |
           Destination
```

The dry path is the master gain connected straight to the destination. Feedback returns to the delay input.

Every strike builds its own oscillators and noise burst. Nothing stops the previous note, so tongues overlap until they decay or until Stop.

## Parameters

Three controls are meant to move. Everything else is the preserved instrument.

| Control | Range | Default | What it changes |
| --- | --- | --- | --- |
| Resonance / Sustain (`decay`) | 0.6–6 seconds | 3.5 | How long the fundamental rings. The second partial uses 0.62× this time, and the upper partials use 0.36×. |
| Metallic Overtones (`metal`) | 0–1 | 0.34 | Level of every partial except the fundamental. Those partials are scaled by `metal * 2.1`. At 0 the tone is almost a pure sine. At 1 the inharmonic edge is fully open. |
| Strike Softness (`softness`) | 0–1 | 0.65 | Three things at once. The amplitude peak arrives at `0.008 + softness * 0.015` seconds. Partials above the third (`i > 2`) are scaled by `1 - softness * 0.55`. The mallet click level is `0.09 * (1 - softness)`, so a soft strike has a quieter, rounder attack. |

Fixed values, not on the panel:

- Master gain `0.58`
- Low-pass on the oscillators at `8500` Hz
- Delay time `0.19` seconds, feedback `0.18`, wet `0.13`
- Notes `C4 D4 E4 G4 A4 C5 D5 E5` at `261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25` Hz

Play C Chord strikes C4, E4, G4, C5, 110 ms apart. Gentle Melody uses note indices `0, 2, 4, 3, 2, 0, 1, 2, 3, 5, 4, 3, 2, 0` at 380 ms intervals. A struck tongue brightens for 160 ms. Stop silences the ringing voices and clears the delay.

## Reuse in Wishing Lights

The main app reserves `soundId` and does not play this yet. When an ornament needs a metallic voice, the reusable piece is `strike(frequency, startTime)` together with the mode list, the noise burst, and the delay graph.

A later ornament can pass a frequency derived from the stored sound and leave the tongue UI here. Copy this folder before changing ratios, envelopes, or the delay. This directory is the reference those variations should be heard against.
