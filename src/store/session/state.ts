import type { SessionStoreState } from './types';

export const initialSessionState: SessionStoreState = {
  status: 'new',
  appVersion: null,
  message: null,
};
