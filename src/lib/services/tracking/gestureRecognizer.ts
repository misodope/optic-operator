export const GESTURE_RECOGNITION_ENABLED = false;

export interface GestureRecognitionStatus {
  enabled: false;
  message: 'Gesture recognition is reserved for a later phase.';
}

export const getGestureRecognitionStatus = (): GestureRecognitionStatus => ({
  enabled: false,
  message: 'Gesture recognition is reserved for a later phase.',
});
