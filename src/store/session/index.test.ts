import { describe, expect, it } from 'vitest';

import { useSessionStore } from './index';

describe('session store', () => {
  it('starts with a clear empty-session state', () => {
    const state = useSessionStore.getState();

    expect(state.status).toBe('new');
    expect(state.appVersion).toBeNull();
    expect(state.message).toBeNull();
  });
});
