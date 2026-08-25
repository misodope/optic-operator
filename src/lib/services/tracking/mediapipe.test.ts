import { describe, expect, it, vi } from 'vitest';

import {
  MediaPipeTracker,
  type MediaPipeWorkerLike,
  type MediaPipeWorkerResponse,
} from './mediapipe';

class FakeWorker implements MediaPipeWorkerLike {
  readonly messages: Array<{ message: unknown; transfer?: Transferable[] }> = [];

  terminated = false;

  private readonly listeners = new Set<
    (event: MessageEvent<MediaPipeWorkerResponse>) => void
  >();

  postMessage(message: unknown, transfer?: Transferable[]): void {
    this.messages.push({ message, transfer });
  }

  addEventListener(
    _type: 'message',
    listener: (event: MessageEvent<MediaPipeWorkerResponse>) => void,
  ): void {
    this.listeners.add(listener);
  }

  removeEventListener(
    _type: 'message',
    listener: (event: MessageEvent<MediaPipeWorkerResponse>) => void,
  ): void {
    this.listeners.delete(listener);
  }

  terminate(): void {
    this.terminated = true;
  }

  emit(response: MediaPipeWorkerResponse): void {
    const event = { data: response } as MessageEvent<MediaPipeWorkerResponse>;
    this.listeners.forEach((listener) => listener(event));
  }
}

const frame = () => {
  const close = vi.fn();
  return { close } as unknown as ImageBitmap & { close: ReturnType<typeof vi.fn> };
};

describe('MediaPipe tracker lifecycle', () => {
  it('initializes and disposes once through the worker boundary', async () => {
    const worker = new FakeWorker();
    const tracker = new MediaPipeTracker({
      worker,
      modelAssets: {
        wasm: 'models/wasm',
        face: 'models/face.task',
        pose: 'models/pose.task',
        gesture: 'models/gesture.task',
      },
    });
    const initialized = tracker.initialize();

    expect(worker.messages[0]?.message).toMatchObject({ type: 'init' });
    worker.emit({ type: 'ready' });
    await initialized;
    expect(tracker.getStatus()).toBe('ready');

    tracker.dispose();

    expect(worker.messages.at(-1)?.message).toEqual({ type: 'dispose' });
    expect(worker.terminated).toBe(true);
    expect(tracker.getStatus()).toBe('disposed');
  });

  it('keeps only the newest pending frame while inference is in flight', async () => {
    const worker = new FakeWorker();
    const results = vi.fn();
    const tracker = new MediaPipeTracker({ worker, onResult: results });
    const initialized = tracker.initialize();
    worker.emit({ type: 'ready' });
    await initialized;

    const first = frame();
    const second = frame();
    const third = frame();
    tracker.submitFrame(first, 100);
    tracker.submitFrame(second, 110);
    tracker.submitFrame(third, 120);

    expect(worker.messages).toHaveLength(2);
    expect(second.close).toHaveBeenCalledOnce();
    expect(worker.messages[1]?.message).toMatchObject({
      type: 'detect',
      timestampMs: 100,
    });

    worker.emit({
      type: 'result',
      requestId: 1,
      timestampMs: 100,
      faceLandmarks: [],
      poseLandmarks: [],
      handLandmarks: [],
      handConfidence: 0,
    });

    expect(worker.messages).toHaveLength(3);
    expect(worker.messages[2]?.message).toMatchObject({
      type: 'detect',
      timestampMs: 120,
    });

    worker.emit({
      type: 'result',
      requestId: 2,
      timestampMs: 120,
      faceLandmarks: [],
      poseLandmarks: [],
      handLandmarks: [],
      handConfidence: 0,
    });

    expect(results).toHaveBeenCalledWith(
      expect.objectContaining({
        timestampMs: 120,
        diagnostics: expect.objectContaining({ status: 'lost' }),
      }),
    );
  });

  it('rejects remote model URLs and stale frames', () => {
    expect(
      () =>
        new MediaPipeTracker({
          modelAssets: {
            wasm: 'https://example.com/wasm',
            face: 'models/face.task',
            pose: 'models/pose.task',
            gesture: 'models/gesture.task',
          },
        }),
    ).toThrow('bundled local application files');

    const worker = new FakeWorker();
    const tracker = new MediaPipeTracker({ worker });
    const initialized = tracker.initialize();
    worker.emit({ type: 'ready' });
    return initialized.then(() => {
      const current = frame();
      const old = frame();
      tracker.submitFrame(current, 200);
      expect(tracker.submitFrame(old, 199)).toBe(false);
      expect(old.close).toHaveBeenCalledOnce();
    });
  });
});
