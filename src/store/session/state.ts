import type { SessionStoreState } from './types';

export const initialSessionState: SessionStoreState = {
  status: 'new',
  appVersion: null,
  message: null,
  tracking: {
    status: 'disabled',
    confidence: 0,
    subject: null,
    lastResultTimestampMs: null,
    inferenceFps: 0,
    staleResultsDropped: 0,
    faceLandmarkCount: 0,
    poseLandmarkCount: 0,
    handLandmarks: null,
    gesture: {
      command: 'none',
      zoomIntent: 0,
      confidence: 0,
      pinchDistance: null,
      label: null,
    },
    error: null,
  },
};
