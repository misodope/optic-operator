export const HAND_TRACKING_ENABLED = true;

export interface HandTrackingStatus {
  enabled: true;
  message: 'Hand landmarks power pinch-to-zoom.';
}

export const getHandTrackingStatus = (): HandTrackingStatus => ({
  enabled: true,
  message: 'Hand landmarks power pinch-to-zoom.',
});
