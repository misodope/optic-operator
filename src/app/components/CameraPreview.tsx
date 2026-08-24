import type { RefObject } from 'react';

import type { CameraError, CameraStatus, CameraStreamInfo } from '../../types/camera';
import { formatAspectRatio, isLowResolution } from '../../lib/utils/aspectRatio';
import type { RuntimeTrackingStatus } from '../../types/tracking';

interface CameraPreviewProps {
  deviceLabel: string | null;
  status: CameraStatus;
  streamInfo: CameraStreamInfo | null;
  error: CameraError | null;
  videoRef: RefObject<HTMLVideoElement | null>;
  onReconnect: () => void;
  trackingStatus?: RuntimeTrackingStatus;
  trackingConfidence?: number;
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
}: CameraPreviewProps) {
  const hasSource = status === 'ready' && streamInfo !== null;
  const lowResolution = streamInfo
    ? isLowResolution(streamInfo.width, streamInfo.height)
    : false;

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
                  : 'Connect the LUMIX S9 directly or choose OBS Virtual Camera to begin.'}
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
        </div>
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
