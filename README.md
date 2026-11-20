# Wishing Lights

A small mobile-first prototype: pick a photograph, extract five colors, hang a simple ornament on a Christmas tree, and write a memory for it.

Everything stays in React state in the browser. Refreshing the page clears the tree.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173

To typecheck and build:

```bash
npm run build
```

## Try it on a phone

The computer and the phone need to be on the same Wi-Fi network.

```bash
npm run dev -- --host
```

Vite prints a Network URL, usually `http://<your-computer-ip>:5173`. Open that address in the phone's browser.

On macOS you can find the computer's address with:

```bash
ipconfig getifaddr en0
```

If the phone cannot connect, allow incoming connections for Node when the system firewall asks. Photos are read from the phone's photo library through the native picker and are not uploaded.

JPEG, PNG, HEIC, and HEIF photos can be selected. The browser decodes a photo when it can, including the phone's orientation. When it cannot decode HEIC or HEIF, the app converts that photo to JPEG on the device. Photos are not uploaded. If a photo still cannot be read, the app shows an error.

## How the prototype is put together

- `PhotoUploader` opens the photo picker, checks the file, previews it, and shows the five extracted colors.
- `colorExtraction.ts` samples the photo with the Canvas API. Replace `extractColors` later with a color-harmony algorithm; the UI only needs `#rrggbb` strings.
- `Ornament` draws a flat circular SVG from those colors. `shape` and `material` on the data model are the hooks for later ornament experiments.
- `ChristmasTree` draws the tree and stores each tap as a fraction of the tree box, so ornaments stay in place when the screen size changes.
- `MemoryViewer` shows the original photograph and edits the short message stored on that ornament.
- `App` holds the ornament list. There is no account, API, or database.

`soundId` is reserved and unused. Tone.js is not installed yet.

## Where later experiments go

`experiments/` is empty on purpose. Use it for standalone trials of ornament materials, lighting, sound, and animation before folding a result back into the app:

- Materials and shapes belong in `Ornament`, driven by `shape` and `material`.
- Lighting can wrap `ChristmasTree` without changing the stored positions.
- Sound can later read `soundId` and play through Tone.js.
