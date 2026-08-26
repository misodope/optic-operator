import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

import { CameraController } from '../../lib/camera-controller';
import type { CameraControllerState } from '../../lib/camera-controller/types';
import {
  HORIZONTAL_OUTPUT,
  renderHorizontalCrop,
} from '../../lib/services/rendering/horizontalCropRenderer';
import type { CameraStatus, CameraStreamInfo } from '../../types/camera';
import type { FramingPreset } from '../../types';
import type {
  GestureState,
  LandmarkPoint,
  RuntimeTrackingStatus,
  SubjectState,
} from '../../types/tracking';
import { TrackingOverlay } from './TrackingOverlay';

interface HorizontalPreviewProps {
  preset: FramingPreset;
  sourceStatus: CameraStatus;
  streamInfo: CameraStreamInfo | null;
  videoRef: RefObject<HTMLVideoElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  subject?: SubjectState | null;
  handLandmarks?: LandmarkPoint[] | null;
  gesture?: GestureState;
  framingScale?: number;
  trackingStatus?: RuntimeTrackingStatus;
  trackingError?: string | null;
}

const QUALITY_LABELS: Record<CameraControllerState['qualityState'], string> = {
  good: 'Good source quality',
  caution: 'Quality caution',
  'below-target': 'Below 1920 × 1080 target',
};

const TRACKING_LABELS: Record<RuntimeTrackingStatus, string> = {
  disabled: 'Tracking disabled',
  initializing: 'Initializing MediaPipe',
  tracking: 'Subject tracking',
  'low-confidence': 'Tracking confidence low',
  lost: 'Holding last subject position',
  error: 'Tracking unavailable',
};

export function HorizontalPreview({
  preset,
  sourceStatus,
  streamInfo,
  videoRef,
  canvasRef,
  subject = null,
  handLandmarks = null,
  gesture = {
    command: 'none',
    zoomIntent: 0,
    confidence: 0,
    pinchDistance: null,
    label: null,
  },
  framingScale = 1,
  trackingStatus = 'disabled',
  trackingError = null,
}: HorizontalPreviewProps) {
  const controllerRef = useRef<CameraController | null>(null);
  const subjectRef = useRef<SubjectState | null>(subject);
  const gestureRef = useRef<GestureState>(gesture);
  const framingScaleRef = useRef(framingScale);
  const [controllerState, setControllerState] = useState<CameraControllerState | null>(
    null,
  );

  useEffect(() => {
    subjectRef.current = subject;
  }, [subject]);

  useEffect(() => {
    gestureRef.current = gesture;
  }, [gesture]);

  useEffect(() => {
    framingScaleRef.current = framingScale;
  }, [framingScale]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;

    if (!canvas || !video || sourceStatus !== 'ready' || !streamInfo) {
      controllerRef.current = null;
      setControllerState(null);
      return undefined;
    }

    const controller = new CameraController();
    controllerRef.current = controller;
    let animationFrame = 0;
    let lastPublishedAt = -Infinity;

    const render = (nowMs: number): void => {
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        const nextState = controller.update({
          subject: subjectRef.current,
          source: { width: streamInfo.width, height: streamInfo.height },
          output: HORIZONTAL_OUTPUT,
          preset: preset.config,
          nowMs,
          gestureZoom: gestureRef.current.zoomIntent,
          framingScale: framingScaleRef.current,
        });

        renderHorizontalCrop({
          canvas,
          source: video,
          sourceDimensions: { width: streamInfo.width, height: streamInfo.height },
          controllerState: nextState,
          output: HORIZONTAL_OUTPUT,
        });

        if (nowMs - lastPublishedAt >= 100) {
          lastPublishedAt = nowMs;
          setControllerState(nextState);
        }
      }

      animationFrame = requestAnimationFrame(render);
    };

    animationFrame = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrame);
      controllerRef.current = null;
    };
  }, [canvasRef, preset, sourceStatus, streamInfo, videoRef]);

  const recenter = useCallback((): void => {
    controllerRef.current?.reset();
    setControllerState(null);
  }, []);

  const hasSource = sourceStatus === 'ready' && streamInfo !== null;

  return (
    <section
      className="preview-card preview-card-horizontal"
      aria-label="Horizontal output preview"
    >
      <div className="preview-card-header">
        <div>
          <p className="eyebrow">OUTPUT</p>
          <h2>Horizontal frame</h2>
        </div>
        <span className="format-badge">16:9</span>
      </div>
      <div className="horizontal-preview-wrap">
        <div className="horizontal-preview">
          <canvas
            ref={canvasRef}
            className={`horizontal-preview-canvas ${hasSource ? 'horizontal-preview-canvas-visible' : ''}`}
            width={HORIZONTAL_OUTPUT.width}
            height={HORIZONTAL_OUTPUT.height}
            aria-label="Live 16:9 camera composition"
          />
          <div className="horizontal-preview-lines" />
          <TrackingOverlay
            subject={subject}
            handLandmarks={handLandmarks}
            controllerState={controllerState}
            trackingStatus={trackingStatus}
          />
          {!hasSource && (
            <div className="horizontal-preview-message">
              <span className="preview-icon">✦</span>
              <strong>Waiting for a source</strong>
              <span>{preset.label} preset selected</span>
            </div>
          )}
          {controllerState && (
            <div className="horizontal-preview-status">
              <span>{QUALITY_LABELS[controllerState.qualityState]}</span>
              <span>{TRACKING_LABELS[trackingStatus]}</span>
              <span
                className={gesture.command !== 'none' ? 'gesture-status-active' : ''}
              >
                {gesture.command === 'none' ? 'Tracking overlay ready' : gesture.label}
              </span>
              <span>{controllerState.qualityScale.toFixed(2)}× source scale</span>
            </div>
          )}
        </div>
      </div>
      {trackingError && (
        <p className="error-message" role="alert">
          Tracking error: {trackingError}
        </p>
      )}
      <div className="horizontal-preview-controls">
        <p className="preview-caption">
          Live 16:9 monitoring frame.
          {streamInfo && ` Source: ${streamInfo.width} × ${streamInfo.height}.`}
        </p>
        <button
          className="text-button"
          type="button"
          onClick={recenter}
          disabled={!hasSource}
        >
          Recenter
        </button>
      </div>
    </section>
  );
}
