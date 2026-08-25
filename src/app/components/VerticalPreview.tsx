import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

import { CameraController } from '../../lib/camera-controller';
import {
  renderVerticalCrop,
  VERTICAL_OUTPUT,
} from '../../lib/services/rendering/verticalCropRenderer';
import type { CameraStatus, CameraStreamInfo } from '../../types/camera';
import type { CameraControllerState } from '../../lib/camera-controller/types';
import type { FramingPreset } from '../../types';
import type {
  GestureState,
  LandmarkPoint,
  RuntimeTrackingStatus,
  SubjectState,
} from '../../types/tracking';
import { TrackingOverlay } from './TrackingOverlay';

interface VerticalPreviewProps {
  preset: FramingPreset;
  sourceStatus: CameraStatus;
  streamInfo: CameraStreamInfo | null;
  videoRef: RefObject<HTMLVideoElement | null>;
  canvasRef?: RefObject<HTMLCanvasElement | null>;
  subject?: SubjectState | null;
  handLandmarks?: LandmarkPoint[] | null;
  gesture?: GestureState;
  trackingStatus?: RuntimeTrackingStatus;
  trackingError?: string | null;
}

const QUALITY_LABELS: Record<CameraControllerState['qualityState'], string> = {
  good: 'Good source quality',
  caution: 'Quality caution',
  'below-target': 'Below 1080 × 1920 target',
};

const TRACKING_LABELS: Record<RuntimeTrackingStatus, string> = {
  disabled: 'Tracking disabled',
  initializing: 'Initializing MediaPipe',
  tracking: 'Subject tracking',
  'low-confidence': 'Tracking confidence low',
  lost: 'Holding last subject position',
  error: 'Tracking unavailable',
};

export function VerticalPreview({
  preset,
  sourceStatus,
  streamInfo,
  videoRef,
  canvasRef: outputCanvasRef,
  subject = null,
  handLandmarks = null,
  gesture = {
    command: 'none',
    zoomIntent: 0,
    confidence: 0,
    pinchDistance: null,
    label: null,
  },
  trackingStatus = 'disabled',
  trackingError = null,
}: VerticalPreviewProps) {
  const internalCanvasRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = outputCanvasRef ?? internalCanvasRef;
  const controllerRef = useRef<CameraController | null>(null);
  const subjectRef = useRef<SubjectState | null>(subject);
  const gestureRef = useRef<GestureState>(gesture);
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
          output: VERTICAL_OUTPUT,
          preset: preset.config,
          nowMs,
          gestureZoom: gestureRef.current.zoomIntent,
        });

        renderVerticalCrop({
          canvas,
          source: video,
          sourceDimensions: { width: streamInfo.width, height: streamInfo.height },
          controllerState: nextState,
          output: VERTICAL_OUTPUT,
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
  }, [preset, sourceStatus, streamInfo, videoRef]);

  const recenter = useCallback((): void => {
    controllerRef.current?.reset();
    setControllerState(null);
  }, []);

  const hasSource = sourceStatus === 'ready' && streamInfo !== null;

  return (
    <section
      className="preview-card preview-card-vertical"
      aria-label="Vertical preview"
    >
      <div className="preview-card-header">
        <div>
          <p className="eyebrow">OUTPUT</p>
          <h2>Vertical frame</h2>
        </div>
        <span className="format-badge">9:16</span>
      </div>
      <div className="vertical-preview-wrap">
        <div className="vertical-preview">
          <canvas
            ref={canvasRef}
            className={`vertical-preview-canvas ${hasSource ? 'vertical-preview-canvas-visible' : ''}`}
            width={VERTICAL_OUTPUT.width}
            height={VERTICAL_OUTPUT.height}
            aria-label="Live 9:16 camera composition"
          />
          <div className="vertical-preview-lines" />
          <TrackingOverlay
            subject={subject}
            handLandmarks={handLandmarks}
            controllerState={controllerState}
            trackingStatus={trackingStatus}
          />
          {!hasSource && (
            <div className="vertical-preview-message">
              <span className="preview-icon">✦</span>
              <strong>Waiting for a source</strong>
              <span>{preset.label} preset selected</span>
            </div>
          )}
        </div>
      </div>
      {controllerState && (
        <div className="vertical-preview-status">
          <span>{QUALITY_LABELS[controllerState.qualityState]}</span>
          <span>{TRACKING_LABELS[trackingStatus]}</span>
          <span className={gesture.command !== 'none' ? 'gesture-status-active' : ''}>
            {gesture.command === 'none'
              ? 'Raise hand, then pinch or spread'
              : gesture.label}
          </span>
          <span>{controllerState.qualityScale.toFixed(2)}× source scale</span>
        </div>
      )}
      {trackingError && (
        <p className="error-message" role="alert">
          Tracking error: {trackingError}
        </p>
      )}
      <div className="vertical-preview-controls">
        <p className="preview-caption">
          Target export: 1080 × 1920 at 30 fps.
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
