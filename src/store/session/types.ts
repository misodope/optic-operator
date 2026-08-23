export type SessionStatus = 'new' | 'ready' | 'error';

export interface SessionStoreState {
  status: SessionStatus;
  appVersion: string | null;
  message: string | null;
}

export interface SessionStoreActions {
  setAppVersion: (version: string) => void;
  setMessage: (message: string | null) => void;
  setStatus: (status: SessionStatus) => void;
}

export type SessionStore = SessionStoreState & SessionStoreActions;
