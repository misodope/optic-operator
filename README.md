# Optic Operator

Optic Operator is a macOS desktop app that turns a camera feed into a smooth,
AI-assisted vertical camera for short-form video.

It keeps a creator naturally framed while they move, converts a wide camera source
into a 9:16 composition, and records the processed result as an MP4 video.

## What it does

- Accepts any camera source exposed to macOS.
- Supports direct camera connections, HDMI capture cards, USB cameras, and OBS Virtual Camera.
- Tracks a primary subject's face and body in real time.
- Reframes horizontal footage into a vertical 9:16 composition.
- Includes Talking Head, Walk & Talk, and Locked framing presets.
- Supports pinch-to-zoom gestures.
- Records a 1080 × 1920 H.264 MP4 output.
- Shows the negotiated input resolution and frame rate before recording.

## Quick start

### Requirements

- macOS
- Node.js
- pnpm
- A camera source available in macOS, or OBS Virtual Camera

### Run the app

```bash
git clone https://github.com/misodope/optic-operator.git
cd optic-operator
pnpm install
pnpm start
```

On first launch, allow camera and microphone access when macOS requests it. Select
your camera input in the app and wait for the live source and vertical preview to
appear.

## Basic workflow

1. Connect a camera directly, through an HDMI capture card, or through OBS Virtual Camera.
2. Select the camera input in Optic Operator.
3. Choose a framing preset.
4. Position yourself in the source preview and allow tracking to initialize.
5. Raise a hand and spread or pinch your thumb and index finger to control zoom.
6. Start recording when the vertical framing looks right.

The app keeps the raw camera source separate from the vertical composition so you can
see the actual input quality and negotiated video mode.

## Camera input

Optic Operator works with any video device that macOS makes available through its
camera input system. The available resolution and frame rate depend on the camera,
capture hardware, OBS settings, drivers, and macOS negotiation.

For the best reframing quality, use the highest practical source resolution and leave
some space around the subject. A wider source gives the virtual camera more room to
pan while creating the vertical crop.

## Development commands

```bash
pnpm start          # Run the desktop app
pnpm typecheck      # Run TypeScript checks
pnpm lint           # Run ESLint
pnpm format:check   # Check formatting
pnpm test           # Run automated tests
pnpm package       # Build a packaged desktop app
```

## Project status

Optic Operator is an actively developed MVP focused on AI-assisted vertical framing
and creator-focused recording. System-wide virtual camera output and more advanced
post-recording controls are planned for later releases.
