import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AccessToken,
  type CreateOptions,
  RoomServiceClient,
  type Room,
  type ParticipantInfo,
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

@Injectable()
export class LiveKitService {
  private readonly logger = new Logger(LiveKitService.name);
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly serverUrl: string;
  private readonly roomServiceHost: string;
  private readonly roomServiceClient: RoomServiceClient;

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
