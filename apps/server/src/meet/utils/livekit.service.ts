import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessToken, VideoGrant } from 'livekit-server-sdk';

@Injectable()
export class LiveKitService {
  private readonly logger = new Logger(LiveKitService.name);
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly serverUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.requireEnv('LIVEKIT_API_KEY');
    this.apiSecret = this.requireEnv('LIVEKIT_API_SECRET');
    this.serverUrl = this.requireEnv('LIVEKIT_URL');
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

  generateToken(identity: string, room: string) {
    const at = new AccessToken(this.apiKey, this.apiSecret, { identity });
    const grant: VideoGrant = { roomJoin: true, room };
    at.addGrant(grant);
    return at.toJwt();
  }
}
