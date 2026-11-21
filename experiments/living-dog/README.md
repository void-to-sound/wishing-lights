# Living dog

A quiet room, and a small white dog that mostly sleeps in it. The dog is not waiting for anyone. Leave the tab open.

This is a standalone experiment. It is not part of the Wishing Lights app.

## Run

From the project root:

```bash
npm install
npm run dev
```

Open http://localhost:5173/experiments/living-dog/

Sound stays off until you turn it on. Browsers only start audio after that click. The Behaviors button in the corner can force sleep, waking, looking, sniffing, or settling. Most clicks are ignored. That is the dog.

## What it does

A small state machine spends the long stretches asleep: a slow breath, a rare ear twitch, an occasional snore. When the sleep ends, the dog wakes, looks around, and often lies back down. Sometimes it gets up, walks a little way toward the fire, sniffs the rug, and comes back.

The poses are photographic frames made from the six reference photos, cut off a green screen, and crossfaded. They are not drawings of the dog, and they are not the original snapshots either. The face, floppy ears, short legs, and messy white coat are carried over from those photos as closely as the frames allow.

The room is a simple winter living room: rug, fireplace, window light. A soft fire flicker is laid over the dog so it sits in the same light as the rug.

The clips under `assets/audio/` are quiet generated Foley — breath, a snore, a sigh, sniffs, and muffled steps — played back as samples. They are not recordings of this dog.

## Files

- `src/behavior.ts` — states, weighted timing, and the pose sequence for each stretch
- `src/useDogLife.ts` — the clock, interruptions, and the times the dog declines to notice
- `src/Dog.tsx` — pose crossfades, breath, and the walk across the rug
- `src/audio.ts` — sample playback and the mute
- `assets/poses/` — keyed frames
- `assets/room.jpg` — the room
- `scripts/key_poses.py` — how a green-screen frame becomes a sprite
