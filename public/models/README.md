# Bundled MediaPipe assets

These assets are pinned for the Phase 4 local tracking pipeline. The renderer and
worker load them from the packaged application instead of fetching model files from a
runtime CDN.

## Models

- Face Landmarker: MediaPipe model version `1`
  - Source: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`
  - SHA-256: `64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff`
- Pose Landmarker Lite: MediaPipe model version `1`
  - Source: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`
  - SHA-256: `59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a`

The `wasm/` files are copied from the installed `@mediapipe/tasks-vision` package at
version `0.10.22` so the task runtime is available offline in the packaged app.
