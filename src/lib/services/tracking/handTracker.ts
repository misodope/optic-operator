export const HAND_TRACKING_ENABLED = false;

export interface HandTrackingStatus {
  enabled: false;
  message: 'Hand tracking is reserved for a later phase.';
}

export const getHandTrackingStatus = (): HandTrackingStatus => ({
  enabled: false,
  message: 'Hand tracking is reserved for a later phase.',
});
