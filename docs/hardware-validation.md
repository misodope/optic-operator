# LUMIX S9 hardware validation

This checklist records the real macOS input path before the app's crop-quality thresholds are finalized. Fill it out during a manual Phase 2 test and commit the results with the session notes.

## Test setup

| Field                           | Value                        |
| ------------------------------- | ---------------------------- |
| Test date                       | _not yet tested_             |
| Mac model / macOS version       | _not yet tested_             |
| Optic Operator version / commit | _not yet tested_             |
| LUMIX S9 firmware version       | _not yet tested_             |
| S9 system frequency             | _not yet tested_             |
| S9 recording mode               | _not yet tested_             |
| HDMI output setting             | Clean HDMI: _not yet tested_ |
| Micro-HDMI cable                | _not yet tested_             |
| Capture-card make/model         | _not yet tested_             |
| Capture-card connection         | _not yet tested_             |
| Audio source                    | _not yet tested_             |

## S9 setup checklist

- [ ] Confirm the S9 firmware version.
- [ ] Set the S9 system frequency and record the value above.
- [ ] Disable on-screen overlays for clean HDMI output.
- [ ] Connect the S9 micro-HDMI port to the capture card with a known-good cable.
- [ ] Connect the capture card directly to the Mac or through the tested hub/dock.
- [ ] Turn on the S9 before pressing **Find cameras** in Optic Operator.
- [ ] Grant camera permission when macOS prompts.
- [ ] Select the S9 capture-card video input in the app.
- [ ] Select the capture-card audio input if macOS exposes one separately.

## Negotiated input result

Record the values shown under the raw source preview. These are the values the browser actually negotiated, not the requested 3840 × 2160 / 30 fps target.

| Field                       | Result           |
| --------------------------- | ---------------- |
| Displayed source label      | _not yet tested_ |
| Negotiated width × height   | _not yet tested_ |
| Negotiated frame rate       | _not yet tested_ |
| Displayed aspect ratio      | _not yet tested_ |
| Audio device label          | _not yet tested_ |
| USB fallback width × height | _not yet tested_ |

## Stability result

- [ ] Run the raw preview continuously for 10 minutes.
- [ ] Switch from the S9 capture card to another camera and confirm the old stream stops.
- [ ] Disconnect and reconnect the capture card; confirm the app shows a recoverable disconnected state.
- [ ] Confirm the preview does not freeze or silently lose its negotiated dimensions.
- [ ] Record any S9 overheating, sleep, HDMI dropout, capture-card disconnect, or audio drift behavior.

### Notes

_Add observations here after the manual run._
