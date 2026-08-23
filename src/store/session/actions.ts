import type { SessionStoreActions, SessionStoreState } from './types';

type SetState = (
  updater:
    | Partial<SessionStoreState>
    | ((state: SessionStoreState) => Partial<SessionStoreState>),
) => void;

export const createSessionActions = (set: SetState): SessionStoreActions => ({
  setAppVersion: (appVersion) => set({ appVersion }),
  setMessage: (message) => set({ message }),
  setStatus: (status) => set({ status }),
});
