import { useEffect, useMemo } from 'react';

import { useCameraStore } from '../store/camera';
import { useSessionStore } from '../store/session';
import { usePresetsStore } from '../store/presets';
import { AppShell } from './layout/AppShell';
import { CameraPreview } from './components/CameraPreview';
import { DeviceSelector } from './components/DeviceSelector';
import { PresetSelector } from './components/PresetSelector';
import { RecordingControls } from './components/RecordingControls';
import { VerticalPreview } from './components/VerticalPreview';
import { FRAMING_PRESETS } from '../types';

export function App() {
  const camera = useCameraStore();
  const selectedPreset = usePresetsStore((state) => state.selectedPreset);
  const appVersion = useSessionStore((state) => state.appVersion);
  const setAppVersion = useSessionStore((state) => state.setAppVersion);
  const setStatus = useSessionStore((state) => state.setStatus);
  const setMessage = useSessionStore((state) => state.setMessage);

  const preset = useMemo(
    () =>
      FRAMING_PRESETS.find((item) => item.id === selectedPreset) ?? FRAMING_PRESETS[0],
    [selectedPreset],
  );

  useEffect(() => {
    let active = true;

    void window.opticOperator.app
      .getVersion()
      .then((version) => {
        if (active) {
          setAppVersion(version);
          setStatus('ready');
        }
      })
      .catch(() => {
        if (active) {
          setMessage(
            'The desktop bridge is unavailable. Restart the app to reconnect.',
          );
          setStatus('error');
        }
      });

    return () => {
      active = false;
    };
  }, [setAppVersion, setMessage, setStatus]);

  return (
    <AppShell
      status={
        <span className="app-version">
          {appVersion ? `v${appVersion}` : 'Initializing'}
          <span className="topbar-dot" />
          Local session
        </span>
      }
    >
      <section className="hero-row">
        <div>
          <p className="eyebrow">PHASE 1 / DESKTOP FOUNDATION</p>
          <h2 className="hero-title">A quieter, smarter way to stay in frame.</h2>
          <p className="hero-copy">
            Connect the S9 when you are ready. Optic Operator will turn a wide camera
            feed into a smooth vertical composition for short-form content.
          </p>
        </div>
        <div className="hero-note">
          <span className="hero-note-label">NEXT HARDWARE CHECK</span>
          <strong>S9 → HDMI capture → Mac</strong>
          <span>Target input: 3840 × 2160 / 30 fps</span>
        </div>
      </section>

      <section className="preview-grid">
        <CameraPreview
          deviceLabel={camera.selectedDeviceLabel}
          status={camera.status}
        />
        <VerticalPreview preset={preset} />
      </section>

      <section className="control-grid">
        <DeviceSelector />
        <PresetSelector />
        <RecordingControls />
      </section>

      <footer className="footer-note">
        <span className="footer-mark">OO</span>
        <span>Local-first creator tooling · Built for the LUMIX S9</span>
        <span>Phase 1 foundation</span>
      </footer>
    </AppShell>
  );
}
