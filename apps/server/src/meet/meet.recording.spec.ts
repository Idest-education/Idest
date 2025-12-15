import { MeetService } from './meet.service';

describe('MeetService recording helpers', () => {
  const makeService = (overrides?: any) => {
    const prisma = overrides?.prisma || {
      session: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      recording: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
    };

    return new MeetService(
      prisma as any,
      {} as any,
      {} as any,
      {} as any,
    );
  };

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.LIVEKIT_EGRESS_S3_ACCESS_KEY;
    delete process.env.LIVEKIT_EGRESS_S3_SECRET_KEY;
    delete process.env.LIVEKIT_EGRESS_S3_REGION;
    delete process.env.LIVEKIT_EGRESS_S3_ENDPOINT;
    delete process.env.LIVEKIT_EGRESS_S3_FORCE_PATH_STYLE;
    delete process.env.RECORDING_URL_EXPIRES_SECONDS;
  });

  it('listRecordings returns Recording rows with recordingId', async () => {
    const service = makeService({
      prisma: {
        session: {
          findUnique: jest.fn().mockResolvedValue({ recording_url: null }),
        },
        recording: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'rec_1',
              egressId: 'eg_1',
              fileLocation: 'https://cdn.example.com/recordings/x.mp4',
              startedAt: new Date('2025-01-01T00:00:00.000Z'),
              endedAt: new Date('2025-01-01T00:10:00.000Z'),
              status: 'COMPLETE',
            },
          ]),
        },
      },
    });

    const items = await service.listRecordings('session_1');
    expect(items).toEqual([
      {
        recordingId: 'rec_1',
        egressId: 'eg_1',
        url: 'https://cdn.example.com/recordings/x.mp4',
        startedAt: '2025-01-01T00:00:00.000Z',
        stoppedAt: '2025-01-01T00:10:00.000Z',
      },
    ]);
  });

  it('getRecordingUrl returns a presigned URL for s3:// locations when creds are configured', async () => {
    process.env.LIVEKIT_EGRESS_S3_ACCESS_KEY = 'AKIDEXAMPLE';
    process.env.LIVEKIT_EGRESS_S3_SECRET_KEY = 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY';
    process.env.LIVEKIT_EGRESS_S3_REGION = 'us-east-1';
    process.env.LIVEKIT_EGRESS_S3_ENDPOINT = 'https://s3.us-east-1.amazonaws.com';
    process.env.RECORDING_URL_EXPIRES_SECONDS = '600';

    const service = makeService({
      prisma: {
        recording: {
          findUnique: jest.fn().mockResolvedValue({
            sessionId: 'session_1',
            fileLocation: 's3://my-bucket/recordings/session_1/123.mp4',
          }),
        },
      },
    });

    const res = await service.getRecordingUrl('rec_1');
    expect(res.sessionId).toBe('session_1');
    expect(res.location).toBe('s3://my-bucket/recordings/session_1/123.mp4');
    expect(res.url).toContain('X-Amz-Algorithm=AWS4-HMAC-SHA256');
    expect(res.url).toContain('X-Amz-Signature=');
  });
});


