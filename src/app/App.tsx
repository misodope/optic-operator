import { useCallback, useEffect, useMemo, useRef } from 'react';

import {
  enumerateDevices,
  requestMediaPermissions,
  subscribeToDeviceChanges,
  toCameraServiceError,
} from '../lib/services/camera/devices';
import {
  attachStreamToVideo,
  monitorStream,
  openCameraStream,
  stopMediaStream,
} from '../lib/services/camera/stream';
import { useCameraStore } from '../store/camera';
import { usePresetsStore } from '../store/presets';
import { useSessionStore } from '../store/session';
import type { PermissionKind } from '../types/camera';
import { FRAMING_PRESETS } from '../types';
import { AppShell } from './layout/AppShell';
import { CameraPreview } from './components/CameraPreview';
import { DeviceSelector } from './components/DeviceSelector';
import { PresetSelector } from './components/PresetSelector';
import { RecordingControls } from './components/RecordingControls';
import { VerticalPreview } from './components/VerticalPreview';

const getMediaDevices = (): MediaDevices | null =>
  globalThis.navigator?.mediaDevices ?? null;

export function App() {
  const camera = useCameraStore();
  const setDevices = useCameraStore((state) => state.setDevices);
  const selectDevice = useCameraStore((state) => state.selectDevice);
  const selectAudioDevice = useCameraStore((state) => state.selectAudioDevice);
  const updateCameraPermissionState = useCameraStore(
    (state) => state.setPermissionState,
  );
  const setCameraStatus = useCameraStore((state) => state.setStatus);
  const setCameraStreamInfo = useCameraStore((state) => state.setStreamInfo);
  const setCameraError = useCameraStore((state) => state.setError);
  const selectedPreset = usePresetsStore((state) => state.selectedPreset);
  const appVersion = useSessionStore((state) => state.appVersion);
  const setAppVersion = useSessionStore((state) => state.setAppVersion);
  const setStatus = useSessionStore((state) => state.setStatus);
  const setMessage = useSessionStore((state) => state.setMessage);
  const videoRef = useRef<HTMLVideoElement>(null);
  const activeStreamRef = useRef<MediaStream | null>(null);
  const removeStreamListenerRef = useRef<(() => void) | null>(null);

  const preset = useMemo(
    () =>
      FRAMING_PRESETS.find((item) => item.id === selectedPreset) ?? FRAMING_PRESETS[0],
    [selectedPreset],
  );

  const stopActiveStream = useCallback((): void => {
    removeStreamListenerRef.current?.();
    removeStreamListenerRef.current = null;
    stopMediaStream(activeStreamRef.current);
    activeStreamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const setPermissionState = useCallback(
    async (kind: PermissionKind): Promise<void> => {
      const state = await window.opticOperator.devices.getPermissionState(kind);
      updateCameraPermissionState(kind, state);
    },
    [updateCameraPermissionState],
  );

  const refreshDevices = useCallback(async (): Promise<void> => {
    try {
      const devices = await enumerateDevices();
      setDevices(devices.video, devices.audio);

      const current = useCameraStore.getState();
      const selectedVideo = devices.video.find(
        (device) => device.deviceId === current.selectedDeviceId,
      );
      const selectedAudio = devices.audio.find(
        (device) => device.deviceId === current.selectedAudioDeviceId,
      );

      if (!selectedVideo && devices.video[0]) {
        selectDevice(devices.video[0].deviceId, devices.video[0].label);
      }
      if (
        selectedAudio &&
        !devices.audio.some((device) => device.deviceId === selectedAudio.deviceId)
      ) {
        selectAudioDevice(null, null);
      }

      await Promise.all([
        setPermissionState('camera'),
        setPermissionState('microphone'),
      ]);
    } catch (error) {
      setCameraError(toCameraServiceError(error));
    }
  }, [selectAudioDevice, selectDevice, setCameraError, setDevices, setPermissionState]);

  const connectCamera = useCallback(
    async (videoDeviceId: string, audioDeviceId: string | null): Promise<void> => {
      const mediaDevices = getMediaDevices();
      if (!mediaDevices) {
        setCameraError({
          code: 'CAPTURE_ERROR',
          message: 'This app could not access macOS camera devices.',
        });
        return;
      }

      stopActiveStream();
      setCameraStreamInfo(null);
      setCameraError(null);
      setCameraStatus('connecting');

      try {
        const stream = await openCameraStream({
          mediaDevices,
          videoDeviceId,
          audioDeviceId,
        });
        activeStreamRef.current = stream;

        if (!videoRef.current) {
          throw new Error('The camera preview is not mounted.');
        }

        const streamInfo = await attachStreamToVideo(videoRef.current, stream);
        setCameraStreamInfo(streamInfo);
        setCameraStatus('ready');
        removeStreamListenerRef.current = monitorStream(stream, (error) => {
          setCameraStreamInfo(null);
          setCameraError(error);
          setCameraStatus('disconnected');
        });
      } catch (error) {
        stopActiveStream();
        const normalized = toCameraServiceError(error);
        setCameraError(normalized);
        setCameraStatus(
          normalized.code === 'PERMISSION_DENIED' ? 'permission-required' : 'error',
        );
      }
    },
    [setCameraError, setCameraStatus, setCameraStreamInfo, stopActiveStream],
  );

  const startSetup = useCallback(async (): Promise<void> => {
    const mediaDevices = getMediaDevices();
    if (!mediaDevices) {
      setCameraError({
        code: 'CAPTURE_ERROR',
        message: 'Camera access is unavailable in this renderer.',
      });
      return;
    }

    setCameraError(null);
    setCameraStatus('connecting');

    try {
      await requestMediaPermissions(mediaDevices, { camera: true, microphone: false });
      await setPermissionState('camera');
    } catch (error) {
      setCameraError(toCameraServiceError(error));
      setCameraStatus('permission-required');
      await setPermissionState('camera').catch(() => undefined);
      return;
    }

    await refreshDevices();
    const selected = useCameraStore.getState().selectedDeviceId;
    if (selected) {
      await connectCamera(selected, useCameraStore.getState().selectedAudioDeviceId);
    } else {
      setCameraStatus('idle');
    }
  }, [
    connectCamera,
    refreshDevices,
    setCameraError,
    setCameraStatus,
    setPermissionState,
  ]);

  const handleCameraChange = useCallback(
    (deviceId: string): void => {
      const device = useCameraStore
        .getState()
        .videoDevices.find((candidate) => candidate.deviceId === deviceId);
      if (!device) {
        return;
      }

      selectDevice(device.deviceId, device.label);
      void connectCamera(
        device.deviceId,
        useCameraStore.getState().selectedAudioDeviceId,
      );
    },
    [connectCamera, selectDevice],
  );

  const handleAudioChange = useCallback(
    (deviceId: string): void => {
      const device = useCameraStore
        .getState()
        .audioDevices.find((candidate) => candidate.deviceId === deviceId);
      selectAudioDevice(deviceId, device?.label ?? 'No audio track');

      const selectedVideo = useCameraStore.getState().selectedDeviceId;
      if (selectedVideo) {
        void connectCamera(selectedVideo, deviceId || null);
      }
    },
    [connectCamera, selectAudioDevice],
  );

  const handleReconnect = useCallback((): void => {
    const current = useCameraStore.getState();
    if (current.selectedDeviceId) {
      void connectCamera(current.selectedDeviceId, current.selectedAudioDeviceId);
    } else {
      void startSetup();
    }
  }, [connectCamera, startSetup]);

  useEffect(() => {
    let active = true;
    const mediaDevices = getMediaDevices();

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

    void refreshDevices();
    const unsubscribe = mediaDevices
      ? subscribeToDeviceChanges(mediaDevices, () => void refreshDevices())
      : undefined;

    return () => {
      active = false;
      unsubscribe?.();
      stopActiveStream();
    };
  }, [refreshDevices, setAppVersion, setMessage, setStatus, stopActiveStream]);

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
          <p className="eyebrow">PHASE 2 / CAMERA INPUT</p>
          <h2 className="hero-title">A quieter, smarter way to stay in frame.</h2>
          <p className="hero-copy">
            Connect the S9 through a clean HDMI capture path and see the actual source
            mode negotiated by macOS before recording.
          </p>
        </div>
        <div className="hero-note">
          <span className="hero-note-label">SOURCE TARGET</span>
          <strong>S9 → HDMI capture → Mac</strong>
          <span>Requested input: 3840 × 2160 / 30 fps</span>
        </div>
      </section>

      <section className="preview-grid">
        <CameraPreview
          deviceLabel={camera.selectedDeviceLabel}
          status={camera.status}
          streamInfo={camera.streamInfo}
          error={camera.error}
          videoRef={videoRef}
          onReconnect={handleReconnect}
        />
        <VerticalPreview preset={preset} />
      </section>

      <section className="control-grid">
        <DeviceSelector
          onStartSetup={() => void startSetup()}
          onRefresh={() => void refreshDevices()}
          onCameraChange={handleCameraChange}
          onAudioChange={handleAudioChange}
          onReconnect={handleReconnect}
        />
        <PresetSelector />
        <RecordingControls />
      </section>

      <footer className="footer-note">
        <span className="footer-mark">OO</span>
        <span>Local-first creator tooling · Built for the LUMIX S9</span>
        <span>Phase 2 camera input</span>
      </footer>
    </AppShell>
  );
}
