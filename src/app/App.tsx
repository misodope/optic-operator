import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
import {
  DEFAULT_MODEL_ASSETS,
  MediaPipeTracker,
} from '../lib/services/tracking/mediapipe';
import {
  createCanvasRecorder,
  selectRecordingMimeType,
  type CanvasRecorder,
} from '../lib/services/recording/recorder';
import { useCameraStore } from '../store/camera';
import { usePresetsStore } from '../store/presets';
import { useRecordingStore } from '../store/recording';
import { useSessionStore } from '../store/session';
import type { PermissionKind } from '../types/camera';
import {
  DEFAULT_TRACKING_FEATURES,
  type TrackingDiagnostics,
  type TrackingFeatures,
} from '../types/tracking';
import { FRAMING_PRESETS } from '../types';
import { AppShell } from './layout/AppShell';
import { CameraPreview } from './components/CameraPreview';
import { DeviceSelector } from './components/DeviceSelector';
import { PresetSelector } from './components/PresetSelector';
import { RecordingControls } from './components/RecordingControls';
import { HorizontalPreview } from './components/HorizontalPreview';
import { VerticalPreview } from './components/VerticalPreview';

const getMediaDevices = (): MediaDevices | null =>
  globalThis.navigator?.mediaDevices ?? null;

const createResetTracking = (): TrackingDiagnostics => ({
  status: 'disabled',
  confidence: 0,
  subject: null,
  lastResultTimestampMs: null,
  inferenceFps: 0,
  staleResultsDropped: 0,
  faceLandmarkCount: 0,
  poseLandmarkCount: 0,
  handLandmarks: null,
  gesture: {
    command: 'none',
    zoomIntent: 0,
    confidence: 0,
    pinchDistance: null,
    label: null,
  },
  error: null,
});

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
  const setStatus = useSessionStore((state) => state.setStatus);
  const setMessage = useSessionStore((state) => state.setMessage);
  const tracking = useSessionStore((state) => state.tracking);
  const setRecording = useRecordingStore((state) => state.setRecording);
  const setTracking = useSessionStore((state) => state.setTracking);
  const [focusView, setFocusView] = useState<'vertical' | 'horizontal' | null>(null);
  const [trackingFeatures, setTrackingFeatures] = useState<TrackingFeatures>(
    DEFAULT_TRACKING_FEATURES,
  );
  const [framingScale, setFramingScale] = useState(1);
  const videoRef = useRef<HTMLVideoElement>(null);
  const outputCanvasRef = useRef<HTMLCanvasElement>(null);
  const horizontalCanvasRef = useRef<HTMLCanvasElement>(null);
  const activeStreamRef = useRef<MediaStream | null>(null);
  const removeStreamListenerRef = useRef<(() => void) | null>(null);
  const trackerRef = useRef<MediaPipeTracker | null>(null);
  const recorderRef = useRef<CanvasRecorder | null>(null);
  const captureIdRef = useRef<string | null>(null);
  const recordingStartedAtRef = useRef<number | null>(null);
  const recordingTimerRef = useRef<number | null>(null);

  const preset = useMemo(
    () =>
      FRAMING_PRESETS.find((item) => item.id === selectedPreset) ?? FRAMING_PRESETS[0],
    [selectedPreset],
  );

  const toggleTrackingFeature = useCallback((feature: keyof TrackingFeatures): void => {
    setTrackingFeatures((current) => ({
      ...current,
      [feature]: !current[feature],
    }));
  }, []);

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

  const clearRecordingTimer = useCallback((): void => {
    if (recordingTimerRef.current !== null) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  }, []);

  const handleStartRecording = useCallback(async (): Promise<void> => {
    const canvas = outputCanvasRef.current;
    if (
      camera.status !== 'ready' ||
      !camera.streamInfo ||
      !canvas ||
      recorderRef.current ||
      captureIdRef.current
    ) {
      return;
    }

    setRecording({ status: 'preparing', elapsedMs: 0, outputPath: null, error: null });

    let captureId: string | null = null;
    try {
      const mimeType = selectRecordingMimeType();
      const capture = await window.opticOperator.recording.startCapture(mimeType);
      captureId = capture.captureId;
      captureIdRef.current = capture.captureId;

      const recorder = createCanvasRecorder({
        canvas,
        mimeType,
        audioTracks: activeStreamRef.current?.getAudioTracks(),
        onChunk: async (chunk) => {
          const data = new Uint8Array(await chunk.arrayBuffer());
          await window.opticOperator.recording.appendCaptureChunk(
            capture.captureId,
            data,
          );
        },
      });
      recorder.start();
      recorderRef.current = recorder;
      recordingStartedAtRef.current = performance.now();
      recordingTimerRef.current = window.setInterval(() => {
        const startedAt = recordingStartedAtRef.current;
        if (startedAt !== null) {
          setRecording({ elapsedMs: performance.now() - startedAt });
        }
      }, 100);
      setRecording({ status: 'recording' });
    } catch (error: unknown) {
      clearRecordingTimer();
      recordingStartedAtRef.current = null;
      recorderRef.current = null;
      captureIdRef.current = null;
      if (captureId) {
        await window.opticOperator.recording
          .cancelCapture(captureId)
          .catch(() => undefined);
      }
      setRecording({
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, [camera.status, camera.streamInfo, clearRecordingTimer, setRecording]);

  const handleStopRecording = useCallback(async (): Promise<void> => {
    const recorder = recorderRef.current;
    const captureId = captureIdRef.current;
    if (!recorder || !captureId) {
      return;
    }

    setRecording({ status: 'stopping' });
    clearRecordingTimer();
    recordingStartedAtRef.current = null;

    try {
      await recorder.stop();
      const outputPath = await window.opticOperator.recording.finishCapture(captureId);
      setRecording({ status: 'complete', outputPath, error: null });
    } catch (error: unknown) {
      await window.opticOperator.recording
        .cancelCapture(captureId)
        .catch(() => undefined);
      setRecording({
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      recorderRef.current = null;
      captureIdRef.current = null;
    }
  }, [clearRecordingTimer, setRecording]);

  const handleCancelRecording = useCallback(async (): Promise<void> => {
    const recorder = recorderRef.current;
    const captureId = captureIdRef.current;
    if (!recorder && !captureId) {
      return;
    }

    setRecording({ status: 'stopping' });
    clearRecordingTimer();
    recordingStartedAtRef.current = null;

    try {
      await recorder?.cancel();
      if (captureId) {
        await window.opticOperator.recording.cancelCapture(captureId);
      }
      setRecording({ status: 'idle', elapsedMs: 0, outputPath: null, error: null });
    } catch (error: unknown) {
      setRecording({
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      recorderRef.current = null;
      captureIdRef.current = null;
    }
  }, [clearRecordingTimer, setRecording]);

  const handleRevealRecording = useCallback(
    (outputPath: string): void => {
      void window.opticOperator.files
        .revealInFinder(outputPath)
        .catch((error: unknown) => {
          setRecording({
            error: error instanceof Error ? error.message : String(error),
          });
        });
    },
    [setRecording],
  );

  useEffect(() => {
    const video = videoRef.current;
    const streamInfo = camera.streamInfo;

    trackerRef.current?.dispose();
    trackerRef.current = null;

    if (camera.status !== 'ready' || !streamInfo || !video) {
      setTracking(createResetTracking());
      return undefined;
    }

    if (
      !trackingFeatures.face &&
      !trackingFeatures.body &&
      !trackingFeatures.gestures
    ) {
      setTracking(createResetTracking());
      return undefined;
    }

    let active = true;
    let trackingInterval: number | null = null;
    const setTrackingError = (message: string): void => {
      if (!active) {
        return;
      }
      const current = useSessionStore.getState().tracking;
      setTracking({ ...current, status: 'error', error: message });
    };

    setTracking({
      status: 'initializing',
      confidence: 0,
      subject: null,
      lastResultTimestampMs: null,
      inferenceFps: 0,
      staleResultsDropped: 0,
      faceLandmarkCount: 0,
      poseLandmarkCount: 0,
      handLandmarks: null,
      gesture: {
        command: 'none',
        zoomIntent: 0,
        confidence: 0,
        pinchDistance: null,
        label: null,
      },
      error: null,
    });

    let tracker: MediaPipeTracker;
    try {
      tracker = new MediaPipeTracker({
        modelAssets: DEFAULT_MODEL_ASSETS,
        features: trackingFeatures,
        onResult: ({ diagnostics }) => {
          if (active) {
            setTracking(diagnostics);
          }
        },
        onError: (error) => setTrackingError(error.message),
      });
    } catch (error) {
      setTrackingError(error instanceof Error ? error.message : String(error));
      return undefined;
    }

    trackerRef.current = tracker;
    void tracker
      .initialize()
      .then(() => {
        if (!active) {
          return;
        }
        trackingInterval = window.setInterval(() => {
          if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            tracker.submitVideoFrame(video, performance.now());
          }
        }, 1000 / 12);
      })
      .catch((error: unknown) => {
        setTrackingError(error instanceof Error ? error.message : String(error));
      });

    return () => {
      active = false;
      if (trackingInterval !== null) {
        window.clearInterval(trackingInterval);
      }
      tracker.dispose();
      if (trackerRef.current === tracker) {
        trackerRef.current = null;
      }
    };
  }, [camera.status, camera.streamInfo, setTracking, trackingFeatures]);

  useEffect(() => {
    let active = true;
    const mediaDevices = getMediaDevices();

    void window.opticOperator.app
      .getVersion()
      .then(() => {
        if (active) {
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
  }, [refreshDevices, setMessage, setStatus, stopActiveStream]);

  return (
    <AppShell>
      <section
        className={`workspace-grid ${focusView ? 'workspace-grid-focus' : ''} ${focusView ? `workspace-grid-focus-${focusView}` : ''}`}
      >
        <div className="workspace-main" aria-hidden={Boolean(focusView)}>
          <CameraPreview
            deviceLabel={camera.selectedDeviceLabel}
            status={camera.status}
            streamInfo={camera.streamInfo}
            error={camera.error}
            videoRef={videoRef}
            onReconnect={handleReconnect}
            trackingStatus={tracking.status}
            trackingConfidence={tracking.confidence}
            trackingError={tracking.error}
            faceLandmarkCount={tracking.faceLandmarkCount}
            poseLandmarkCount={tracking.poseLandmarkCount}
            handLandmarks={tracking.handLandmarks}
          />

          <section className="control-grid">
            <DeviceSelector
              onStartSetup={() => void startSetup()}
              onRefresh={() => void refreshDevices()}
              onCameraChange={handleCameraChange}
              onAudioChange={handleAudioChange}
              onReconnect={handleReconnect}
            />
            <PresetSelector
              trackingFeatures={trackingFeatures}
              onToggleTrackingFeature={toggleTrackingFeature}
              framingScale={framingScale}
              onFramingScaleChange={setFramingScale}
            />
            <RecordingControls
              canStart={camera.status === 'ready' && camera.streamInfo !== null}
              onStart={handleStartRecording}
              onStop={handleStopRecording}
              onCancel={handleCancelRecording}
              onReveal={handleRevealRecording}
            />
          </section>
        </div>

        <VerticalPreview
          preset={preset}
          sourceStatus={camera.status}
          streamInfo={camera.streamInfo}
          videoRef={videoRef}
          canvasRef={outputCanvasRef}
          subject={tracking.subject}
          handLandmarks={tracking.handLandmarks}
          gesture={tracking.gesture}
          framingScale={framingScale}
          trackingStatus={tracking.status}
          trackingError={tracking.error}
        />

        <HorizontalPreview
          preset={preset}
          sourceStatus={camera.status}
          streamInfo={camera.streamInfo}
          videoRef={videoRef}
          canvasRef={horizontalCanvasRef}
          subject={tracking.subject}
          handLandmarks={tracking.handLandmarks}
          gesture={tracking.gesture}
          framingScale={framingScale}
          trackingStatus={tracking.status}
          trackingError={tracking.error}
        />
      </section>

      {focusView ? (
        <div className="focus-navigation">
          <button
            className="focus-exit-button secondary-button"
            type="button"
            onClick={() => setFocusView(null)}
          >
            Back to setup
          </button>
          <button
            className="focus-switch-button secondary-button"
            type="button"
            onClick={() =>
              setFocusView(focusView === 'vertical' ? 'horizontal' : 'vertical')
            }
          >
            Open {focusView === 'vertical' ? 'horizontal' : 'vertical'} view
          </button>
        </div>
      ) : (
        <footer className="footer-note">
          <span className="footer-mark">OO</span>
          <span>Local-first creator tooling · Built for any camera input</span>
          <div className="footer-focus-actions">
            <button
              className="footer-focus-button text-button"
              type="button"
              onClick={() => setFocusView('vertical')}
            >
              Open vertical view
            </button>
            <button
              className="footer-focus-button text-button"
              type="button"
              onClick={() => setFocusView('horizontal')}
            >
              Open horizontal view
            </button>
          </div>
        </footer>
      )}
    </AppShell>
  );
}
