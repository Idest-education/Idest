import { RabbitService, TransientError } from './rabbit.service';

type Handler = (msg: any) => Promise<void>;

function fakeChannel() {
  const state: { handler?: Handler } = {};
  return {
    state,
    assertQueue: jest.fn().mockResolvedValue(undefined),
    assertExchange: jest.fn().mockResolvedValue(undefined),
    prefetch: jest.fn().mockResolvedValue(undefined),
    consume: jest.fn().mockImplementation((_q: string, h: Handler) => {
      state.handler = h;
      return Promise.resolve(undefined);
    }),
    ack: jest.fn(),
    nack: jest.fn(),
    sendToQueue: jest.fn(),
  };
}

function msg(body: unknown, attempts = 0) {
  return {
    content: Buffer.from(JSON.stringify(body)),
    properties: { headers: attempts ? { 'x-attempts': attempts } : {} },
    fields: {},
  };
}

describe('RabbitService.consume reliability', () => {
  let svc: RabbitService;
  let ch: ReturnType<typeof fakeChannel>;

  beforeEach(() => {
    jest.useFakeTimers();
    svc = new RabbitService({ get: () => undefined } as any);
    ch = fakeChannel();
    (svc as any).channel = ch;
  });
  afterEach(() => jest.useRealTimers());

  it('acks on success and never republishes', async () => {
    await svc.consume('grade_queue', async () => {});
    await ch.state.handler!(msg({ ok: true }));

    expect(ch.ack).toHaveBeenCalledTimes(1);
    expect(ch.sendToQueue).not.toHaveBeenCalled();
    expect(ch.nack).not.toHaveBeenCalled();
  });

  it('dead-letters a non-transient error immediately (republish to <queue>.dead + ack, no retry to main)', async () => {
    await svc.consume('grade_queue', async () => {
      throw new Error('bad payload');
    });
    await ch.state.handler!(msg({}));

    // Republished to the explicit dead queue with a reason header.
    expect(ch.sendToQueue).toHaveBeenCalledTimes(1);
    expect(ch.sendToQueue).toHaveBeenCalledWith(
      'grade_queue.dead',
      expect.any(Buffer),
      expect.objectContaining({
        persistent: true,
        headers: expect.objectContaining({ 'x-death-reason': expect.any(String) }),
      }),
    );
    // Original removed from the main queue.
    expect(ch.ack).toHaveBeenCalledTimes(1);
    // Never re-queued to the main queue, never nack-requeued.
    expect(ch.sendToQueue).not.toHaveBeenCalledWith('grade_queue', expect.anything(), expect.anything());
    expect(ch.nack).not.toHaveBeenCalled();
  });

  it('retries a transient error below the cap: republish to main queue with x-attempts incremented + ack original', async () => {
    await svc.consume('grade_queue', async () => {
      throw new TransientError('downstream 503');
    });

    await ch.state.handler!(msg({}, 0));

    // Original acked immediately after scheduling the retry.
    expect(ch.ack).toHaveBeenCalledTimes(1);
    // Nothing published yet — the retry is delayed.
    expect(ch.sendToQueue).not.toHaveBeenCalled();

    jest.runOnlyPendingTimers();

    expect(ch.sendToQueue).toHaveBeenCalledTimes(1);
    expect(ch.sendToQueue).toHaveBeenCalledWith(
      'grade_queue',
      expect.any(Buffer),
      expect.objectContaining({ persistent: true, headers: expect.objectContaining({ 'x-attempts': 1 }) }),
    );
    expect(ch.nack).not.toHaveBeenCalled();
  });

  it('dead-letters a transient error once the attempt cap is reached', async () => {
    await svc.consume('grade_queue', async () => {
      throw new TransientError('downstream 503');
    });

    // x-attempts already at the default cap (3) -> terminal, no more retries.
    await ch.state.handler!(msg({}, 3));

    expect(ch.sendToQueue).toHaveBeenCalledTimes(1);
    expect(ch.sendToQueue).toHaveBeenCalledWith(
      'grade_queue.dead',
      expect.any(Buffer),
      expect.objectContaining({
        persistent: true,
        headers: expect.objectContaining({ 'x-death-reason': expect.any(String) }),
      }),
    );
    expect(ch.ack).toHaveBeenCalledTimes(1);
    expect(ch.sendToQueue).not.toHaveBeenCalledWith('grade_queue', expect.anything(), expect.anything());

    jest.runOnlyPendingTimers();
    expect(ch.sendToQueue).toHaveBeenCalledTimes(1); // still no retry republish
  });
});
