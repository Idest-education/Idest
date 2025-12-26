import { BadRequestException, Controller, Headers, Post, Req } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { WebhookReceiver } from 'livekit-server-sdk';
import { PrismaService } from 'src/prisma/prisma.service';

function parseSessionIdFromRoomName(roomName: string): string | null {
  const prefix = 'session-';
  if (!roomName?.startsWith(prefix)) return null;
  return roomName.slice(prefix.length) || null;
}

function normalizeEpochToDate(epoch: bigint): Date | null {
  const n = Number(epoch);
  if (!Number.isFinite(n) || n <= 0) return null;
  // LiveKit can return epoch timestamps in seconds, milliseconds, microseconds, or nanoseconds.
  let ms: number;
  if (n >= 1e17) {
    // nanoseconds -> ms
    ms = Math.floor(n / 1e6);
  } else if (n >= 1e14) {
    // microseconds -> ms
    ms = Math.floor(n / 1e3);
  } else if (n >= 1e11) {
    // milliseconds
    ms = n;
  } else {
    // seconds
    ms = n * 1000;
  }
  const d = new Date(ms);
  return Number.isFinite(d.getTime()) ? d : null;
}

function mapEgressStatusToRecordingStatus(status: number): string {
  // livekit.EgressStatus
  switch (status) {
    case 0:
      return 'STARTING';
    case 1:
      return 'ACTIVE';
    case 2:
      return 'ENDING';
    case 3:
      return 'COMPLETE';
    case 4:
      return 'FAILED';
    case 5:
      return 'ABORTED';
    case 6:
      return 'LIMIT_REACHED';
    default:
      return 'UNKNOWN';
  }
}

function resolvePublicUrl(
  fileLocation: string | null | undefined,
  publicBaseUrl: string | null | undefined,
): string | null {
  if (!fileLocation) return null;
  if (fileLocation.startsWith('http://') || fileLocation.startsWith('https://')) {
    return fileLocation;
  }
  if (fileLocation.startsWith('s3://')) {
    // s3://bucket/path/to/file.mp4 -> path/to/file.mp4
    const withoutScheme = fileLocation.slice('s3://'.length);
    const firstSlash = withoutScheme.indexOf('/');
    const key = firstSlash >= 0 ? withoutScheme.slice(firstSlash + 1) : '';
    if (!key || !publicBaseUrl) return null;
    return `${publicBaseUrl.replace(/\/$/, '')}/${key}`;
  }
  return null;
}

@Controller('livekit')
export class LiveKitWebhookController {
  private readonly receiver: WebhookReceiver;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const apiKey = this.configService.get<string>('LIVEKIT_API_KEY');
    const apiSecret = this.configService.get<string>('LIVEKIT_API_SECRET');
    if (!apiKey || !apiSecret) {
      throw new Error('LIVEKIT_API_KEY/LIVEKIT_API_SECRET are required for LiveKit webhooks');
    }
    this.receiver = new WebhookReceiver(apiKey, apiSecret);
  }

  @Post('webhook')
  async handleWebhook(
    @Req() req: Request & { rawBody?: Buffer; bodyRaw?: Buffer },
    @Headers('authorization') authorization?: string,
    @Headers('Authorize') authorize?: string,
  ) {
    const rawBody =
      (req as any).rawBody || (req as any).bodyRaw || Buffer.from(JSON.stringify(req.body ?? {}));
    const authHeader = authorization || authorize;

    let event: any;
    try {
      event = await this.receiver.receive(rawBody.toString('utf8'), authHeader);
    } catch (err) {
      throw new BadRequestException('Invalid LiveKit webhook signature');
    }

    if (!event?.event || !String(event.event).startsWith('egress_')) {
      return { received: true };
    }

    const egressInfo = event.egressInfo;
    if (!egressInfo?.egressId) {
      return { received: true };
    }

    const sessionId = parseSessionIdFromRoomName(egressInfo.roomName || '');
    if (!sessionId) {
      return { received: true };
    }

    const status = mapEgressStatusToRecordingStatus(egressInfo.status);
    const startedAt =
      normalizeEpochToDate(egressInfo.startedAt) ||
      normalizeEpochToDate(event.createdAt) ||
      null;
    const endedAt = normalizeEpochToDate(egressInfo.endedAt) || null;

    const file0 = Array.isArray(egressInfo.fileResults) ? egressInfo.fileResults[0] : undefined;
    const fileLocation: string | undefined = file0?.location || undefined;
    const filename: string | undefined = file0?.filename || undefined;
    const durationSeconds =
      typeof file0?.duration === 'bigint' ? Number(file0.duration) : undefined;
    const sizeBytes = typeof file0?.size === 'bigint' ? file0.size : undefined;

    const error: string | undefined = egressInfo.error || undefined;

    const prismaAny = this.prisma as any;
    await prismaAny.recording.upsert({
      where: { egressId: egressInfo.egressId },
      create: {
        sessionId,
        egressId: egressInfo.egressId,
        status,
        filename,
        fileLocation,
        startedAt: startedAt ?? undefined,
        endedAt: endedAt ?? undefined,
        durationSeconds,
        sizeBytes,
        error,
      },
      update: {
        status,
        filename,
        fileLocation,
        startedAt: startedAt ?? undefined,
        endedAt: endedAt ?? undefined,
        durationSeconds,
        sizeBytes,
        error,
      },
    });

    // If we have a public URL, mirror it into Session.recording_url for backwards compatibility
    const publicBaseUrl = this.configService.get<string>('RECORDING_PUBLIC_BASE_URL') || null;
    const url = resolvePublicUrl(fileLocation, publicBaseUrl);
    if (url && status === 'COMPLETE') {
      await this.prisma.session.update({
        where: { id: sessionId },
        data: { recording_url: url },
      });
    }

    return { received: true };
  }
}


