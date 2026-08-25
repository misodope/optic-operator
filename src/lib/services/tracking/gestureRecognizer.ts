import { clamp } from '../../utils/clamp';
import type {
  GestureCommand,
  GestureState,
  LandmarkPoint,
} from '../../../types/tracking';

export const GESTURE_RECOGNITION_ENABLED = true;

export interface GestureRecognitionStatus {
  enabled: true;
  message: 'Pinch-to-zoom is active.';
}

export const getGestureRecognitionStatus = (): GestureRecognitionStatus => ({
  enabled: true,
  message: 'Pinch-to-zoom is active.',
});

const WRIST = 0;
const THUMB_TIP = 4;
const INDEX_TIP = 8;
const MIDDLE_MCP = 9;

const ZOOM_OUT_THRESHOLD = 0.52;
const ZOOM_OUT_RELEASE_THRESHOLD = 0.64;
const ZOOM_IN_THRESHOLD = 1.02;
const ZOOM_IN_RELEASE_THRESHOLD = 0.9;
// GestureRecognizer's handedness score is not the same as its hand-detection
// confidence. Keep this low and rely primarily on the 21-point landmark shape,
// size gate, and activation debounce.
const MIN_HAND_CONFIDENCE = 0.3;
const MIN_PALM_SCALE = 0.03;
const MIN_HAND_AREA = 0.0025;
const GESTURE_ZONE_BOTTOM = 0.84;

const distanceBetween = (a: LandmarkPoint, b: LandmarkPoint): number =>
  Math.hypot(a.x - b.x, a.y - b.y);

const boundsFor = (
  landmarks: LandmarkPoint[],
): { width: number; height: number } | null => {
  if (
    landmarks.length === 0 ||
    landmarks.some(
      (landmark) => !Number.isFinite(landmark.x) || !Number.isFinite(landmark.y),
    )
  ) {
    return null;
  }

  const xs = landmarks.map((landmark) => landmark.x);
  const ys = landmarks.map((landmark) => landmark.y);
  return {
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
};

export const isUsableHand = (landmarks: LandmarkPoint[], confidence = 1): boolean => {
  const wrist = landmarks[WRIST];
  const middleMcp = landmarks[MIDDLE_MCP];
  const bounds = boundsFor(landmarks);

  if (
    landmarks.length < 21 ||
    confidence < MIN_HAND_CONFIDENCE ||
    !wrist ||
    !middleMcp ||
    !bounds
  ) {
    return false;
  }

  const palmScale = distanceBetween(wrist, middleMcp);
  return palmScale >= MIN_PALM_SCALE && bounds.width * bounds.height >= MIN_HAND_AREA;
};

export const isHandInGestureZone = (landmarks: LandmarkPoint[]): boolean => {
  if (landmarks.length === 0) {
    return false;
  }

  const centerY =
    landmarks.reduce((sum, landmark) => sum + landmark.y, 0) / landmarks.length;
  return centerY <= GESTURE_ZONE_BOTTOM;
};

const neutralGesture = (
  pinchDistance: number | null,
  confidence: number,
): GestureState => ({
  command: 'none',
  zoomIntent: 0,
  confidence: clamp(confidence, 0, 1),
  pinchDistance,
  label: null,
});

export const createNeutralGestureState = (): GestureState => neutralGesture(null, 0);

/**
 * Classifies a hand's thumb/index distance relative to its own palm size.
 * This keeps the gesture usable when the hand moves closer to or farther from
 * the camera. A neutral distance intentionally does not affect framing.
 */
export const classifyPinchZoom = (
  landmarks: LandmarkPoint[],
  confidence = 1,
  previousCommand: GestureCommand = 'none',
): GestureState => {
  if (!isUsableHand(landmarks, confidence)) {
    return createNeutralGestureState();
  }

  const wrist = landmarks[WRIST];
  const thumbTip = landmarks[THUMB_TIP];
  const indexTip = landmarks[INDEX_TIP];
  const middleMcp = landmarks[MIDDLE_MCP];

  if (!wrist || !thumbTip || !indexTip || !middleMcp) {
    return createNeutralGestureState();
  }

  const palmScale = distanceBetween(wrist, middleMcp);
  if (palmScale <= 0.001) {
    return createNeutralGestureState();
  }

  const pinchDistance = distanceBetween(thumbTip, indexTip) / palmScale;
  const zoomOutThreshold =
    previousCommand === 'zoom-out' ? ZOOM_OUT_RELEASE_THRESHOLD : ZOOM_OUT_THRESHOLD;
  const zoomInThreshold =
    previousCommand === 'zoom-in' ? ZOOM_IN_RELEASE_THRESHOLD : ZOOM_IN_THRESHOLD;

  if (pinchDistance <= zoomOutThreshold) {
    return {
      command: 'zoom-out',
      zoomIntent: -1,
      confidence: clamp(confidence, 0, 1),
      pinchDistance,
      label: 'Pinch — zoom out',
    };
  }

  if (pinchDistance >= zoomInThreshold) {
    return {
      command: 'zoom-in',
      zoomIntent: 1,
      confidence: clamp(confidence, 0, 1),
      pinchDistance,
      label: 'Spread — zoom in',
    };
  }

  return neutralGesture(pinchDistance, confidence);
};
