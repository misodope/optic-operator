import { create } from 'zustand';

import { createSessionActions } from './actions';
import { initialSessionState } from './state';
import type { SessionStore } from './types';

export const useSessionStore = create<SessionStore>((set) => ({
  ...initialSessionState,
  ...createSessionActions(set),
}));

export type { SessionStore } from './types';
