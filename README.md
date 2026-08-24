# Optic Operator

Optic Operator is an Electron + TypeScript desktop app for turning a fixed Panasonic LUMIX S9 into a smooth AI-assisted vertical camera operator.

## Phase 3 status

Phase 3 adds the live 9:16 canvas renderer, quality reporting, preset-aware camera-controller behavior, dead-zone smoothing, crop-boundary clamping, recentering, and deterministic controller/rendering tests. The current vertical preview uses a centered fixture until MediaPipe tracking is connected in Phase 4.

## Development

```bash
pnpm install
pnpm start
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm package
```

## Planned hardware path

```text
LUMIX S9 micro-HDMI
        ↓
HDMI capture card
        ↓
Mac / Optic Operator
        ↓
MediaPipe tracking + smooth 9:16 crop
        ↓
1080×1920 vertical recording
```

Panasonic lists the DC-S9 as compatible with clean HDMI and capture cards. USB webcam mode is a fallback for setup and diagnostics; the actual negotiated resolution must be measured before using it for content production.

See [docs/hardware-validation.md](docs/hardware-validation.md) for the S9 setup checklist and the results log for the capture card, negotiated input mode, audio path, and 10-minute stability run.

## MVP direction

- macOS-first Electron desktop app.
- Single-person face and pose tracking.
- Smooth 9:16 framing with Talking Head, Walk & Talk, and Locked presets.
- Saved 1080×1920/30 fps vertical output.
- Tracking metadata saved with each session.
- Gesture-triggered push-in and system-wide virtual-camera output are later phases.
