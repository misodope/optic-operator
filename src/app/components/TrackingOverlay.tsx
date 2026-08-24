import type { CameraControllerState } from '../../lib/camera-controller/types';
import type {
  LandmarkPoint,
  RuntimeTrackingStatus,
  SubjectState,
} from '../../types/tracking';

interface TrackingOverlayProps {
  subject: SubjectState | null;
  controllerState: CameraControllerState | null;
  trackingStatus: RuntimeTrackingStatus;
}

interface OverlayRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const boundsFor = (
  landmarks: LandmarkPoint[],
  indices?: number[],
): OverlayRect | null => {
  const points = (indices ?? landmarks.map((_, index) => index))
    .map((index) => landmarks[index])
    .filter((landmark): landmark is LandmarkPoint => Boolean(landmark));

  if (points.length === 0) {
    return null;
  }

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return {
    x: minX,
    y: minY,
    width: Math.max(0.01, maxX - minX),
    height: Math.max(0.01, maxY - minY),
  };
};

const projectPoint = (
  x: number,
  y: number,
  crop: CameraControllerState['crop'],
): { x: number; y: number } => ({
  x: (x - crop.x) / Math.max(0.001, crop.width),
  y: (y - crop.y) / Math.max(0.001, crop.height),
});

const projectRect = (
  rect: OverlayRect,
  crop: CameraControllerState['crop'],
): OverlayRect => {
  const topLeft = projectPoint(rect.x, rect.y, crop);
  const bottomRight = projectPoint(rect.x + rect.width, rect.y + rect.height, crop);

  return {
    x: topLeft.x,
    y: topLeft.y,
    width: bottomRight.x - topLeft.x,
    height: bottomRight.y - topLeft.y,
  };
};

const clampRect = (rect: OverlayRect): OverlayRect => ({
  x: Math.max(0, Math.min(1, rect.x)),
  y: Math.max(0, Math.min(1, rect.y)),
  width: Math.max(0.01, Math.min(1 - Math.max(0, rect.x), rect.width)),
  height: Math.max(0.01, Math.min(1 - Math.max(0, rect.y), rect.height)),
});

export function TrackingOverlay({
  subject,
  controllerState,
  trackingStatus,
}: TrackingOverlayProps) {
  if (!subject?.detected || !controllerState) {
    return null;
  }

  const faceBounds = subject.face
    ? projectRect(
        {
          x: subject.face.centerX - subject.face.width / 2,
          y: subject.face.centerY - subject.face.height / 2,
          width: subject.face.width,
          height: subject.face.height,
        },
        controllerState.crop,
      )
    : null;
  const shoulderBounds = subject.pose
    ? projectRect(
        boundsFor(subject.pose.landmarks, [11, 12, 23, 24]) ?? {
          x:
            (subject.pose.shoulderCenterX ?? subject.x) -
            (subject.pose.shoulderWidth ?? 0.2) / 2,
          y: (subject.pose.shoulderCenterY ?? subject.y) - 0.06,
          width: subject.pose.shoulderWidth ?? 0.2,
          height: 0.12,
        },
        controllerState.crop,
      )
    : null;
  const eye = subject.face
    ? projectPoint(subject.face.eyeX, subject.face.eyeY, controllerState.crop)
    : null;
  const label = trackingStatus === 'low-confidence' ? 'LOW CONFIDENCE' : 'TRACKING';

  return (
    <>
      <svg
        className="tracking-overlay"
        viewBox="0 0 1 1"
        preserveAspectRatio="none"
        aria-label="Tracking debug overlay"
      >
        {faceBounds && (
          <rect className="tracking-box tracking-box-face" {...clampRect(faceBounds)} />
        )}
        {shoulderBounds && (
          <rect
            className="tracking-box tracking-box-shoulders"
            {...clampRect(shoulderBounds)}
          />
        )}
        {eye && (
          <circle
            className="tracking-eye"
            cx={Math.max(0, Math.min(1, eye.x))}
            cy={Math.max(0, Math.min(1, eye.y))}
            r="0.012"
          />
        )}
      </svg>
      <div className="tracking-overlay-label">
        <span className="tracking-overlay-dot" />
        <span>{label}</span>
        <span>{Math.round(subject.confidence * 100)}%</span>
      </div>
    </>
  );
}
