# Orbita variable rotation

A standalone sketch for hearing how a fixed circle of notes changes rhythm when the disc speeds up and slows down. It is not part of the Wishing Lights app.

The disc carries six notes and turns clockwise. A sensor at the top plays a note when a marker crosses it. Constant mode keeps one speed. Variable mode repeats `2 → 1 → 3 → 1`, and each step lasts a quarter-turn.

## Run

From this folder:

```bash
python3 -m http.server 5174
```

Open http://localhost:5174 and press Play.

The page loads p5.js and Tone.js from a CDN, so the first run needs a network connection. Browsers only start audio after the click.

## Listen

Leave the notes where they are and switch between Constant and Variable. The order stays the same. The gaps change: they tighten at 2× and 3×, and open up at 1×.

The pattern follows how far the disc has turned. Switching modes does not rewind it. Reset does.

Clockwise from the top the markers are C4, E4, G4, B4, D5, A4. They arrive at the sensor as A4, D5, B4, G4, E4, C4.

## Files

- `js/sequencer.js` — rotation, the speed pattern, and crossing detection
- `js/audio.js` — polyphonic sine tone with a few soft harmonics and a short reverb
- `js/sketch.js` — the disc, sensor, and ripples
- `js/main.js` — the controls
