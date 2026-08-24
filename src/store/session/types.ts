export type SessionStatus = 'new' | 'ready' | 'error';

import type { TrackingDiagnostics } from '../../types/tracking';

export interface SessionStoreState {
  status: SessionStatus;
  appVersion: string | null;
  message: string | null;
  tracking: TrackingDiagnostics;
}

export interface SessionStoreActions {
  setAppVersion: (version: string) => void;
  setMessage: (message: string | null) => void;
  setStatus: (status: SessionStatus) => void;
  setTracking: (tracking: TrackingDiagnostics) => void;
}

export type SessionStore = SessionStoreState & SessionStoreActions;
