# Optic Operator

Optic Operator is an Electron + TypeScript desktop app for turning a fixed Panasonic LUMIX S9 into a smooth AI-assisted vertical camera operator.

## Phase 1 status

Phase 1 establishes the secure desktop shell, React UI, typed stores, and preload boundary. Camera input and MediaPipe tracking are intentionally not connected yet.

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

## MVP direction

- macOS-first Electron desktop app.
- Single-person face and pose tracking.
- Smooth 9:16 framing with Talking Head, Walk & Talk, and Locked presets.
- Saved 1080×1920/30 fps vertical output.
- Tracking metadata saved with each session.
- Gesture-triggered push-in and system-wide virtual-camera output are later phases.
