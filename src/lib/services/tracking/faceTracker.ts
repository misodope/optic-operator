import { clamp } from '../../utils/clamp';
import type {
  FaceTrackingSummary,
  LandmarkPoint,
  PoseTrackingSummary,
  SubjectState,
} from '../../../types/tracking';

const LEFT_EYE_INDEX = 33;
const RIGHT_EYE_INDEX = 263;
const LEFT_SHOULDER_INDEX = 11;
const RIGHT_SHOULDER_INDEX = 12;
const LEFT_HIP_INDEX = 23;
const RIGHT_HIP_INDEX = 24;

const finite = (value: number | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const normalizeVisibility = (value: number | undefined): number | undefined =>
  finite(value) ? clamp(value, 0, 1) : undefined;

export const normalizeLandmark = (landmark: LandmarkPoint): LandmarkPoint => ({
  x: clamp(finite(landmark.x) ? landmark.x : 0.5, 0, 1),
  y: clamp(finite(landmark.y) ? landmark.y : 0.5, 0, 1),
  ...(finite(landmark.z) ? { z: landmark.z } : {}),
  ...(normalizeVisibility(landmark.visibility) !== undefined
    ? { visibility: normalizeVisibility(landmark.visibility) }
    : {}),
  ...(normalizeVisibility(landmark.presence) !== undefined
    ? { presence: normalizeVisibility(landmark.presence) }
    : {}),
});

const normalizeLandmarks = (landmarks: LandmarkPoint[]): LandmarkPoint[] =>
  landmarks
    .filter((landmark) => finite(landmark.x) && finite(landmark.y))
    .map(normalizeLandmark);

const average = (values: Array<number | undefined>, fallback = 1): number => {
  const valid = values.filter((value): value is number => finite(value));
  return valid.length === 0
    ? fallback
    : valid.reduce((total, value) => total + clamp(value, 0, 1), 0) / valid.length;
};

const averagePositive = (values: Array<number | undefined>, fallback = 1): number => {
  const positive = values.filter(
    (value): value is number => finite(value) && value > 0,
  );
  return positive.length === 0
    ? fallback
    : positive.reduce((total, value) => total + clamp(value, 0, 1), 0) /
        positive.length;
};

const landmarkAt = (landmarks: LandmarkPoint[], index: number): LandmarkPoint | null =>
  landmarks[index] ?? null;

const boundsFor = (landmarks: LandmarkPoint[]) => {
  if (landmarks.length === 0) {
    return null;
  }

  const xs = landmarks.map((landmark) => landmark.x);
  const ys = landmarks.map((landmark) => landmark.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return {
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY),
  };
};

const scoreLandmarks = (
  landmarks: LandmarkPoint[],
  preferredIndices: number[],
): number => {
  if (landmarks.length === 0) {
    return 0;
  }

  const preferred = preferredIndices
    .map((index) => landmarks[index]?.visibility ?? landmarks[index]?.presence)
    .filter((value): value is number => finite(value));

  const visibleScore = average(
    preferred,
    average(landmarks.map((landmark) => landmark.visibility)),
  );
  const completeness = Math.min(1, landmarks.length / 33);
  return visibleScore * 0.8 + completeness * 0.2;
};

export const normalizeFaceLandmarks = (
  candidates: LandmarkPoint[][],
): FaceTrackingSummary | null => {
  const normalizedCandidates = candidates
    .map(normalizeLandmarks)
    .filter((landmarks) => landmarks.length > 0);

  const landmarks = normalizedCandidates
    .sort(
      (left, right) =>
        scoreLandmarks(right, [LEFT_EYE_INDEX, RIGHT_EYE_INDEX]) -
        scoreLandmarks(left, [LEFT_EYE_INDEX, RIGHT_EYE_INDEX]),
    )
    .at(0);

  if (!landmarks) {
    return null;
  }

  const bounds = boundsFor(landmarks);
  if (!bounds) {
    return null;
  }

  const leftEye = landmarkAt(landmarks, LEFT_EYE_INDEX);
  const rightEye = landmarkAt(landmarks, RIGHT_EYE_INDEX);
  const eyesDetected = leftEye !== null && rightEye !== null;
  const eyeX = eyesDetected ? (leftEye.x + rightEye.x) / 2 : bounds.centerX;
  const eyeY = eyesDetected ? (leftEye.y + rightEye.y) / 2 : bounds.centerY;
  // Face Landmarker versions can expose visibility as zero for otherwise valid
  // face landmarks. Treat an all-zero visibility field as unspecified rather
  // than turning a detected face into a zero-confidence subject.
  const visibility = averagePositive(landmarks.map((landmark) => landmark.visibility));

  return {
    landmarks,
    centerX: clamp(bounds.centerX, 0, 1),
    centerY: clamp(bounds.centerY, 0, 1),
    eyeX: clamp(eyeX, 0, 1),
    eyeY: clamp(eyeY, 0, 1),
    width: clamp(bounds.width, 0, 1),
    height: clamp(bounds.height, 0, 1),
    confidence: clamp(visibility * (eyesDetected ? 1 : 0.65), 0, 1),
    eyesDetected,
  };
};

export const normalizePoseLandmarks = (
  candidates: LandmarkPoint[][],
): PoseTrackingSummary | null => {
  const normalizedCandidates = candidates
    .map(normalizeLandmarks)
    .filter((landmarks) => landmarks.length > 0);
  const landmarks = normalizedCandidates
    .sort(
      (left, right) =>
        scoreLandmarks(right, [LEFT_SHOULDER_INDEX, RIGHT_SHOULDER_INDEX]) -
        scoreLandmarks(left, [LEFT_SHOULDER_INDEX, RIGHT_SHOULDER_INDEX]),
    )
    .at(0);

  if (!landmarks) {
    return null;
  }

  const leftShoulder = landmarkAt(landmarks, LEFT_SHOULDER_INDEX);
  const rightShoulder = landmarkAt(landmarks, RIGHT_SHOULDER_INDEX);
  const leftHip = landmarkAt(landmarks, LEFT_HIP_INDEX);
  const rightHip = landmarkAt(landmarks, RIGHT_HIP_INDEX);
  const shouldersDetected = leftShoulder !== null && rightShoulder !== null;
  const torsoPoints = [leftShoulder, rightShoulder, leftHip, rightHip];
  const torsoVisibility = average(torsoPoints.map((landmark) => landmark?.visibility));

  return {
    landmarks,
    shoulderCenterX: shouldersDetected
      ? clamp((leftShoulder.x + rightShoulder.x) / 2, 0, 1)
      : null,
    shoulderCenterY: shouldersDetected
      ? clamp((leftShoulder.y + rightShoulder.y) / 2, 0, 1)
      : null,
    shoulderWidth: shouldersDetected
      ? Math.abs(leftShoulder.x - rightShoulder.x)
      : null,
    shoulderVisibility: shouldersDetected
      ? average([leftShoulder.visibility, rightShoulder.visibility])
      : 0,
    torsoVisibility,
    confidence: clamp(
      average(landmarks.map((landmark) => landmark.visibility)) * 0.65 +
        torsoVisibility * 0.35,
      0,
      1,
    ),
  };
};

export const combineTrackingResults = ({
  face,
  pose,
  timestampMs,
}: {
  face: FaceTrackingSummary | null;
  pose: PoseTrackingSummary | null;
  timestampMs: number;
}): SubjectState => {
  if (!face && !pose) {
    return {
      detected: false,
      confidence: 0,
      x: 0.5,
      y: 0.5,
      eyeY: 0.32,
      shoulderWidth: null,
      face: null,
      pose: null,
      timestampMs,
    };
  }

  const faceX = face?.centerX ?? pose?.shoulderCenterX ?? 0.5;
  const faceY = face?.centerY ?? pose?.shoulderCenterY ?? 0.5;
  const eyeY = face?.eyeY ?? clamp((pose?.shoulderCenterY ?? 0.5) - 0.2, 0, 1);
  const confidence = face?.confidence ?? (pose?.confidence ?? 0) * 0.75;

  return {
    detected: confidence > 0,
    confidence: clamp(confidence, 0, 1),
    x: clamp(faceX, 0, 1),
    y: clamp(faceY, 0, 1),
    eyeY: clamp(eyeY, 0, 1),
    shoulderWidth: pose?.shoulderWidth ?? null,
    shoulderCenterX: pose?.shoulderCenterX ?? null,
    shoulderCenterY: pose?.shoulderCenterY ?? null,
    shoulderVisibility: pose?.shoulderVisibility ?? 0,
    faceWidth: face?.width ?? null,
    faceHeight: face?.height ?? null,
    face,
    pose,
    timestampMs,
  };
};
