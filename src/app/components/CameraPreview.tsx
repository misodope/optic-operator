import type { RefObject } from 'react';

import type { CameraError, CameraStatus, CameraStreamInfo } from '../../types/camera';
import { formatAspectRatio, isLowResolution } from '../../lib/utils/aspectRatio';
import type { LandmarkPoint, RuntimeTrackingStatus } from '../../types/tracking';

interface CameraPreviewProps {
  deviceLabel: string | null;
  status: CameraStatus;
  streamInfo: CameraStreamInfo | null;
  error: CameraError | null;
  videoRef: RefObject<HTMLVideoElement | null>;
  onReconnect: () => void;
  trackingStatus?: RuntimeTrackingStatus;
  trackingConfidence?: number;
  trackingError?: string | null;
  faceLandmarkCount?: number;
  poseLandmarkCount?: number;
  handLandmarks?: LandmarkPoint[] | null;
}

const formatFrameRate = (frameRate: number | null): string =>
  frameRate === null ? 'unknown fps' : `${frameRate.toFixed(1)} fps`;

export function CameraPreview({
  deviceLabel,
  status,
  streamInfo,
  error,
  videoRef,
  onReconnect,
  trackingStatus = 'disabled',
  trackingConfidence = 0,
  trackingError = null,
  faceLandmarkCount = 0,
  poseLandmarkCount = 0,
  handLandmarks = null,
}: CameraPreviewProps) {
  const hasSource = status === 'ready' && streamInfo !== null;
  const lowResolution = streamInfo
    ? isLowResolution(streamInfo.width, streamInfo.height)
    : false;
  const handBounds = handLandmarks?.length
    ? {
        minX: Math.min(...handLandmarks.map((landmark) => landmark.x)),
        maxX: Math.max(...handLandmarks.map((landmark) => landmark.x)),
        minY: Math.min(...handLandmarks.map((landmark) => landmark.y)),
        maxY: Math.max(...handLandmarks.map((landmark) => landmark.y)),
      }
    : null;
  const sourceHandCircle = handBounds
    ? {
        cx: ((handBounds.minX + handBounds.maxX) / 2) * (streamInfo?.width ?? 1),
        cy: ((handBounds.minY + handBounds.maxY) / 2) * (streamInfo?.height ?? 1),
        rx: Math.max(
          24,
          (handBounds.maxX - handBounds.minX) * (streamInfo?.width ?? 1) * 0.7,
        ),
        ry: Math.max(
          24,
          (handBounds.maxY - handBounds.minY) * (streamInfo?.height ?? 1) * 0.7,
        ),
      }
    : null;

  return (
    <section className="preview-card preview-card-source" aria-label="Camera preview">
      <div className="preview-card-header">
        <div>
          <p className="eyebrow">SOURCE</p>
          <h2>Camera feed</h2>
        </div>
        <span className={`status-pill status-${status}`}>
          {status.replace('-', ' ')}
        </span>
      </div>
      <div className="source-preview">
        <video
          ref={videoRef}
          className={`source-video ${hasSource ? 'source-video-visible' : ''}`}
          autoPlay
          muted
          playsInline
          aria-label="Raw camera source"
        />
        {hasSource && streamInfo && sourceHandCircle && (
          <svg
            className="source-hand-overlay"
            viewBox={`0 0 ${streamInfo.width} ${streamInfo.height}`}
            preserveAspectRatio="xMidYMid meet"
            aria-label="Detected hand"
          >
            <ellipse
              className="tracking-hand-circle"
              cx={sourceHandCircle.cx}
              cy={sourceHandCircle.cy}
              rx={sourceHandCircle.rx}
              ry={sourceHandCircle.ry}
            />
          </svg>
        )}
        {!hasSource && (
          <div className="source-placeholder">
            <div className="camera-glyph" aria-hidden="true">
              ◉
            </div>
            <strong>
              {status === 'connecting'
                ? 'Connecting to camera'
                : status === 'permission-required'
                  ? 'Camera permission required'
                  : 'No camera connected'}
            </strong>
            <span>
              {status === 'connecting'
                ? 'Waiting for the selected source to report its video mode.'
                : status === 'permission-required'
                  ? 'Allow camera access in macOS System Settings, then reconnect the source.'
                  : 'Connect a camera directly or choose OBS Virtual Camera to begin.'}
            </span>
            {(status === 'error' || status === 'disconnected') && (
              <button className="secondary-button" type="button" onClick={onReconnect}>
                Reconnect source
              </button>
            )}
          </div>
        )}
      </div>
      {streamInfo && (
        <div className="source-metadata" aria-label="Negotiated source metadata">
          <span>
            {streamInfo.width} × {streamInfo.height}
          </span>
          <span>{formatFrameRate(streamInfo.frameRate)}</span>
          <span>{formatAspectRatio(streamInfo.aspectRatio)}</span>
        </div>
      )}
      {hasSource && (
        <div className="source-metadata" aria-label="Tracking metadata">
          <span>{trackingStatus.replace('-', ' ')}</span>
          <span>{Math.round(trackingConfidence * 100)}% confidence</span>
          <span>Face {faceLandmarkCount}</span>
          <span>Pose {poseLandmarkCount}</span>
        </div>
      )}
      {hasSource && trackingError && (
        <p className="error-message" role="alert">
          Tracking error: {trackingError}
        </p>
      )}
      {lowResolution && (
        <p className="quality-warning">
          HDMI capture recommended for production; this source is below the 1080p
          quality target.
        </p>
      )}
      {error && (
        <p className="error-message" role="alert">
          {error.message}
        </p>
      )}
      <p className="preview-caption">
        {deviceLabel ?? 'No source selected'} · The raw source stays separate from the
        vertical composition so input quality is always visible.
      </p>
    </section>
  );
}
