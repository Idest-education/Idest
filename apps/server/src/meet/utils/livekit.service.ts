import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Buffer } from 'node:buffer';
import {
  AccessToken,
  type CreateOptions,
  RoomServiceClient,
  type Room,
  type ParticipantInfo,
  DataPacket_Kind,
  EgressClient,
  TrackType,
  EncodedFileType,
  type EncodedFileOutput,
  type RoomCompositeOptions,
  type S3Upload,
} from 'livekit-server-sdk';
import type { VideoGrant } from 'livekit-server-sdk';

export interface EnsureSessionRoomOptions {
  sessionId: string;
  maxParticipants?: number;
  emptyTimeout?: number;
  departureTimeout?: number;
  metadata?: Record<string, unknown> | string;
}

export interface LiveKitTokenOptions {
  roomName: string;
  identity: string;
  name?: string;
  metadata?: Record<string, unknown> | string;
  canPublish?: boolean;
  canPublishData?: boolean;
  canSubscribe?: boolean;
  canUpdateOwnMetadata?: boolean;
  hidden?: boolean;
  recorder?: boolean;
}

export interface LiveKitDataMessageOptions {
  topic?: string;
  destinationIdentities?: string[];
  destinationSids?: string[];
  kind?: DataPacket_Kind;
}

@Injectable()
export class LiveKitService {
  private readonly logger = new Logger(LiveKitService.name);
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly serverUrl: string;
  private readonly roomServiceHost: string;
  private readonly roomServiceClient: RoomServiceClient;
  private readonly egressServiceClient: EgressClient;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.requireEnv('LIVEKIT_API_KEY');
    this.apiSecret = this.requireEnv('LIVEKIT_API_SECRET');
    this.serverUrl = this.requireEnv('LIVEKIT_URL');
    this.roomServiceHost = this.normalizeServiceHost(this.serverUrl);
    this.roomServiceClient = new RoomServiceClient(
      this.roomServiceHost,
      this.apiKey,
      this.apiSecret,
    );
    this.egressServiceClient = new EgressClient(
      this.roomServiceHost,
      this.apiKey,
      this.apiSecret,
    );
  }

  async sendSessionDataMessage(
    sessionId: string,
    payload: unknown,
    options?: LiveKitDataMessageOptions,
  ): Promise<void> {
    const { roomName } = await this.ensureSessionRoom({
      sessionId,
    });
    await this.sendData(roomName, payload, options);
  }

  private requireEnv(key: string): string {
    const value = this.configService.get<string>(key);
    if (!value) {
      this.logger.error(`Missing configuration for ${key}`);
      throw new Error(
        `LIVEKIT configuration error: ${key} environment variable is required`,
      );
    }
    return value;
  }

  private optionalEnv(key: string): string | undefined {
    const value = this.configService.get<string>(key);
    return value || undefined;
  }

   /**
    * Require an environment variable specifically for egress/recording.
    * Throws a clear error so we fail fast instead of sending an invalid
    * egress request to LiveKit (which only reports "missing output").
    */
  private requireEgressEnv(key: string): string {
    const value = this.optionalEnv(key);
    if (!value) {
      this.logger.error(
        `LiveKit egress configuration error: ${key} environment variable is required for recording`,
      );
      throw new Error(
        `LiveKit recording storage is misconfigured. Missing required env: ${key}`,
      );
    }
    return value;
  }

  get url(): string {
    return this.serverUrl;
  }

  buildRoomName(sessionId: string): string {
    return `session-${sessionId}`;
  }

  async ensureSessionRoom(
    options: EnsureSessionRoomOptions,
  ): Promise<{ room: Room; roomName: string }> {
    const roomName = this.buildRoomName(options.sessionId);
    const room = await this.ensureRoom(roomName, {
      emptyTimeout: options.emptyTimeout ?? 60,
      departureTimeout: options.departureTimeout ?? 20,
      maxParticipants: options.maxParticipants ?? undefined,
      metadata:
        this.serializeMetadata(
          options.metadata ?? { sessionId: options.sessionId },
        ) ?? undefined,
    });

    return { room, roomName };
  }

  async listParticipants(roomName: string): Promise<ParticipantInfo[]> {
    return this.roomServiceClient.listParticipants(roomName);
  }

  async removeParticipant(roomName: string, identity: string): Promise<void> {
    await this.roomServiceClient.removeParticipant(roomName, identity);
  }

  async getParticipant(
    roomName: string,
    identity: string,
  ): Promise<ParticipantInfo | null> {
    try {
      const participants = await this.listParticipants(roomName);
      return participants.find((p) => p.identity === identity) || null;
    } catch (error) {
      this.logger.error(
        `Failed to get participant ${identity} from room ${roomName}: ${error instanceof Error ? error.message : error}`,
      );
      return null;
    }
  }

  async mutePublishedTrack(
    roomName: string,
    identity: string,
    trackSid: string,
    muted: boolean,
  ): Promise<void> {
    await this.roomServiceClient.mutePublishedTrack(
      roomName,
      identity,
      trackSid,
      muted,
    );
  }

  async getParticipantTracks(
    roomName: string,
    identity: string,
  ): Promise<Array<{ sid: string; type: 'audio' | 'video' }>> {
    const participant = await this.getParticipant(roomName, identity);
    if (!participant) {
      return [];
    }

    const tracks: Array<{ sid: string; type: 'audio' | 'video' }> = [];

    participant.tracks?.forEach((trackInfo) => {
      if (trackInfo.sid && trackInfo.type !== undefined) {
        // TrackType: AUDIO = 1, VIDEO = 2
        const isAudio =
          trackInfo.type === TrackType.AUDIO || trackInfo.type === 1;
        tracks.push({
          sid: trackInfo.sid,
          type: isAudio ? 'audio' : 'video',
        });
      }
    });

    return tracks;
  }

  async startRoomRecording(
    sessionId: string,
    options?: {
      layout?: string;
      audioOnly?: boolean;
      videoOnly?: boolean;
      filepath?: string;
    },
  ): Promise<string> {
    try {
      const roomName = this.buildRoomName(sessionId);

      const filepath =
        options?.filepath || `recordings/${sessionId}/${Date.now()}.mp4`;

      // Require S3-compatible upload configuration for LiveKit Cloud egress.
      // If any of these are missing, fail fast with a clear error instead of
      // letting LiveKit respond with the generic "missing or invalid field: output".
      const s3Bucket = this.requireEgressEnv('LIVEKIT_EGRESS_S3_BUCKET');
      const s3Region = this.requireEgressEnv('LIVEKIT_EGRESS_S3_REGION');
      const s3AccessKey = this.requireEgressEnv('LIVEKIT_EGRESS_S3_ACCESS_KEY');
      const s3Secret = this.requireEgressEnv('LIVEKIT_EGRESS_S3_SECRET_KEY');
      const s3Endpoint = this.requireEgressEnv('LIVEKIT_EGRESS_S3_ENDPOINT');

      const s3Upload: S3Upload = {
        bucket: s3Bucket,
        region: s3Region,
        accessKey: s3AccessKey,
        secret: s3Secret,
        endpoint: s3Endpoint,
        forcePathStyle:
          (this.optionalEnv('LIVEKIT_EGRESS_S3_FORCE_PATH_STYLE') ?? 'false') ===
          'true',
        metadata: {},
        tagging: '',
        contentDisposition: 'attachment',
        sessionToken: '',
        assumeRoleArn: '',
        assumeRoleExternalId: '',
      } as unknown as S3Upload;

      const output = {
        fileType: EncodedFileType.MP4,
        filepath,
        s3: s3Upload,
      } as EncodedFileOutput;

      // Create options
      const opts: RoomCompositeOptions = {
        layout: options?.layout || 'speaker',
        audioOnly: options?.audioOnly || false,
        videoOnly: options?.videoOnly || false,
      };

      const info = await this.egressServiceClient.startRoomCompositeEgress(
        roomName,
        output,
        opts,
      );

      return info.egressId;
    } catch (error) {
      this.logger.error(
        `Failed to start recording for session ${sessionId}: ${error instanceof Error ? error.message : error}`,
      );
      throw error;
    }
  }

  async stopRecording(egressId: string): Promise<void> {
    try {
      await this.egressServiceClient.stopEgress(egressId);
    } catch (error) {
      this.logger.error(
        `Failed to stop recording ${egressId}: ${error instanceof Error ? error.message : error}`,
      );
      throw error;
    }
  }

  async listActiveRecordings(roomName: string): Promise<string[]> {
    try {
      const egressList = await this.egressServiceClient.listEgress({
        roomName,
      });
      return egressList
        .filter((egress) => egress.status === 1) // STATUS_ACTIVE
        .map((egress) => egress.egressId);
    } catch (error) {
      this.logger.error(
        `Failed to list active recordings for room ${roomName}: ${error instanceof Error ? error.message : error}`,
      );
      return [];
    }
  }

  async generateToken(options: LiveKitTokenOptions): Promise<string> {
    const at = new AccessToken(this.apiKey, this.apiSecret, {
      identity: options.identity,
      name: options.name,
      metadata: this.serializeMetadata(options.metadata),
    });

    const grant: VideoGrant = {
      roomJoin: true,
      room: options.roomName,
      canPublish: options.canPublish,
      canPublishData:
        options.canPublishData !== undefined ? options.canPublishData : true,
      canSubscribe: options.canSubscribe,
      canUpdateOwnMetadata: options.canUpdateOwnMetadata,
      hidden: options.hidden,
      recorder: options.recorder,
    };

    at.addGrant(grant);
    return at.toJwt();
  }

  private async ensureRoom(
    roomName: string,
    overrides?: Partial<CreateOptions>,
  ): Promise<Room> {
    const existing = await this.findRoom(roomName);
    if (existing) {
      return existing;
    }

    const createOptions: CreateOptions = {
      name: roomName,
      emptyTimeout: overrides?.emptyTimeout,
      departureTimeout: overrides?.departureTimeout,
      maxParticipants: overrides?.maxParticipants,
      metadata: overrides?.metadata,
      egress: overrides?.egress,
      minPlayoutDelay: overrides?.minPlayoutDelay,
      maxPlayoutDelay: overrides?.maxPlayoutDelay,
      syncStreams: overrides?.syncStreams,
      agents: overrides?.agents,
      nodeId: overrides?.nodeId,
    };

    try {
      return await this.roomServiceClient.createRoom(createOptions);
    } catch (error) {
      if (this.isAlreadyExistsError(error)) {
        const room = await this.findRoom(roomName);
        if (room) {
          return room;
        }
      }
      this.logger.error(
        `Failed to create LiveKit room ${roomName}: ${error instanceof Error ? error.message : error}`,
      );
      throw error;
    }
  }

  private async sendData(
    roomName: string,
    payload: unknown,
    options?: LiveKitDataMessageOptions,
  ): Promise<void> {
    const serialized = this.serializePayload(payload);
    if (!serialized) {
      this.logger.warn(
        `Skipping LiveKit data message for room ${roomName} due to serialization failure`,
      );
      return;
    }

    await this.roomServiceClient.sendData(
      roomName,
      serialized,
      options?.kind ?? DataPacket_Kind.RELIABLE,
      {
        topic: options?.topic,
        destinationIdentities: options?.destinationIdentities,
        destinationSids: options?.destinationSids,
      },
    );
  }

  private async findRoom(roomName: string): Promise<Room | null> {
    const rooms = await this.roomServiceClient.listRooms([roomName]);
    return rooms.find((room) => room.name === roomName) ?? null;
  }

  private serializeMetadata(
    metadata?: Record<string, unknown> | string,
  ): string | undefined {
    if (!metadata) {
      return undefined;
    }

    if (typeof metadata === 'string') {
      return metadata;
    }

    try {
      return JSON.stringify(metadata);
    } catch (error) {
      this.logger.warn(
        `Failed to serialize metadata for LiveKit token: ${error instanceof Error ? error.message : error}`,
      );
      return undefined;
    }
  }

  private serializePayload(payload: unknown): Uint8Array | null {
    try {
      return Buffer.from(JSON.stringify(payload));
    } catch (error) {
      this.logger.error(
        `Failed to serialize LiveKit data payload: ${error instanceof Error ? error.message : error}`,
      );
      return null;
    }
  }

  private normalizeServiceHost(url: string): string {
    if (url.startsWith('wss://')) {
      return `https://${url.slice('wss://'.length)}`;
    }
    if (url.startsWith('ws://')) {
      return `http://${url.slice('ws://'.length)}`;
    }
    if (url.startsWith('https://') || url.startsWith('http://')) {
      return url;
    }
    // default to https if protocol omitted
    return `https://${url}`;
  }

  private isAlreadyExistsError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }
    const message =
      'message' in error && typeof (error as any).message === 'string'
        ? (error as any).message.toLowerCase()
        : '';
    return message.includes('already exists');
  }
}
