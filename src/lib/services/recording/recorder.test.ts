import { describe, expect, it } from 'vitest';

import { RECORDING_MIME_TYPES, selectRecordingMimeType } from './recorder';

describe('recording format selection', () => {
  it('prefers VP9 with audio when available', () => {
    expect(
      selectRecordingMimeType((mimeType) => mimeType === RECORDING_MIME_TYPES[0]),
    ).toBe(RECORDING_MIME_TYPES[0]);
  });

  it('falls back to a supported WebM format', () => {
    expect(selectRecordingMimeType((mimeType) => mimeType === 'video/webm')).toBe(
      'video/webm',
    );
  });

  it('fails clearly when no recording format is supported', () => {
    expect(() => selectRecordingMimeType(() => false)).toThrow(
      'compatible recording format',
    );
  });
});
